# Retrieval Architecture & Provisional Baseline Documentation

## Overview
The Traffic Rules & Fines Assistant uses a hybrid retrieval architecture designed for strict legal grounding and domain compliance.

## PRD Baseline vs. Current Implementation

| Feature | PRD Baseline (Section 12) | Phase 2 Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Retrieval Mode** | Dense FAISS Vector Search (`all-MiniLM-L6-v2`) | **Hybrid Search**: Dense FAISS Cosine Similarity (60%) + Sparse BM25 Lexical Keyword (40%) with synonym expansion | **Provisional enhancement** |
| **Confidence Thresholds** | Single similarity threshold fallback (`SIM_THRESHOLD = 0.35`) | **Three-Tier Confidence System**: <br/>- `HIGH` ($\ge 0.52$): direct answer<br/>- `MEDIUM` ($0.35 \le score < 0.52$): answer marked as closest statutory provision<br/>- `LOW` ($< 0.35$): ungrounded fallback, LLM bypassed | **Provisional thresholds** |
| **Continuation Merging** | Per-chunk retrieval | **Adjacent Sibling Chunk Merging**: Automatically merges subsequent statutory clauses of the same section if split across chunk boundaries | **Active** |

> [!NOTE]
> **Provisional Threshold Notice**:
> The hybrid weighting and confidence thresholds (`HIGH: 0.52`, `MEDIUM: 0.35`) exceed the minimal baseline in the original PRD and are **provisional**. They will be evaluated and tuned against the comprehensive 100-question evaluation benchmark suite in **Phase 8 Quality & Evaluation**.
