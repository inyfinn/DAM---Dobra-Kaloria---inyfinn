from pathlib import Path

root = Path(__file__).resolve().parents[2] / "apps" / "web"
for path in root.glob("*.html"):
    text = path.read_text(encoding="utf-8")
    fixed = text.replace("</script>`r`n  <script", "</script>\n\t<script").replace(
        "</script>`n  <script", "</script>\n\t<script"
    )
    if fixed != text:
        path.write_text(fixed, encoding="utf-8")
        print("fixed", path.name)
