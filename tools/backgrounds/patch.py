#!/usr/bin/env python3
"""Surgical exact-string patcher (stand-in for the edit tool).

Usage: python3 patch.py spec.json
spec.json = [{"path": "...", "old": "...", "new": "...", "count": 1}, ...]
Fails loudly if old is not found exactly once (unless count given).
"""
import json, sys, os

spec = json.load(open(sys.argv[1], encoding="utf-8"))
ok = 0
for e in spec:
    p, old, new = e["path"], e["old"], e["new"]
    want = e.get("count", 1)
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != want:
        print(f"FAIL {p}: found {n} occurrences, expected {want}")
        print("  snippet:", repr(old[:90]))
        sys.exit(1)
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
    print(f"OK   {p}: {want} replacement(s)")
    ok += 1
print(f"\n{ok} edits applied")
