# Law Accuracy Verification Report

- **Date**: 2026-11-02 23:52:44 UTC
- **Git Commit**: `unknown`
- **Total Statutory Offences in Template**: 52
- **Reviewed Lines Evaluated**: 0
- **Awaiting Review (Unfilled Template Lines)**: 52
- **Passed**: 0
- **Failed**: 0

---

## 1. Executive Summary

This verification harness evaluates statutory accuracy of live responses against human-reviewed official gazette figures stored in `tests/eval/law_facts.jsonl`.
Per the evaluation protocol:
1. Lines with empty `expected` values are counted as **awaiting review** and skipped without failing the run.
2. For completed lines, every expected figure (fine, imprisonment, licence action) must appear verbatim in the retrieved answer or structured card, the cited chunk must contain the exact quote as a substring, and the official gazette page must match.

---

## 2. Evaluation Results by Entry

All 52 common statutory offences are initialized in `tests/eval/law_facts.jsonl` as templates for human review.
Zero lines have been completed by reviewers yet; all 52 lines are categorized as **awaiting review**.

To conduct law verification:
1. Review official gazette PDFs in `data/raw/` or uploaded via admin panel.
2. Fill in `expected`, `exactQuote`, `officialPage`, and `reviewedBy` in `tests/eval/law_facts.jsonl`.
3. Re-run `npm run law-check` to evaluate live stack responses against the verified quotes.

---

## 3. Discrepancy Log

No discrepancies found in reviewed items.

---
*Report generated automatically by `eval.law_check`.*
