"""
Market Panic — Knowledge Base

Shared ChromaDB collection with ~50 pre-loaded documents about companies,
sectors, historical patterns, and trading strategies. Used for RAG retrieval
in the agent brain (Session 3).
"""

from __future__ import annotations

import logging

import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings

logger = logging.getLogger(__name__)


class GeminiEmbeddingFunction(EmbeddingFunction):
    """ChromaDB embedding function using Gemini gemini-embedding-001."""

    def __call__(self, input: Documents) -> Embeddings:
        from server.gemini_client import embed
        try:
            return embed(input)
        except Exception as e:
            logger.warning(f"Gemini embedding failed, returning empty: {e}")
            return [[0.0] * 3072 for _ in input]


# ── Knowledge Documents ──────────────────────────────────────
# All documents inline so the instructor can show them during the code walkthrough.

KNOWLEDGE_DOCS: list[dict[str, str]] = [
    # ── Company Profiles (6) ───────────────────────────────
    {
        "id": "company_nova",
        "category": "company_profile",
        "text": "TechNova (NOVA) is an AI/Tech company trading around $150. It is highly sensitive to AI hype cycles, product launches, and tech regulation news. NOVA tends to overshoot on positive news and crash hard on negative sentiment. Momentum traders love this stock.",
    },
    {
        "id": "company_grne",
        "category": "company_profile",
        "text": "GreenPulse (GRNE) is a clean energy company trading around $85. It moves primarily on government policy — subsidies, carbon taxes, and renewable energy mandates. Steady growth with occasional policy-driven spikes. Considered a long-term hold by institutional investors.",
    },
    {
        "id": "company_medi",
        "category": "company_profile",
        "text": "MediCorp (MEDI) is a pharmaceutical company trading around $200. Known for scandal-prone leadership and patent cliff risks, but also massive upside on drug breakthroughs. The most volatile pharma stock — can swing 15% in a single round on FDA news.",
    },
    {
        "id": "company_food",
        "category": "company_profile",
        "text": "FoodCo (FOOD) is an agricultural company trading around $45. The classic safe haven — low volatility, steady dividends, and reliable earnings. During market panics, money flows INTO FoodCo. Boring but profitable for cautious investors.",
    },
    {
        "id": "company_luxe",
        "category": "company_profile",
        "text": "LuxeGlobal (LUXE) is a luxury goods company trading around $310. Extremely sentiment-driven — celebrity endorsements, influencer mentions, and consumer confidence data move this stock dramatically. The highest volatility in the market.",
    },
    {
        "id": "company_iron",
        "category": "company_profile",
        "text": "IronShield (IRON) is a defense contractor trading around $120. Moves inversely to broad market sentiment — when markets panic, defense stocks often rise as investors seek safety. Geopolitical tensions are the primary catalyst.",
    },

    # ── Sector Analyses (6) ────────────────────────────────
    {
        "id": "sector_tech",
        "category": "sector_analysis",
        "text": "The AI/Tech sector is in a hype-driven bull cycle. Valuations are stretched but earnings are growing. The sector is highly correlated — when one major tech stock falls, others often follow. Watch for regulation headlines and chip supply constraints.",
    },
    {
        "id": "sector_energy",
        "category": "sector_analysis",
        "text": "Clean energy is a policy-dependent sector. Government subsidies and carbon pricing create tailwinds, while political changes can reverse gains quickly. The sector has low correlation with tech, making it a good diversifier.",
    },
    {
        "id": "sector_pharma",
        "category": "sector_analysis",
        "text": "Pharma is a high-risk, high-reward sector. Drug approvals can double stock prices overnight, while failed trials or scandals can cut them in half. Patent expirations create 'cliffs' where revenue drops suddenly. Due diligence on pipeline news is critical.",
    },
    {
        "id": "sector_agri",
        "category": "sector_analysis",
        "text": "Agriculture is the most defensive sector. Steady demand regardless of economic conditions. In bear markets, agricultural stocks outperform as investors rotate to safety. Low upside in bull markets but consistent returns.",
    },
    {
        "id": "sector_luxury",
        "category": "sector_analysis",
        "text": "Luxury goods are a proxy for consumer confidence and wealth effects. When the market rises and people feel rich, luxury spending increases. The sector is the first to fall in downturns and the last to recover. Highly cyclical.",
    },
    {
        "id": "sector_defense",
        "category": "sector_analysis",
        "text": "Defense stocks are the classic 'fear trade.' Geopolitical tensions, military conflicts, and government defense budgets drive prices. Defense often moves inversely to broad market sentiment, providing a natural hedge.",
    },

    # ── Historical Patterns (12) ──────────────────────────
    {
        "id": "pattern_scandal_recovery",
        "category": "historical_pattern",
        "text": "Historical pattern: When a company faces a scandal, the stock typically drops 10-15% in the first round, then partially recovers over 3-5 rounds as the market realizes the impact was overestimated. Buying during peak panic often yields 8-12% returns.",
    },
    {
        "id": "pattern_rumor_trap",
        "category": "historical_pattern",
        "text": "Historical pattern: Merger rumors that turn out to be false cause a classic 'pump and dump.' The stock rises 8-15% on the rumor, then crashes below the pre-rumor price when denied. Smart traders sell on rumor confirmation, not on the initial spike.",
    },
    {
        "id": "pattern_rate_cut",
        "category": "historical_pattern",
        "text": "Historical pattern: Interest rate cuts cause broad market rallies of 3-5% within 2-3 rounds. Growth stocks (tech, luxury) benefit the most. Defense and agriculture see smaller gains. The effect is strongest in the first round after the announcement.",
    },
    {
        "id": "pattern_sector_rotation",
        "category": "historical_pattern",
        "text": "Historical pattern: When one sector falls sharply, money rotates into uncorrelated sectors. Tech crashes often benefit defense and agriculture. Luxury crashes benefit energy and agriculture. Understanding these correlations is key to surviving downturns.",
    },
    {
        "id": "pattern_momentum",
        "category": "historical_pattern",
        "text": "Historical pattern: Stocks that rise for 3+ consecutive rounds tend to continue rising for 1-2 more rounds (momentum effect). However, the reversal when momentum breaks is sharp — often giving back 50-70% of gains in 2 rounds.",
    },
    {
        "id": "pattern_panic_selling",
        "category": "historical_pattern",
        "text": "Historical pattern: Market-wide panic events cause indiscriminate selling. Even strong companies drop. The key insight: panic is temporary. Buying quality stocks during market-wide panic is historically the highest-return strategy.",
    },
    {
        "id": "pattern_fda_approval",
        "category": "historical_pattern",
        "text": "Historical pattern: FDA drug approvals for pharma companies typically cause 15-25% price jumps. However, the initial spike often corrects by 30-40% as traders take profits. The real value emerges over 5-10 rounds as revenue estimates are updated.",
    },
    {
        "id": "pattern_earnings_beat",
        "category": "historical_pattern",
        "text": "Historical pattern: Companies that beat earnings estimates by more than 10% see sustained price increases for 4-6 rounds. The initial reaction accounts for only about 60% of the total move — there's usually a 'drift' higher after the initial spike.",
    },
    {
        "id": "pattern_defense_inverse",
        "category": "historical_pattern",
        "text": "Historical pattern: Defense stocks (like IRON) consistently move inversely to market sentiment. When the broad market drops 5%+, defense stocks typically gain 2-4%. This makes defense an excellent portfolio hedge during uncertain times.",
    },
    {
        "id": "pattern_luxury_crash",
        "category": "historical_pattern",
        "text": "Historical pattern: Luxury stocks are the canary in the coal mine for market downturns. When LUXE starts falling without obvious news, it often precedes broader market weakness by 2-3 rounds. Watch luxury as a leading indicator.",
    },
    {
        "id": "pattern_recovery_sequence",
        "category": "historical_pattern",
        "text": "Historical pattern: After market-wide crashes, recovery follows a predictable sequence. First: defensive stocks (FOOD, IRON) stabilize. Then: energy (GRNE) starts recovering. Finally: growth stocks (NOVA, LUXE) lead the rally. Pharma (MEDI) is unpredictable.",
    },
    {
        "id": "pattern_volume_signal",
        "category": "historical_pattern",
        "text": "Historical pattern: High trading volume on a price drop signals capitulation — the last sellers are selling. This is often the bottom. High volume on a price rise confirms bullish momentum. Low volume on either move suggests the trend may reverse soon.",
    },

    # ── Trading Strategies (10) ───────────────────────────
    {
        "id": "strategy_buy_dip",
        "category": "trading_strategy",
        "text": "Strategy: Buy the Dip — When a fundamentally strong stock drops 8%+ on temporary bad news, buy aggressively. The key is distinguishing temporary setbacks from permanent damage. Works best with FOOD, GRNE, and IRON. Risky with LUXE and NOVA.",
    },
    {
        "id": "strategy_momentum",
        "category": "trading_strategy",
        "text": "Strategy: Momentum Trading — Buy stocks that are rising and sell stocks that are falling. Follow the trend. Exit when momentum slows (smaller gains each round). Works in trending markets, fails in choppy markets. Best applied to NOVA and LUXE.",
    },
    {
        "id": "strategy_contrarian",
        "category": "trading_strategy",
        "text": "Strategy: Contrarian — Do the opposite of the crowd. When everyone is buying, sell. When everyone is panicking, buy. Requires patience and conviction. High risk but highest returns over time. Watch the activity feed for crowd behavior signals.",
    },
    {
        "id": "strategy_diversification",
        "category": "trading_strategy",
        "text": "Strategy: Diversification — Spread holdings across multiple sectors to reduce risk. Own at least 3 different tickers. When one drops, others may rise. Sacrifices maximum upside for consistent returns. Good for risk level 1-2 agents.",
    },
    {
        "id": "strategy_safe_haven",
        "category": "trading_strategy",
        "text": "Strategy: Safe Haven Rotation — Hold growth stocks (NOVA, LUXE) during calm markets. When trouble appears, rotate into defensive stocks (FOOD, IRON). Requires quick recognition of market shifts. Best for risk level 2-3 agents.",
    },
    {
        "id": "strategy_event_driven",
        "category": "trading_strategy",
        "text": "Strategy: Event-Driven Trading — Trade based on news events. Buy before positive catalysts, sell before negative ones. Use the knowledge base to understand which events affect which stocks. Requires understanding of event→price relationships.",
    },
    {
        "id": "strategy_value",
        "category": "trading_strategy",
        "text": "Strategy: Value Investing — Buy stocks that have fallen below their 'fair value' (roughly their starting price). Hold until they recover. Patient strategy that works over many rounds. Best with FOOD and GRNE which tend to mean-revert.",
    },
    {
        "id": "strategy_all_in",
        "category": "trading_strategy",
        "text": "Strategy: Concentrated Bets — Put all capital into one or two high-conviction picks. Maximum exposure to your best ideas. Can produce the biggest gains OR the biggest losses. Only for risk level 4-5 agents.",
    },
    {
        "id": "strategy_scalping",
        "category": "trading_strategy",
        "text": "Strategy: Scalping — Make many small trades, taking quick 2-3% profits. Don't hold positions for more than 2-3 rounds. Avoids big losses but also misses big moves. Good for volatile stocks like LUXE and NOVA. Best for active agents.",
    },
    {
        "id": "strategy_hedge",
        "category": "trading_strategy",
        "text": "Strategy: Natural Hedging — Always hold some IRON or FOOD alongside growth stocks. When your growth stocks drop, your defensive holdings rise, cushioning the blow. Sacrifices some upside for portfolio stability. Best for risk level 2-3.",
    },

    # ── Cross-Company Relationships (8) ────────────────────
    {
        "id": "rel_nova_medi",
        "category": "cross_company",
        "text": "Relationship: NOVA and MEDI — When TechNova rises on AI news, MediCorp often follows within 1-2 rounds (AI in drug discovery narrative). But they diverge on healthcare-specific news. A MEDI scandal doesn't affect NOVA.",
    },
    {
        "id": "rel_iron_all",
        "category": "cross_company",
        "text": "Relationship: IRON vs Market — IronShield consistently moves inversely to broad market sentiment. When NOVA, LUXE, and GRNE all drop, IRON typically rises 2-4%. The best natural hedge in the market.",
    },
    {
        "id": "rel_food_luxe",
        "category": "cross_company",
        "text": "Relationship: FOOD vs LUXE — These two stocks are near-perfect inverses. When consumer confidence is high, LUXE rises and FOOD flatlines. When confidence drops, money flows from LUXE to FOOD. Never hold both at the same time.",
    },
    {
        "id": "rel_grne_regulation",
        "category": "cross_company",
        "text": "Relationship: GRNE and Regulation — GreenPulse is the most policy-sensitive stock. Favorable energy regulation can lift GRNE 10%+ while other stocks barely move. Watch for government policy events as GRNE-specific catalysts.",
    },
    {
        "id": "rel_nova_luxe",
        "category": "cross_company",
        "text": "Relationship: NOVA and LUXE — Both are 'growth/sentiment' stocks that move together in broad market rallies and selloffs. However, tech-specific news only affects NOVA, and consumer sentiment only affects LUXE. They're correlated but not identical.",
    },
    {
        "id": "rel_medi_food",
        "category": "cross_company",
        "text": "Relationship: MEDI and FOOD — In healthcare scares, both can move — MEDI on direct impact, FOOD on 'safety rotation.' When MEDI drops on a scandal, some money flows to the safety of FOOD. Both are fundamentally different risk profiles.",
    },
    {
        "id": "rel_iron_grne",
        "category": "cross_company",
        "text": "Relationship: IRON and GRNE — Defense and clean energy often move on the same political news but in different directions. A dovish government favors GRNE (green policy) over IRON (defense cuts). A hawkish government does the opposite.",
    },
    {
        "id": "rel_market_wide",
        "category": "cross_company",
        "text": "Relationship: Market-Wide Events — When 'ALL' tickers are affected (rate cuts, crashes), the impact varies by sector. Tech (NOVA) and luxury (LUXE) swing the most. Agriculture (FOOD) barely moves. Defense (IRON) often moves opposite to the crowd.",
    },

    # ── Red Herrings (8) ──────────────────────────────────
    {
        "id": "herring_moon",
        "category": "red_herring",
        "text": "Market folklore: Some traders believe stock performance correlates with lunar cycles. Full moons supposedly cause more volatile trading. There is no evidence for this, but it remains a popular myth among retail traders.",
    },
    {
        "id": "herring_ceo_haircut",
        "category": "red_herring",
        "text": "Trivia: A study once claimed that CEOs with more hair lead better-performing companies. The study was debunked, but it occasionally resurfaces in financial media as a humorous 'indicator.'",
    },
    {
        "id": "herring_sports",
        "category": "red_herring",
        "text": "Market superstition: The 'Super Bowl Indicator' claims markets rise when an NFC team wins the Super Bowl. This has a surprisingly high historical correlation but is pure coincidence with no predictive value.",
    },
    {
        "id": "herring_weather",
        "category": "red_herring",
        "text": "Unverified claim: Some analysts insist that sunny weather in New York leads to more bullish trading, as happy traders take more risks. While mood effects on decision-making are real, using weather as a trading signal is not reliable.",
    },
    {
        "id": "herring_astrology",
        "category": "red_herring",
        "text": "Financial astrology: A surprisingly large community of traders uses astrological charts to time their trades. Mercury retrograde is particularly feared. There is no scientific basis for this approach.",
    },
    {
        "id": "herring_coffee",
        "category": "red_herring",
        "text": "Rumor: An anonymous source claims that TechNova's next product will revolutionize the coffee industry. This seems unrelated to their AI focus and should be treated with extreme skepticism.",
    },
    {
        "id": "herring_twitter",
        "category": "red_herring",
        "text": "Social media buzz: A viral tweet claims LuxeGlobal's CEO was spotted at a rival company's headquarters. Unverified social media reports should never be the sole basis for trading decisions.",
    },
    {
        "id": "herring_fibonacci",
        "category": "red_herring",
        "text": "Technical analysis myth: Some traders swear by Fibonacci retracement levels for predicting price targets. While these levels can sometimes act as self-fulfilling prophecies (because many traders watch them), they have no fundamental basis.",
    },
]


