"""
Market Panic — Price Engine

Geometric Brownian Motion price simulation, trade execution, and portfolio valuation.
"""

from __future__ import annotations

import math
from collections import defaultdict

import numpy as np

from server.models import (
    COMPANIES,
    COMPANY_MAP,
    AgentState,
    MarketEvent,
    Portfolio,
    Trade,
)

# GBM parameters
MU = 0.001       # drift
DT = 1.0 / 252   # one trading day


class MarketEngine:
    """Simulates stock prices using Geometric Brownian Motion with event impacts."""

    def __init__(self):
        self.prices: dict[str, float] = {c.ticker: c.start_price for c in COMPANIES}
        self.price_history: dict[str, list[float]] = {
            c.ticker: [c.start_price] for c in COMPANIES
        }

    def reset(self):
        """Reset prices to starting values."""
        self.prices = {c.ticker: c.start_price for c in COMPANIES}
        self.price_history = {c.ticker: [c.start_price] for c in COMPANIES}

    def tick(self, active_events: list[MarketEvent], current_round: int) -> dict[str, float]:
        """
        Advance prices by one round using GBM + event impacts.

        Returns the new prices dict.
        """
        new_prices: dict[str, float] = {}

        for company in COMPANIES:
            ticker = company.ticker
            price = self.prices[ticker]
            sigma = company.volatility

            # GBM step: S(t+1) = S(t) * exp((mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)
            z = np.random.standard_normal()
            gbm_factor = math.exp(
                (MU - 0.5 * sigma**2) * DT + sigma * math.sqrt(DT) * z
            )
            new_price = price * gbm_factor

            # Apply event impacts (multiplicative with decay)
            for event in active_events:
                if ticker in event.affected_tickers or "ALL" in event.affected_tickers:
                    rounds_elapsed = current_round - event.round_injected
                    decay = max(0.0, 1.0 - rounds_elapsed / event.duration_rounds)
                    new_price *= 1.0 + event.impact * decay

            # Price floor
            new_price = max(1.0, round(new_price, 2))
            new_prices[ticker] = new_price

        # Update state
        self.prices = new_prices
        for ticker, price in new_prices.items():
            self.price_history[ticker].append(price)

        return new_prices

    def apply_order_pressure(self, trades: list[Trade]) -> dict[str, float]:
        """
        Adjust prices based on net buy/sell pressure from agent trades.
        Call AFTER tick() and AFTER trade execution.
        """
        # Count buy/sell volume per ticker
        buy_vol: dict[str, int] = defaultdict(int)
        sell_vol: dict[str, int] = defaultdict(int)

        for trade in trades:
            if trade.action == "BUY" and trade.ticker:
                buy_vol[trade.ticker] += trade.amount
            elif trade.action == "SELL" and trade.ticker:
                sell_vol[trade.ticker] += trade.amount

        # Scale pressure with number of participating agents (diminishing returns)
        active_trades = len([t for t in trades if t.action in ("BUY", "SELL") and t.amount > 0])
        agent_scale = min(active_trades / 10, 3.0)  # caps at 3x for 30+ agents

        for ticker in self.prices:
            total = buy_vol[ticker] + sell_vol[ticker]
            if total > 0:
                net_pressure = (buy_vol[ticker] - sell_vol[ticker]) / total
                self.prices[ticker] *= 1.0 + net_pressure * 0.02 * max(agent_scale, 1.0)
                self.prices[ticker] = max(1.0, round(self.prices[ticker], 2))
                # Update last history entry with pressure-adjusted price
                self.price_history[ticker][-1] = self.prices[ticker]

        return self.prices

    def get_price_changes(self) -> dict[str, float]:
        """Get percentage change from previous round for each ticker."""
        changes: dict[str, float] = {}
        for ticker, history in self.price_history.items():
            if len(history) >= 2:
                prev = history[-2]
                curr = history[-1]
                changes[ticker] = ((curr - prev) / prev) * 100.0 if prev > 0 else 0.0
            else:
                changes[ticker] = 0.0
        return changes

    def get_history(self) -> dict[str, list[float]]:
        """Return full price history for charting."""
        return self.price_history


def execute_trade(agent: AgentState, trade: Trade, prices: dict[str, float]) -> Trade:
    """
    Execute a single trade against an agent's portfolio.

    Validates affordability/holdings, updates portfolio, returns the trade
    with the execution price filled in.
    """
    portfolio = agent.portfolio

    if trade.action == "BUY" and trade.ticker:
        price = prices.get(trade.ticker, 0.0)
        cost = price * trade.amount
        if cost > portfolio.cash:
            # Can't afford — buy max affordable
            trade.amount = int(portfolio.cash // price) if price > 0 else 0
            cost = price * trade.amount
        if trade.amount > 0:
            portfolio.cash -= cost
            portfolio.holdings[trade.ticker] = portfolio.holdings.get(trade.ticker, 0) + trade.amount
            trade.price = price

    elif trade.action == "SELL" and trade.ticker:
        held = portfolio.holdings.get(trade.ticker, 0)
        if trade.amount > held:
            trade.amount = held
        if trade.amount > 0:
            price = prices.get(trade.ticker, 0.0)
            portfolio.cash += price * trade.amount
            portfolio.holdings[trade.ticker] = held - trade.amount
            if portfolio.holdings[trade.ticker] == 0:
                del portfolio.holdings[trade.ticker]
            trade.price = price

    # HOLD and CHAT don't modify portfolio
    return trade


def calculate_portfolio_value(portfolio: Portfolio, prices: dict[str, float]) -> float:
    """Total value = cash + sum(shares * current_price)."""
    holdings_value = sum(
        shares * prices.get(ticker, 0.0)
        for ticker, shares in portfolio.holdings.items()
    )
    return round(portfolio.cash + holdings_value, 2)


def get_rankings(agents: list[AgentState], prices: dict[str, float]) -> list[dict]:
    """
    Rank agents by total portfolio value.

    Returns list of dicts with rank, name, portfolio_value, last_action, status.
    """
    ranked = []
    for agent in agents:
        value = calculate_portfolio_value(agent.portfolio, prices)
        last_action = ""
        if agent.decisions:
            last = agent.decisions[-1]
            if last.action in ("BUY", "SELL") and last.ticker:
                last_action = f"{last.action} {last.ticker}"
            elif last.action == "CHAT":
                last_action = "CHAT"
            else:
                last_action = "HOLD"
        ranked.append({
            "name": agent.name,
            "portfolio_value": value,
            "last_action": last_action,
            "status": agent.status,
        })

    ranked.sort(key=lambda x: x["portfolio_value"], reverse=True)
    for i, entry in enumerate(ranked):
        entry["rank"] = i + 1

    return ranked
