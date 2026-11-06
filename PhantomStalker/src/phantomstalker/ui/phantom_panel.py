"""Ліва панель: анімований фантом, його репліка та статус."""

from __future__ import annotations

from rich.console import Group
from rich.text import Text
from textual.widgets import Static

from phantomstalker.core.persona import PersonaEngine

TICK_SECONDS = 0.6


class PhantomPanel(Static):
    DEFAULT_CSS = """
    PhantomPanel {
        width: 30;
        height: 100%;
        padding: 0 1;
        border: round $primary;
        border-title-color: $primary;
    }
    """

    def __init__(self, persona: PersonaEngine, *, animate: bool = True, **kwargs) -> None:
        super().__init__(**kwargs)
        self.persona = persona
        self.animate_frames = animate

    def on_mount(self) -> None:
        self.border_title = f"~{self.persona.name.lower()}~"
        if self.animate_frames:
            self.set_interval(TICK_SECONDS, self._tick)

    def _tick(self) -> None:
        self.persona.tick()
        self.refresh()

    def sync(self) -> None:
        """Викликати після зміни стану персонажа ззовні."""
        self.border_title = f"~{self.persona.name.lower()}~"
        self.refresh()

    def render(self) -> Group:
        p = self.persona
        ghost = Text("\n".join(p.frame()), style=f"bold {p.color}")
        name = Text(f"\n{p.name}", style=f"bold {p.color}")
        status = Text(f"[{p.mood.value}]", style=p.color)
        line = Text(f"\n{p.line}" if p.line else "", style="italic")
        return Group(ghost, name, status, line)
