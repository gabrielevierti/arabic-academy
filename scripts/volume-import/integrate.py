"""Merge an assembled volume (out/) into the Arabo da Zero repository."""
import json, shutil, sys
from pathlib import Path

out, repo = Path(sys.argv[1]), Path(sys.argv[2])
vol = json.loads((out / "index.json").read_text())
level = vol["book"]["id"]
course_path = repo / "data" / "course.json"
course = json.loads(course_path.read_text())
order = ["A0", "A1", "A2", "B1", "B2", "C1"]
course["books"] = [b for b in course["books"] if b["id"] != level] + [vol["book"]]
course["books"].sort(key=lambda b: order.index(b["id"]))
course["lessons"] = [l for l in course["lessons"] if l["level"] != level] + vol["lessons"]
course["lessons"].sort(key=lambda l: order.index(l["level"]))  # stable: keeps volume order
course_path.write_text(json.dumps(course, ensure_ascii=False))
meta_path = repo / "data" / "study-metadata.json"
meta = json.loads(meta_path.read_text())
meta = {k: v for k, v in meta.items() if not k.startswith(level + "-")}
meta.update(vol["metadata"])
meta_path.write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
dest = repo / "public" / "course"
for old in dest.glob(f"{level}-*.json"):
    old.unlink()
n = 0
for f in sorted((out / "course").glob("*.json")):
    shutil.copy(f, dest / f.name)
    n += 1
print(level, "lessons", len(vol["lessons"]), "files", n)
