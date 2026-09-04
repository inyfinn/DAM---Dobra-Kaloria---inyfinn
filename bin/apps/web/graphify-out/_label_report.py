import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import suggest_questions
from graphify.report import generate

extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text(encoding="utf-8"))
detection = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8"))
analysis = json.loads(Path("graphify-out/.graphify_analysis.json").read_text(encoding="utf-8"))

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis["communities"].items()}
cohesion = {int(k): v for k, v in analysis["cohesion"].items()}
tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}

named = {
    0: "Inbox messages",
    1: "Tutorial overlay",
    2: "Project costs",
    3: "Add product wizard",
    4: "Bootstrap UI helpers",
    5: "Project page",
    6: "Bento resize",
    7: "Path bridge helpers",
    8: "Assoc editor",
    9: "Bootstrap vendor",
    10: "GSAP vendor",
    11: "jQuery vendor",
    12: "Settings page",
    13: "Badges and tags",
    14: "Tasks Asana",
    15: "Explorer lifecycle",
    16: "Branding filters",
    17: "DamLabels naming",
    18: "Projects grid",
    19: "Assoc save payload",
    20: "Visualizations grid",
    21: "Branding gallery",
    25: "Shared modal chrome",
    26: "Viz card flags",
    50: "DamSearch engine",
    65: "Tag bar search",
    133: "Search suggestions",
    164: "Search scope chips",
    165: "Search box binding",
}

labels = {cid: named.get(cid, f"Module {cid}") for cid in communities}
questions = suggest_questions(G, communities, labels)
report = generate(
    G,
    communities,
    cohesion,
    labels,
    analysis["gods"],
    analysis["surprises"],
    detection,
    tokens,
    ".",
    suggested_questions=questions,
)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
Path("graphify-out/.graphify_labels.json").write_text(
    json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False),
    encoding="utf-8",
)
analysis["questions"] = questions
Path("graphify-out/.graphify_analysis.json").write_text(
    json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8"
)
print("Report updated with community labels")
