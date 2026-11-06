import random
from datetime import datetime, timedelta

from phantomstalker.core.persona import COLORS, FRAMES, REACTIONS, Mood, PersonaEngine


class FakeClock:
    def __init__(self) -> None:
        self.t = 0.0

    def __call__(self) -> float:
        return self.t


def make(**kw) -> tuple[PersonaEngine, FakeClock]:
    clock = FakeClock()
    return PersonaEngine("Каспер", clock=clock, rng=random.Random(0), **kw), clock


def test_every_mood_has_frames_and_color():
    for mood in Mood:
        assert FRAMES[mood], mood
        assert mood in COLORS
        widths = {len(row) for frame in FRAMES[mood] for row in frame}
        assert len(widths) == 1, f"кадри {mood} мають різну ширину"


def test_tick_cycles_frames():
    p, _ = make()
    seen = set()
    for _ in range(len(FRAMES[Mood.IDLE])):
        seen.add(tuple(p.frame()))
        p.tick()
    assert len(seen) == len(FRAMES[Mood.IDLE])


def test_transient_moods_return_to_idle():
    p, _ = make(transient_ticks=3)
    p.react("copilot_done")
    assert p.mood is Mood.HAPPY
    for _ in range(3):
        p.tick()
    assert p.mood is Mood.IDLE


def test_thinking_is_not_transient():
    p, _ = make(transient_ticks=2)
    p.react("copilot_start")
    for _ in range(10):
        p.tick()
    assert p.mood is Mood.THINKING


def test_falls_asleep_and_wakes_on_poke():
    p, clock = make(sleep_after=60)
    clock.t = 61
    p.tick()
    assert p.mood is Mood.SLEEPING
    p.poke()
    assert p.mood is Mood.IDLE
    assert p.line in REACTIONS["wake"].lines


def test_react_formats_line_with_name():
    p, _ = make()
    line = p.react("contact_added", name="Олена")
    assert "Олена" in line
    assert p.line == line


def test_greet_includes_reminder_and_long_absence():
    p, _ = make()
    now = datetime(2026, 11, 6, 12, 0)
    line = p.greet("Давно не було зв'язку: Олена", last_seen=now - timedelta(days=10), now=now)
    assert "Давно не бачились" in line
    assert "Олена" in line
    assert p.mood is Mood.HAPPY
