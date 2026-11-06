"""Мінімалістичні віджети консолі: стрічка повідомлень, рядок статусу, поле вводу, підказки."""

from __future__ import annotations

from rich.box import ROUNDED
from rich.console import RenderableType
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from textual.binding import Binding
from textual.message import Message
from textual.widgets import Input, Static

from phantomstalker import __version__
from phantomstalker.core.commands import Command, Say
from phantomstalker.core.persona import COLORS, FRAMES, Mood, PersonaEngine

ORANGE = COLORS[Mood.IDLE]
RED = COLORS[Mood.ALERT]


def welcome(name: str, location: str) -> RenderableType:
    ghost = Text("\n".join(row.rstrip() for row in FRAMES[Mood.IDLE][0][1:]), style=ORANGE)
    info = Text()
    info.append(f"PhantomStalker v{__version__}\n", style=f"bold {ORANGE}")
    info.append("Твій фантом. Твої люди. Твій слід.\n\n", style="italic")
    info.append("/help", style=ORANGE)
    info.append(" — команди   ")
    info.append("@ім'я", style=ORANGE)
    info.append(" — нотатки про людину\n")
    info.append(location, style="dim")
    grid = Table.grid(padding=(0, 2))
    grid.add_row(ghost, info)
    return Panel(grid, box=ROUNDED, border_style=ORANGE, expand=False, padding=(0, 1))


def user_line(text: str) -> RenderableType:
    out = Text("> ", style="dim")
    out.append(text, style="dim")
    return out


def bullet(body: RenderableType, color: str = ORANGE) -> RenderableType:
    grid = Table.grid(padding=(0, 1))
    grid.add_column(width=1, no_wrap=True)
    grid.add_column(ratio=1)
    grid.add_row(Text("●", style=color), body)
    return grid


def phantom_message(text: str) -> RenderableType:
    return bullet(Markdown(text) if text else Text(""))


def say(result: Say) -> RenderableType:
    color = RED if result.kind == "error" else ORANGE
    body = Text(result.title, style="bold")
    for i, line in enumerate(result.details):
        body.append("\n")
        body.append("⎿  " if i == 0 else "   ", style="dim")
        body.append(line, style="dim" if result.kind != "error" else "")
    return bullet(body, color)


class Entry(Static):
    """Один запис у стрічці."""

    DEFAULT_CSS = "Entry { margin-bottom: 1; }"

    def __init__(self, body: RenderableType, **kwargs) -> None:
        super().__init__(body, **kwargs)
        self.body = body

    def update(self, body: RenderableType = "", *, layout: bool = True) -> None:  # type: ignore[override]
        self.body = body
        super().update(body, layout=layout)


class StatusLine(Static):
    DEFAULT_CSS = "StatusLine { height: 1; padding: 0 1; }"

    def __init__(self, persona: PersonaEngine, **kwargs) -> None:
        super().__init__(**kwargs)
        self.persona = persona
        self.busy = False

    def render(self) -> RenderableType:
        p = self.persona
        out = Text(p.mini(), style=f"bold {p.color}")
        out.append(f" {p.name}", style=p.color)
        line = p.line.splitlines()[0] if p.line else ""
        if self.busy:
            dots = "." * (p.frame_index % 3 + 1)
            out.append(f"  {line.rstrip('…. ')}{dots}", style=p.color)
            out.append("  (esc — перервати)", style="dim")
        elif line:
            out.append(f"  {line}", style="dim italic")
        return out


class Suggestions(Static):
    DEFAULT_CSS = "Suggestions { height: auto; padding: 0 2; }"

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.items: list[Command] = []
        self.selected = 0

    def show(self, items: list[Command]) -> None:
        self.items = items[:8]
        self.selected = min(self.selected, max(len(self.items) - 1, 0))
        self.refresh(layout=True)

    def move(self, step: int) -> None:
        if self.items:
            self.selected = (self.selected + step) % len(self.items)
            self.refresh()

    @property
    def current(self) -> Command | None:
        return self.items[self.selected] if self.items else None

    def render(self) -> RenderableType:
        if not self.items:
            return Text("/ команди · @ім'я · ↑↓ історія · esc перервати · ctrl+c вихід", style="dim")
        width = max(len(c.name) + len(c.usage) for c in self.items) + 4
        out = Text()
        for i, c in enumerate(self.items):
            if i:
                out.append("\n")
            label = f"/{c.name} {c.usage}".ljust(width)
            style = f"bold {ORANGE}" if i == self.selected else ""
            out.append(label, style=style)
            out.append(c.help, style=ORANGE if i == self.selected else "dim")
        return out


class PromptInput(Input):
    """Поле «> …» з доповненням команд (Tab) та історією (↑/↓)."""

    BINDINGS = [
        Binding("tab", "complete", show=False, priority=True),
        Binding("up", "older", show=False, priority=True),
        Binding("down", "newer", show=False, priority=True),
    ]

    class Complete(Message):
        pass

    class Navigate(Message):
        def __init__(self, step: int) -> None:
            super().__init__()
            self.step = step

    def action_complete(self) -> None:
        self.post_message(self.Complete())

    def action_older(self) -> None:
        self.post_message(self.Navigate(-1))

    def action_newer(self) -> None:
        self.post_message(self.Navigate(+1))
