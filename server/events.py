"""
Market Panic — Event System

Event injection, decay, severity→impact mapping, and scenario loading.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from server.models import MarketEvent, SEVERITY_IMPACT


class EventEngine:
    """Manages market events: injection, decay, and impact calculation."""

    def __init__(self):
        self.active_events: list[MarketEvent] = []
        self.event_history: list[MarketEvent] = []
        self.scenarios: dict[str, list[dict]] = {}
        self._load_scenarios()

    def _load_scenarios(self):
        """Load pre-built scenarios from scenarios.yaml."""
        scenarios_path = Path(__file__).parent / "scenarios.yaml"
        if scenarios_path.exists():
            with open(scenarios_path, "r") as f:
                self.scenarios = yaml.safe_load(f) or {}

    def inject_event(self, event: MarketEvent, current_round: int) -> MarketEvent:
        """Inject a new event into the market."""
        event.round_injected = current_round
        self.active_events.append(event)
        self.event_history.append(event)
        return event

    def get_active(self, current_round: int) -> list[MarketEvent]:
        """Return events that have started AND haven't fully decayed."""
        self.active_events = [
            e for e in self.active_events
            if e.round_injected <= current_round  # must have started
            and (current_round - e.round_injected) < e.duration_rounds  # not expired
        ]
        return self.active_events

    def inject_scenario(self, scenario_name: str, current_round: int) -> list[MarketEvent]:
        """
        Load a named scenario and queue its events relative to current round.

        Returns list of injected events.
        """
        scenario = self.scenarios.get(scenario_name, [])
        injected = []
        for event_data in scenario:
            round_offset = event_data.get("round_offset", 0)
            event = MarketEvent(
                headline=event_data["headline"],
                category=event_data["category"],
                affected_tickers=event_data["affected_tickers"],
                severity=event_data["severity"],
                is_true=event_data.get("is_true", True),
                duration_rounds=event_data.get("duration_rounds", 3),
                round_injected=current_round + round_offset,
            )
            self.active_events.append(event)
            self.event_history.append(event)
            injected.append(event)
        return injected

    def get_scenario_names(self) -> list[str]:
        """Return available scenario names."""
        return list(self.scenarios.keys())

    def get_scenario_preview(self, name: str) -> list[dict]:
        """Return the events in a scenario for preview."""
        return self.scenarios.get(name, [])

    def clear(self):
        """Clear all active events."""
        self.active_events.clear()
