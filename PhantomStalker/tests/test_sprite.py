import re
from pathlib import Path

import pytest

from phantomstalker.core.persona import Mood
from phantomstalker.core.sprite import (
    BIG_H,
    BIG_W,
    BODY,
    CYCLES,
    EYES,
    MINI_H,
    MINI_W,
    big_grid,
    mini_grid,
    render,
)
from phantomstalker.core.theme import THEMES, get_theme, set_current

THEME = get_theme("silver")


@pytest.mark.parametrize("mood", list(Mood))
def test_every_pose_renders_within_canvas(mood):
    for tick in range(len(CYCLES[mood])):
        grid = big_grid(mood, tick, THEME)
        assert len(grid) == BIG_H and all(len(r) == BIG_W for r in grid)
        mini = mini_grid(mood, tick, THEME)
        assert len(mini) == MINI_H and all(len(r) == MINI_W for r in mini)
        text = render(grid)
        assert len(text.plain.splitlines()) == BIG_H // 2


def test_eyes_are_holes_in_the_body():
    for name, cells in EYES.items():
        assert cells <= BODY, f"очі «{name}» мають бути всередині тіла"
    grid = big_grid(Mood.IDLE, 0, THEME)
    assert all(grid[y + 1][x] is None for y, x in EYES["open"])


def test_body_symmetric_head():
    head = [(y, x) for y, x in BODY if y < 5]
    xs = {x for _, x in head}
    assert min(xs) + max(xs) == 12  # голова симетрична відносно центру


def test_sleeping_is_dimmer_and_extras_use_accent():
    awake = {c for row in big_grid(Mood.IDLE, 0, THEME) for c in row if c}
    asleep = {c for row in big_grid(Mood.SLEEPING, 0, THEME) for c in row if c}
    assert awake == {THEME.body}
    assert THEME.dim in asleep and THEME.accent in asleep


def test_animation_changes_frames():
    frames = {render(big_grid(Mood.IDLE, t, THEME)).plain for t in range(len(CYCLES[Mood.IDLE]))}
    assert len(frames) > 3


def test_themes_have_no_orange():
    def is_orange(hex_color: str) -> bool:
        r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
        return r > 200 and 90 < g < 190 and b < 110

    for t in THEMES.values():
        for color in (t.body, t.accent, t.dim):
            assert not is_orange(color), (t.name, color)
    src = Path(__file__).parents[1] / "src"
    for path in src.rglob("*.py"):
        assert not re.search(r"#FF8C42|#FFA94D|#FFB75E", path.read_text(encoding="utf-8"), re.I), path


def test_unknown_theme_falls_back():
    assert get_theme("нема").name == "silver"
    assert set_current("mint").name == "mint"
    set_current("silver")
