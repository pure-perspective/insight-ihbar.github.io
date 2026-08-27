# Bootstrap Report: Source Manifest and Staging Baseline

**Generated:** 2026-08-19T16:42:36Z
**Operator:** qh-operator (x10)
**Task:** t_25edff71

---

## Source Directory

- **Path:** `/mnt/x570_data750/uniweb/QH-2026F-v2`
- **Access:** Read-only (immutable source)
- **Total files (excluding backups):** 225
- **Excluded backup files:** 2
  - `T1-1.html.bak-20260817-024709`
  - `T1-1_TTS.txt.bak-20260817-024709`

## File Type Breakdown

| Type | Count |
|------|-------|
| HTML lessons | 17 |
| TTS text files | 16 |
| JSON configs | 2 |
| Markdown | 1 |
| Images/media | 155 |
| Other | 34 |
| **Total** | **225** |

## Copy Process

1. Walked source directory recursively
2. Filtered out backup files (`*.bak*`)
3. Preserved existing staging files:
   - `controller/` directory contents (state.json, state.json.bak)
   - `setup/` directory contents (profile SOUL files)
   - `AGENTS.md` and `WORKFLOW.md` at staging root
4. Copied remaining 225 files using `shutil.copy2` (preserving metadata)
5. Skipped 0 files already in staging

## Source Immutability Evidence

- **Manifest generated BEFORE copy** (baseline captured first)
- **SHA-256 checksums verified AFTER copy** (source unchanged)
- **Files verified:** 225
- **All checksums match:** True
- **Mismatches:** 0

## Staging Verification

- **Files checked against source:** 225
- **All staging files match source:** True
- **Mismatches:** 0

## Artifacts

- `reports/source-manifest.json` — Full manifest with paths, sizes, SHA-256 hashes
- `reports/bootstrap.md` — This report

## Checksums Summary

Source manifest SHA-256 of manifest file itself:
- `reports/source-manifest.json`: `1f8e06e23d7a7acc1b66e20a2d237a42821714e96d527ca10a22426e9d5598ba`