class KnowledgeBase:
    """
    Shared knowledge base using ChromaDB for semantic search.

    Pre-loaded with ~50 documents about companies, sectors, patterns,
    strategies, relationships, and red herrings. Used by all agent brains
    for RAG retrieval (Session 3).
    """

    def __init__(self):
        self.client = chromadb.Client()
        self.collection = None
        self._fallback_docs = KNOWLEDGE_DOCS  # for keyword fallback
        self._embedding_fn = GeminiEmbeddingFunction()

    def initialize(self):
        """Create collection and load all documents."""
        self.collection = self.client.get_or_create_collection(
            name="market_knowledge",
            metadata={"hnsw:space": "cosine"},
            embedding_function=self._embedding_fn,
        )

        # Only load if collection is empty
        if self.collection.count() == 0:
            ids = [doc["id"] for doc in KNOWLEDGE_DOCS]
            documents = [doc["text"] for doc in KNOWLEDGE_DOCS]
            metadatas = [{"category": doc["category"]} for doc in KNOWLEDGE_DOCS]

            self.collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
            )
            logger.info(f"Knowledge base loaded with {len(KNOWLEDGE_DOCS)} documents")

    def search(self, query: str, n_results: int = 5) -> list[str]:
        """
        Semantic search for documents relevant to the query.
        Falls back to keyword search if ChromaDB fails.
        """
        try:
            if self.collection is None:
                return self._keyword_fallback(query, n_results)

            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
            )
            return results["documents"][0] if results["documents"] else []

        except Exception as e:
            logger.warning(f"ChromaDB search failed, using keyword fallback: {e}")
            return self._keyword_fallback(query, n_results)

    def _keyword_fallback(self, query: str, n_results: int) -> list[str]:
        """Simple keyword matching fallback if ChromaDB fails."""
        query_words = set(query.lower().split())
        scored = []
        for doc in self._fallback_docs:
            text_lower = doc["text"].lower()
            score = sum(1 for word in query_words if word in text_lower)
            if score > 0:
                scored.append((score, doc["text"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [text for _, text in scored[:n_results]]
