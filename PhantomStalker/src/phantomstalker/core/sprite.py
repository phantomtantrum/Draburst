"""Піксельний фантом «Хвостик»: силует з ручками й закрученим хвостом.

Малюється напівблоками ▀ ▄ (один піксель = половина клітинки, тож пікселі квадратні).
Тіло — суцільний колір теми, очі — «дірки», крізь які видно фон терміналу.
"""

from __future__ import annotations

from dataclasses import dataclass

from rich.style import Style
from rich.text import Text

from phantomstalker.core.persona import Mood
from phantomstalker.core.theme import Theme

Cell = tuple[int, int]  # (рядок, стовпець)
Grid = list[list[str | None]]


def _cells(*rows: str, char: str = "#") -> set[Cell]:
    return {(y, x) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == char}


def _shift(cells: set[Cell], dy: int = 0, dx: int = 0) -> set[Cell]:
    return {(y + dy, x + dx) for y, x in cells}


# --- великий фантом (14×12) ----------------------------------------------------------
BODY = _cells(
    "....#####.....",
    "...#######....",
    "..#########...",
    "..#########...",
    ".###########..",
    "...#######....",
    "...########...",
    "....#######...",
    ".....######...",
)
TAILS = [  # хвіст колихається між двома фазами
    _shift(_cells("......#####...", "........###...", ".........##..."), dy=9),
    _shift(_cells("......#####...", "........####..", "..........##.."), dy=9),
]
ARMS = {
    "down": {(5, 0), (5, 1), (5, 11), (5, 12)},
    "up": {(4, 0), (3, 0), (4, 12), (3, 12)},
    "wave": {(5, 0), (5, 1), (4, 12), (3, 13), (2, 13)},
}
EYES: dict[str, set[Cell]] = {  # пікселі, які вирізаються з тіла
    "open": {(2, 4), (3, 4), (2, 8), (3, 8)},
    "left": {(2, 3), (3, 3), (2, 7), (3, 7)},
    "right": {(2, 5), (3, 5), (2, 9), (3, 9)},
    "blink": {(3, 4), (3, 8)},
    "up": {(2, 5), (2, 9)},
    "alert": {(2, 3), (2, 4), (3, 3), (3, 4), (2, 8), (2, 9), (3, 8), (3, 9), (6, 6)},
    "sleep": {(3, 3), (3, 4), (3, 8), (3, 9)},
}
# Пікселі акцентного кольору довкола: думки, «!», «z».
EXTRAS: dict[str, set[Cell]] = {
    "dot1": {(2, 15)},
    "dot2": {(2, 15), (0, 17)},
    "dot3": {(2, 15), (0, 17), (0, 19)},
    "bang": {(0, 16), (1, 16), (2, 16), (4, 16)},
    "z1": _shift(_cells("##", ".#", "##"), 2, 15),
    "z2": _shift(_cells("###", "..#", ".#.", "###"), 0, 17) | _shift(_cells("##", ".#", "##"), 3, 15),
}

BIG_W, BIG_H = 20, 14  # місце для похитування (+1 рядок) і для думок праворуч


@dataclass(frozen=True)
class Pose:
    eyes: str = "open"
    arms: str = "down"
    tail: int = 0
    dy: int = 0
    extra: str = ""


P = Pose
CYCLES: dict[Mood, list[Pose]] = {
    Mood.IDLE: [
        P(), P(tail=1), P(dy=1, tail=1), P(dy=1),
        P(), P(eyes="blink", tail=1), P(dy=1, tail=1), P(dy=1),
        P(eyes="left"), P(eyes="left", tail=1), P(dy=1, tail=1), P(eyes="right", dy=1),
        P(eyes="right"), P(arms="wave", tail=1), P(arms="wave", dy=1, tail=1), P(dy=1),
    ],
    Mood.THINKING: [
        P(eyes="up", extra="dot1"), P(eyes="up", tail=1, extra="dot2"),
        P(eyes="up", dy=1, tail=1, extra="dot3"), P(eyes="up", dy=1),
    ],
    Mood.HAPPY: [
        P(arms="up"), P(arms="up", dy=1, tail=1),
        P(arms="down", tail=1), P(arms="up", dy=1),
    ],
    Mood.ALERT: [P(eyes="alert", arms="up", extra="bang"), P(eyes="alert", arms="up", tail=1, extra="bang")],
    Mood.SLEEPING: [
        P(eyes="sleep", dy=1, extra="z1"), P(eyes="sleep", dy=1, extra="z1"),
        P(eyes="sleep", dy=1, tail=1, extra="z2"), P(eyes="sleep", dy=1, tail=1, extra="z2"),
    ],
}


def pose(mood: Mood, tick: int) -> Pose:
    cycle = CYCLES[mood]
    return cycle[tick % len(cycle)]


def big_grid(mood: Mood, tick: int, theme: Theme) -> Grid:
    p = pose(mood, tick)
    body = theme.dim if mood is Mood.SLEEPING else theme.body
    pixels = (BODY | TAILS[p.tail] | ARMS[p.arms]) - EYES[p.eyes]
    grid: Grid = [[None] * BIG_W for _ in range(BIG_H)]
    for y, x in pixels:
        grid[y + 1 + p.dy][x] = body
    for y, x in EXTRAS.get(p.extra, ()):
        grid[y][x] = theme.accent
    return grid


# --- маленький фантом (9×6) для рядка статусу ------------------------------------------------
MINI_BODY = _cells(
    "..#####..",
    ".#######.",
    "..#####..",
    "..#####..",
    "...####..",
    ".....##..",
)
MINI_ARMS = {"down": {(2, 0), (2, 8)}, "up": {(1, 0), (0, 0), (1, 8), (0, 8)}, "wave": {(2, 0), (1, 8), (0, 8)}}
MINI_EYES = {
    "open": {(1, 3), (1, 5)},
    "left": {(1, 2), (1, 4)},
    "right": {(1, 4), (1, 6)},
    "blink": set(),
    "up": {(1, 4), (1, 6)},
    "alert": {(1, 3), (1, 5), (3, 4)},
    "sleep": set(),
}
MINI_W, MINI_H = 9, 6


def mini_grid(mood: Mood, tick: int, theme: Theme) -> Grid:
    p = pose(mood, tick)
    body = theme.dim if mood is Mood.SLEEPING else theme.body
    pixels = (MINI_BODY | MINI_ARMS[p.arms]) - MINI_EYES[p.eyes]
    grid: Grid = [[None] * MINI_W for _ in range(MINI_H)]
    for y, x in pixels:
        grid[y][x] = body
    return grid


# --- рендер напівблоками ---------------------------------------------------------------------
def render(grid: Grid) -> Text:
    """Кожна клітинка — верхній і нижній піксель; прозоре лишається фоном терміналу."""
    if len(grid) % 2:
        grid = [*grid, [None] * len(grid[0])]
    out = Text(no_wrap=True, overflow="crop")
    for y in range(0, len(grid), 2):
        if y:
            out.append("\n")
        for top, bottom in zip(grid[y], grid[y + 1], strict=True):
            if top and bottom:
                out.append("▀", Style(color=top, bgcolor=bottom))
            elif top:
                out.append("▀", Style(color=top))
            elif bottom:
                out.append("▄", Style(color=bottom))
            else:
                out.append(" ")
    return out
