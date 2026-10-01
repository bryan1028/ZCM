#!/usr/bin/env python3
"""Build zist-plugin-<version>.zip from plugin/ with the layout the portal requires (plugin root at the archive root)."""
import json, os, re, sys, zipfile

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plugin")
manifest = json.load(open(os.path.join(root, "plugin.json")))
out = os.path.join(root, "..", f"zist-plugin-{manifest['version']}.zip")

files = []
for base, _, names in os.walk(root):
    for n in sorted(names):
        full = os.path.join(base, n)
        rel = os.path.relpath(full, root).replace(os.sep, "/")
        if n.startswith(".") or n.endswith(".zip"): continue
        files.append((full, rel))
files.sort(key=lambda x: x[1])

# Same checks the portal runs on archives (see /plugins/deploy/submission-errors)
for _, rel in files:
    assert not rel.startswith("/") and ".." not in rel.split("/") and "\\" not in rel and rel == rel.strip(), f"bad path {rel}"
    assert len(rel.split("/")) <= 20, rel
assert len({r.lower() for _, r in files}) == len(files), "case-colliding paths"
assert any(r == "plugin.json" for _, r in files), "plugin.json must be at the archive root"
for k in ("composerIcon", "composerIconDark", "logo", "logoDark"):
    assert os.path.exists(os.path.join(root, manifest["extensions"]["com.openai"]["interface"][k])), k
assert not re.search(r"test_credentials|reviewer_instructions", open(os.path.join(root, "plugin.json")).read()), "no credentials in the ZIP"

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for full, rel in files:
        info = zipfile.ZipInfo(rel, date_time=(2026, 10, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED; info.external_attr = 0o644 << 16
        z.writestr(info, open(full, "rb").read())
print(f"wrote {os.path.normpath(out)} ({os.path.getsize(out)//1024} KB)")
for _, rel in files: print("  ", rel)
