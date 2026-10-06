# app/services/retrieval/mmr.py
# Maximal Marginal Relevance — plan §9.2
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)


def mmr_select(query_vector: list, candidates: list,
               lambda_param: float = 0.7, top_k: int = 8) -> list:
    """
    MMR diversity selection — plan §9.2.
    lambda_param=0.7 balances relevance (0.7) vs diversity (0.3).
    """
    if not candidates:
        return []
    try:
        import numpy as np
        q = np.array(query_vector, dtype=float)

        def cos(a, b):
            na, nb = np.linalg.norm(a), np.linalg.norm(b)
            if na < 1e-10 or nb < 1e-10:
                return 0.0
            return float(np.dot(a, b) / (na * nb))

        # Use stored embedding if present, else use rrf_score as proxy
        embs = []
        for c in candidates:
            emb = c.get("embedding")
            if emb and len(emb) > 0:
                embs.append(np.array(emb, dtype=float))
            else:
                # No embedding stored — use query vector as placeholder
                embs.append(q.copy())

        rel = [cos(q, e) for e in embs]
        sel_idx, sel_embs = [], []

        for _ in range(min(top_k, len(candidates))):
            best, best_score = -1, float("-inf")
            for i, (e, r) in enumerate(zip(embs, rel)):
                if i in sel_idx:
                    continue
                max_sim = max((cos(e, s) for s in sel_embs), default=0.0)
                score = lambda_param * r - (1 - lambda_param) * max_sim
                if score > best_score:
                    best, best_score = i, score
            if best == -1:
                break
            sel_idx.append(best)
            sel_embs.append(embs[best])

        return [candidates[i] for i in sel_idx]

    except ImportError:
        logger.warning("numpy not available — skipping MMR, returning top-k")
        return candidates[:top_k]
    except Exception as e:
        logger.warning(f"MMR failed: {e} — returning top-k")
        return candidates[:top_k]
