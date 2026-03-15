"""
Market Panic — Agent Memory System

Per-agent ChromaDB collections for storing, retrieving, and compressing
memories. Each agent gets their own collection. This is the memory
architecture from Session 6.
"""

from __future__ import annotations

import logging
from hashlib import md5

import chromadb

logger = logging.getLogger(__name__)


# ── Importance Scoring ────────────────────────────────────────

def score_importance(event_type: str, magnitude: float = 0.0) -> int:
    """
    Score memory importance 1-10.

    Rules:
    - Price change > 10% → importance 8-10
    - Price change 5-10% → importance 5-7
    - Price change < 5% → importance 2-4
    - Scandal/panic events → importance 8+
    - Own trade result → importance 6
    - Chat message → importance 3-5
    - Routine market movement → importance 1-2
    """
    abs_mag = abs(magnitude)

    if event_type in ("scandal", "panic", "crash"):
        return min(10, 8 + int(abs_mag / 5))
    elif event_type == "trade":
        return 6
    elif event_type == "chat":
        return 4
    elif event_type == "news":
        if abs_mag > 10:
            return 9
        elif abs_mag > 5:
            return 6
        else:
            return 3
    elif event_type == "price_change":
        if abs_mag > 10:
            return 8
        elif abs_mag > 5:
            return 5
        else:
            return 2
    else:
        return 3


class AgentMemory:
    """
    Per-agent memory using ChromaDB.

    Each agent gets their own collection for semantic search over
    their personal history of events, trades, and observations.
    """

    def __init__(self, agent_name: str, client: chromadb.Client):
        self.agent_name = agent_name
        self.client = client
        safe_name = agent_name.lower().replace(" ", "_")[:30]
        from server.knowledge_base import GeminiEmbeddingFunction
        self.collection = client.get_or_create_collection(
            name=f"agent_{safe_name}_memories",
            metadata={"hnsw:space": "cosine"},
            embedding_function=GeminiEmbeddingFunction(),
        )

    def store(
        self,
        text: str,
        round_num: int,
        importance: int,
        event_type: str,
    ):
        """Store a single memory with metadata."""
        mem_id = f"mem_{self.agent_name}_{round_num}_{md5(text.encode()).hexdigest()[:8]}"
        self.collection.add(
            ids=[mem_id],
            documents=[text],
            metadatas=[{
                "round": round_num,
                "importance": importance,
                "type": event_type,
            }],
        )

    def retrieve(self, query: str, n_results: int = 10, min_importance: int = 3) -> list[dict]:
        """
        Retrieve relevant memories using semantic search + importance filter.

        Returns list of dicts with text, round, importance, type.
        """
        try:
            count = self.collection.count()
            if count == 0:
                return []

            results = self.collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
                where={"importance": {"$gte": min_importance}} if count > n_results else None,
            )

            memories = []
            if results["documents"] and results["documents"][0]:
                for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                    memories.append({
                        "text": doc,
                        "round": meta.get("round", 0),
                        "importance": meta.get("importance", 5),
                        "type": meta.get("type", "unknown"),
                    })
            return memories

        except Exception as e:
            logger.warning(f"Memory retrieval failed for {self.agent_name}: {e}")
            return []

    def get_all(self) -> list[dict]:
        """Get all memories for display in AgentInspector."""
        try:
            count = self.collection.count()
            if count == 0:
                return []

            results = self.collection.get(
                limit=count,
                include=["documents", "metadatas"],
            )

            memories = []
            if results["documents"]:
                for doc, meta in zip(results["documents"], results["metadatas"]):
                    memories.append({
                        "text": doc,
                        "round": meta.get("round", 0),
                        "importance": meta.get("importance", 5),
                        "type": meta.get("type", "unknown"),
                    })
            memories.sort(key=lambda m: m["round"])
            return memories

        except Exception as e:
            logger.warning(f"Failed to get all memories for {self.agent_name}: {e}")
            return []

    def count(self) -> int:
        """Return total number of memories."""
        return self.collection.count()

    async def compress(self, current_round: int, gemini_model: str | None = None):
        """
        Compress memories when count exceeds threshold.

        Strategy (instructor explains this — Session 5):
        1. Get all memories, sorted by round
        2. Split into "old" (> 10 rounds ago) and "recent"
        3. Group old memories by type (price_change, news, trade, chat)
        4. For each group: ask Gemini to summarize into one concise memory
        5. Delete individual old memories, store summaries
        6. Keep all recent memories intact

        This demonstrates hierarchical compression from Session 5.
        """
        all_memories = self.get_all()
        if len(all_memories) <= 50:
            return

        # Split into old and recent
        cutoff_round = current_round - 10
        old_memories = [m for m in all_memories if m["round"] <= cutoff_round]
        if len(old_memories) < 10:
            return  # not enough old memories to compress

        # Group by type
        groups: dict[str, list[dict]] = {}
        for mem in old_memories:
            mem_type = mem["type"]
            groups.setdefault(mem_type, []).append(mem)

        # Summarize each group
        for mem_type, memories in groups.items():
            if len(memories) < 3:
                continue

            memories_text = "\n".join(
                f"- [Round {m['round']}] {m['text']}" for m in memories
            )

            try:
                from server.gemini_client import generate
                summary = await generate(
                    prompt=f"Summarize these trading memories into 2-3 concise sentences "
                    f"that capture the key patterns and lessons:\n\n{memories_text}",
                    model=gemini_model,
                )
                summary = summary.strip()

                # Delete old individual memories
                old_ids = [
                    f"mem_{self.agent_name}_{m['round']}_{md5(m['text'].encode()).hexdigest()[:8]}"
                    for m in memories
                ]
                try:
                    self.collection.delete(ids=old_ids)
                except Exception:
                    pass  # some IDs may not match exactly

                # Store the summary
                self.store(
                    text=f"[COMPRESSED SUMMARY] {summary}",
                    round_num=memories[-1]["round"],
                    importance=max(m["importance"] for m in memories),
                    event_type=f"compressed_{mem_type}",
                )
                logger.info(
                    f"Compressed {len(memories)} {mem_type} memories for {self.agent_name}"
                )

            except Exception as e:
                logger.warning(f"Memory compression failed for {self.agent_name}: {e}")
