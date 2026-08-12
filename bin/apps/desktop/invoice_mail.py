# -*- coding: utf-8 -*-
"""Prepare Outlook mail drafts with invoice attachments (Windows COM).

Fallback: stage a ZIP of CSV/HTML invoice packs + return mailto-friendly payload.
"""
from __future__ import annotations

import csv
import io
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

LoadJson = Callable[[Path, Any], Any]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def stage_dir(web_root: Path) -> Path:
    d = web_root / "data" / "_invoice_mail_stage"
    d.mkdir(parents=True, exist_ok=True)
    return d


def invoice_to_csv(inv: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(
        ["id", "client", "project", "amount", "currency", "issue_date", "due_date", "status", "type"]
    )
    w.writerow(
        [
            inv.get("id"),
            inv.get("client"),
            inv.get("project"),
            inv.get("amount"),
            inv.get("currency") or "PLN",
            inv.get("issue_date"),
            inv.get("due_date"),
            inv.get("status"),
            inv.get("type"),
        ]
    )
    lines = inv.get("lines") or []
    if lines:
        w.writerow([])
        w.writerow(["line_description", "category", "qty", "unit_price", "amount"])
        for ln in lines:
            if not isinstance(ln, dict):
                continue
            w.writerow(
                [
                    ln.get("description"),
                    ln.get("category"),
                    ln.get("qty"),
                    ln.get("unit_price"),
                    ln.get("amount"),
                ]
            )
    return buf.getvalue()


def invoice_to_html(inv: dict, accounting_no: str) -> str:
    rows = ""
    for ln in inv.get("lines") or []:
        if not isinstance(ln, dict):
            continue
        rows += (
            f"<tr><td>{_esc(ln.get('description'))}</td>"
            f"<td>{_esc(ln.get('category'))}</td>"
            f"<td>{_esc(ln.get('qty'))}</td>"
            f"<td>{_esc(ln.get('unit_price'))}</td>"
            f"<td>{_esc(ln.get('amount'))}</td></tr>"
        )
    if not rows:
        rows = f"<tr><td colspan='5'>{_esc(inv.get('project') or inv.get('type') or '')}</td></tr>"
    return f"""<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><title>{_esc(inv.get('id'))}</title>
<style>body{{font-family:Segoe UI,Arial,sans-serif;padding:24px}}table{{border-collapse:collapse;width:100%}}
th,td{{border:1px solid #ddd;padding:8px;text-align:left}}th{{background:#f5f5f8}}</style></head>
<body>
<h1>Faktura {_esc(inv.get('id'))}</h1>
<p>Klient: {_esc(inv.get('client'))}<br>
Projekt: {_esc(inv.get('project'))}<br>
Kwota: {_esc(inv.get('amount'))} {_esc(inv.get('currency') or 'PLN')}<br>
Data: {_esc(inv.get('issue_date'))} · Termin: {_esc(inv.get('due_date'))}<br>
Nr księgowości: {_esc(accounting_no)}</p>
<table><thead><tr><th>Opis</th><th>Kat.</th><th>Ilość</th><th>Cena</th><th>Suma</th></tr></thead>
<tbody>{rows}</tbody></table>
</body></html>"""


def invoice_to_pdf(inv: dict, accounting_no: str, out_path: Path) -> bool:
    """Write a simple one-page PDF (reportlab). Returns False if lib missing."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except ImportError:
        return False
    c = canvas.Canvas(str(out_path), pagesize=A4)
    width, height = A4
    y = height - 20 * mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(20 * mm, y, f"Faktura {inv.get('id') or ''}")
    y -= 10 * mm
    c.setFont("Helvetica", 10)
    meta = [
        f"Klient: {inv.get('client') or ''}",
        f"Projekt: {inv.get('project') or ''}",
        f"Kwota: {inv.get('amount')} {inv.get('currency') or 'PLN'}",
        f"Data: {inv.get('issue_date') or ''}  Termin: {inv.get('due_date') or ''}",
        f"Nr ksiegowosci: {accounting_no}",
    ]
    for line in meta:
        c.drawString(20 * mm, y, str(line)[:110])
        y -= 6 * mm
    y -= 4 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Opis")
    c.drawString(95 * mm, y, "Ilosc")
    c.drawString(120 * mm, y, "Cena")
    c.drawString(150 * mm, y, "Suma")
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    lines = inv.get("lines") or []
    if not lines:
        c.drawString(20 * mm, y, str(inv.get("project") or inv.get("type") or "-")[:80])
    else:
        for ln in lines:
            if not isinstance(ln, dict):
                continue
            if y < 25 * mm:
                c.showPage()
                y = height - 20 * mm
                c.setFont("Helvetica", 9)
            c.drawString(20 * mm, y, str(ln.get("description") or "")[:55])
            c.drawString(95 * mm, y, str(ln.get("qty") if ln.get("qty") is not None else ""))
            c.drawString(120 * mm, y, str(ln.get("unit_price") if ln.get("unit_price") is not None else ""))
            c.drawString(150 * mm, y, str(ln.get("amount") if ln.get("amount") is not None else ""))
            y -= 5 * mm
    c.save()
    return out_path.is_file()


def _esc(v: Any) -> str:
    return (
        str(v if v is not None else "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_attachments(
    web_root: Path,
    invoices: list[dict],
    *,
    accounting_no: str,
) -> list[Path]:
    out_dir = stage_dir(web_root) / datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for inv in invoices:
        if not isinstance(inv, dict) or not inv.get("id"):
            continue
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in str(inv["id"]))
        csv_path = out_dir / f"{safe}.csv"
        html_path = out_dir / f"{safe}.html"
        pdf_path = out_dir / f"{safe}.pdf"
        csv_path.write_text(invoice_to_csv(inv), encoding="utf-8-sig")
        html_path.write_text(invoice_to_html(inv, accounting_no), encoding="utf-8")
        paths.extend([csv_path, html_path])
        if invoice_to_pdf(inv, accounting_no, pdf_path):
            paths.append(pdf_path)
    return paths


def make_zip(web_root: Path, files: list[Path]) -> Path:
    zpath = stage_dir(web_root) / f"faktury_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.write(f, arcname=f.name)
    return zpath


def create_outlook_draft(
    *,
    to: list[str],
    subject: str,
    body: str,
    attachments: list[Path],
) -> dict[str, Any]:
    if sys.platform != "win32":
        return {"ok": False, "error": "outlook_windows_only"}
    try:
        import win32com.client  # type: ignore
    except ImportError:
        return {"ok": False, "error": "pywin32_missing"}
    last_err: Exception | None = None
    for factory in (
        lambda: win32com.client.Dispatch("Outlook.Application"),
        lambda: win32com.client.gencache.EnsureDispatch("Outlook.Application"),
        lambda: win32com.client.DispatchEx("Outlook.Application"),
    ):
        try:
            outlook = factory()
            mail = outlook.CreateItem(0)  # olMailItem
            mail.To = "; ".join(to)
            mail.Subject = subject
            mail.Body = body
            attached = 0
            for att in attachments:
                if att.is_file():
                    mail.Attachments.Add(str(att.resolve()))
                    attached += 1
            mail.Display(False)
            return {
                "ok": True,
                "attachments": attached,
                "to": to,
                "subject": subject,
            }
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            continue
    return {"ok": False, "error": f"outlook_com_failed: {last_err}"}


def prepare_invoice_mail(
    web_root: Path,
    *,
    invoice_ids: list[str],
    to: list[str],
    accounting_no: str,
    body: str,
    load_json: LoadJson,
    invoices_file: Path,
) -> dict[str, Any]:
    store = load_json(invoices_file, {"invoices": []})
    all_inv = store.get("invoices") if isinstance(store, dict) else []
    if not isinstance(all_inv, list):
        all_inv = []
    id_set = {str(x) for x in invoice_ids}
    selected = [inv for inv in all_inv if isinstance(inv, dict) and str(inv.get("id")) in id_set]
    if not selected:
        return {"ok": False, "error": "no_invoices_matched"}
    if not to:
        return {"ok": False, "error": "recipients_required"}

    files = build_attachments(web_root, selected, accounting_no=accounting_no or "509012414")
    subject = f"Faktury DAM · księgowość {accounting_no or '509012414'}"
    body_text = body or "W załączeniu faktury DAM."

    outlook = create_outlook_draft(
        to=to, subject=subject, body=body_text, attachments=files
    )
    zip_path = make_zip(web_root, files)
    result: dict[str, Any] = {
        "ok": bool(outlook.get("ok")),
        "outlook": outlook,
        "attachments": len(files),
        "invoice_count": len(selected),
        "zip_path": str(zip_path),
        "zip_name": zip_path.name,
        "accounting_no": accounting_no,
        "to": to,
        "subject": subject,
        "updated_at": utc_now(),
    }
    if not outlook.get("ok"):
        result["error"] = outlook.get("error") or "outlook_failed"
        result["fallback"] = "zip_and_mailto"
    return result
