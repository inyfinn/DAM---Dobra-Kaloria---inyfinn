# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "assets" / "js" / "dam-explorer.js"
text = path.read_text(encoding="utf-8")
old = """  function showSessionRequiredToast(errCode) {
    var code = String(errCode || "login_required");
    var hint =
      code === "admin_required"
        ? "Tylko admin może zapisywać F/X/D na dysku."
        : "Sesja wygasła - zaloguj się ponownie (profil w prawym górnym rogu), potem włącz ADMIN.";
    showToast(hint, "error");
  }"""
new = """  function showSessionRequiredToast(errCode) {
    var code = String(errCode || "login_required");
    var hint =
      code === "admin_required" || code === "lifecycle_writer_required"
        ? "Brak uprawnień do zapisu F/X/D na dysku (admin, power user lub grafik)."
        : "Sesja wygasła — zaloguj się ponownie (profil w prawym górnym rogu), potem włącz ADMIN.";
    showToast(hint, "error");
  }"""
if old not in text:
    raise SystemExit("pattern not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("patched showSessionRequiredToast")
