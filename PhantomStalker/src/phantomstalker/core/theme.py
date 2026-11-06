"""Колірні теми персонажа й інтерфейсу."""

from __future__ import annotations

from dataclasses import dataclass


def _dim(hex_color: str, factor: float = 0.6) -> str:
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return "#{:02X}{:02X}{:02X}".format(*(round(c * factor) for c in (r, g, b)))


@dataclass(frozen=True)
class Theme:
    name: str
    label: str
    body: str    # тіло фантома
    accent: str  # думки, «!», виділення в інтерфейсі

    @property
    def dim(self) -> str:
        """Приглушене тіло для сну."""
        return _dim(self.body)


ERROR = "#F87171"
TEXT = "#E4E4E7"
MUTED = "#8E8E99"

THEMES: dict[str, Theme] = {
    t.name: t
    for t in (
        Theme("silver", "сріблястий", "#DADEEA", "#8FC7FF"),
        Theme("lavender", "лавандовий", "#C4B8FA", "#E2D9FF"),
        Theme("mint", "м'ятний", "#9FE8D0", "#D6FFF2"),
        Theme("ice", "крижаний", "#A9D4FF", "#E3F1FF"),
        Theme("pink", "рожевий", "#F5B5CF", "#FFE0EC"),
        Theme("white", "білий", "#F4F5F8", "#8FC7FF"),
    )
}
DEFAULT_THEME = "silver"


def get_theme(name: str | None) -> Theme:
    return THEMES.get((name or "").strip().casefold(), THEMES[DEFAULT_THEME])


_current: Theme = THEMES[DEFAULT_THEME]


def current() -> Theme:
    """Активна тема (її читає інтерфейс під час рендеру)."""
    return _current


def set_current(name: str | None) -> Theme:
    global _current
    _current = get_theme(name)
    return _current
