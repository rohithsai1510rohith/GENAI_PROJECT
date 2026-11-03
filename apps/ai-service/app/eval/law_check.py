import os
import sys
import json
import subprocess
from datetime import datetime
import urllib.request
import urllib.error

def get_git_hash() -> str:
    try:
        res = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except Exception:
        return "unknown"

def run_law_check():
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    jsonl_path = os.path.join(workspace_root, "tests", "eval", "law_facts.jsonl")
    docs_eval_dir = os.path.join(workspace_root, "docs", "eval")
    os.makedirs(docs_eval_dir, exist_ok=True)
    report_path = os.path.join(docs_eval_dir, "law-check.md")

    if not os.path.exists(jsonl_path):
        print(f"Error: {jsonl_path} does not exist", file=sys.stderr)
        sys.exit(1)

    with open(jsonl_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    total_lines = len(lines)
    reviewed_count = 0
    awaiting_count = 0
    results = []

    api_url = os.environ.get("LAW_CHECK_API_URL", "http://127.0.0.1:8000/query")

    print(f"============================================================")
    print(f" Indian Statutory Law Accuracy Verification Harness")
    print(f" Dataset: {jsonl_path} ({total_lines} total statutory entries)")
    print(f" Live Stack Endpoint: {api_url}")
    print(f"============================================================")

    for line_idx, line in enumerate(lines, 1):
        try:
            entry = json.loads(line)
        except Exception as e:
            print(f"Skipping malformed line {line_idx}: {e}")
            continue

        item_id = entry.get("id", f"law-{line_idx}")
        question = entry.get("question", "")
        section = entry.get("section", "")
        expected = entry.get("expected", {}) or {}
        exact_quote = entry.get("exactQuote", "")
        official_page = entry.get("officialPage")

        # Determine if completed or awaiting review
        has_expected = any(bool(v.strip()) for k, v in expected.items() if isinstance(v, str))
        has_quote = bool(exact_quote.strip())

        if not has_expected and not has_quote:
            awaiting_count += 1
            continue

        reviewed_count += 1
        print(f"Evaluating reviewed item {item_id}: '{question}'...")

        # Run through live stack
        payload = json.dumps({"question": question, "stream": False}).encode("utf-8")
        req = urllib.request.Request(api_url, data=payload, headers={"Content-Type": "application/json"})

        item_result = {
            "id": item_id,
            "question": question,
            "section": section,
            "passed": True,
            "discrepancies": []
        }

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as err:
            item_result["passed"] = False
            item_result["discrepancies"].append(f"Network / API query failed: {err}")
            results.append(item_result)
            continue

        answer_text = data.get("answer", "")
        card_data = data.get("card") or {}
        sources = data.get("sources", [])

        # Check expected fields
        for field, exp_val in expected.items():
            if not exp_val or not isinstance(exp_val, str) or not exp_val.strip():
                continue
            exp_clean = exp_val.strip()
            # Must appear verbatim in answer or card
            found_in_answer = exp_clean in answer_text
            found_in_card = any(exp_clean in kf.get("value", "") for kf in card_data.get("keyFacts", []))
            if not found_in_answer and not found_in_card:
                item_result["passed"] = False
                item_result["discrepancies"].append(
                    f"Expected field '{field}' value '{exp_clean}' not found verbatim in response"
                )

        # Check exactQuote in cited chunk
        if exact_quote.strip():
            quote_clean = exact_quote.strip()
            found_in_chunk = any(
                quote_clean in (s.get("chunkText", "") or s.get("excerpt", ""))
                for s in sources
            )
            if not found_in_chunk:
                item_result["passed"] = False
                item_result["discrepancies"].append(
                    f"Exact statutory quote '{quote_clean[:60]}...' not found as substring in cited chunks"
                )

        # Check officialPage against retrieved page
        if official_page is not None:
            matching_page = any(s.get("page") == official_page for s in sources)
            if not matching_page:
                retrieved_pages = [s.get("page") for s in sources]
                item_result["passed"] = False
                item_result["discrepancies"].append(
                    f"Official page {official_page} does not match any retrieved chunk pages {retrieved_pages}"
                )

        results.append(item_result)

    git_hash = get_git_hash()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

    passed_count = sum(1 for r in results if r["passed"])
    failed_count = sum(1 for r in results if not r["passed"])

    print(f"\n============================================================")
    print(f" Law Accuracy Verification Results")
    print(f" Total Entries: {total_lines}")
    print(f" Reviewed Lines: {reviewed_count}")
    print(f" Awaiting Review (Skipped): {awaiting_count}")
    print(f" Passed: {passed_count}")
    print(f" Failed: {failed_count}")
    print(f" Git Hash: {git_hash}")
    print(f"============================================================\n")

    # Generate docs/eval/law-check.md
    md_content = f"""# Law Accuracy Verification Report

- **Date**: {now_str}
- **Git Commit**: `{git_hash}`
- **Total Statutory Offences in Template**: {total_lines}
- **Reviewed Lines Evaluated**: {reviewed_count}
- **Awaiting Review (Unfilled Template Lines)**: {awaiting_count}
- **Passed**: {passed_count}
- **Failed**: {failed_count}

---

## 1. Executive Summary

This verification harness evaluates statutory accuracy of live responses against human-reviewed official gazette figures stored in `tests/eval/law_facts.jsonl`.
Per the evaluation protocol:
1. Lines with empty `expected` values are counted as **awaiting review** and skipped without failing the run.
2. For completed lines, every expected figure (fine, imprisonment, licence action) must appear verbatim in the retrieved answer or structured card, the cited chunk must contain the exact quote as a substring, and the official gazette page must match.

---

## 2. Evaluation Results by Entry

"""
    if reviewed_count == 0:
        md_content += f"""All {total_lines} common statutory offences are initialized in `tests/eval/law_facts.jsonl` as templates for human review.
Zero lines have been completed by reviewers yet; all {awaiting_count} lines are categorized as **awaiting review**.

To conduct law verification:
1. Review official gazette PDFs in `data/raw/` or uploaded via admin panel.
2. Fill in `expected`, `exactQuote`, `officialPage`, and `reviewedBy` in `tests/eval/law_facts.jsonl`.
3. Re-run `npm run law-check` to evaluate live stack responses against the verified quotes.
"""
    else:
        md_content += "| ID | Question | Section | Status | Discrepancies |\n"
        md_content += "| :--- | :--- | :--- | :---: | :--- |\n"
        for r in results:
            status_badge = "PASS" if r["passed"] else "FAIL"
            disc_text = "; ".join(r["discrepancies"]) if r["discrepancies"] else "None (verbatim match)"
            md_content += f"| `{r['id']}` | {r['question']} | {r['section']} | **{status_badge}** | {disc_text} |\n"

    md_content += f"""
---

## 3. Discrepancy Log

"""
    discrepancy_found = False
    for r in results:
        if not r["passed"]:
            discrepancy_found = True
            md_content += f"### Discrepancy in `{r['id']}` ({r['section']})\n"
            md_content += f"- **Question**: {r['question']}\n"
            for d in r["discrepancies"]:
                md_content += f"- ❌ {d}\n"
            md_content += "\n"

    if not discrepancy_found:
        md_content += "No discrepancies found in reviewed items.\n"

    md_content += f"""
---
*Report generated automatically by `eval.law_check`.*
"""

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"Report written to: {report_path}")
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    sys.exit(run_law_check())

