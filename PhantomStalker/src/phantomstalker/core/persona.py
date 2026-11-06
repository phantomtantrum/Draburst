"""Рушій персонажа: настрої, ASCII-кадри, репліки та простий цикл анімації."""

from __future__ import annotations

import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum


class Mood(StrEnum):
    IDLE = "idle"
    THINKING = "thinking"
    HAPPY = "happy"
    ALERT = "alert"
    SLEEPING = "sleeping"


def _ghost(eyes: str, mouth: str, hem: str, shift: int = 0, top: str = "") -> list[str]:
    """Збирає один кадр фантома (6 рядків однакової ширини)."""
    pad = " " * shift
    rows = [
        f"{top:<11}",
        "   .---.   ",
        f"  ( {eyes} )  ",
        f"  |  {mouth}  |  ",
        "  |     |  ",
        f"  {hem}  ",
    ]
    width = 13
    return [(pad + row).ljust(width)[:width] for row in rows]


FRAMES: dict[Mood, list[list[str]]] = {
    # спокійне похитування
    Mood.IDLE: [
        _ghost("o o", "‿", "'^'^'^'", 0),
        _ghost("o o", "‿", "^'^'^'^", 1),
        _ghost("- -", "‿", "'^'^'^'", 1),
        _ghost("o o", "‿", "^'^'^'^", 0),
    ],
    # думає — біжать крапки
    Mood.THINKING: [
        _ghost("o O", "~", "'^'^'^'", 0, top="     .     "),
        _ghost("O o", "~", "^'^'^'^", 0, top="     . .   "),
        _ghost("o O", "~", "'^'^'^'", 0, top="     . . . "),
    ],
    # успіх — яскравіший, «усміхнений»
    Mood.HAPPY: [
        _ghost("^ ^", "◡", "'^'^'^'", 0, top="   *   *   "),
        _ghost("^ ^", "▽", "^'^'^'^", 1, top="  *   *    "),
    ],
    # увага / помилка
    Mood.ALERT: [
        _ghost("O O", "□", "'^'^'^'", 0, top="     !     "),
        _ghost("O O", "□", "'^'^'^'", 1, top="     !!    "),
    ],
    # неактивність
    Mood.SLEEPING: [
        _ghost("- -", "-", "'^'^'^'", 0, top="        z  "),
        _ghost("- -", "o", "'^'^'^'", 0, top="       zZ  "),
        _ghost("- -", "-", "'^'^'^'", 0, top="      zZz  "),
    ],
}

# Мініатюрна мордочка для рядка статусу над полем вводу.
MINI: dict[Mood, list[str]] = {
    Mood.IDLE: ["(o o)", "(o o)", "(o o)", "(- -)"],  # зрідка кліпає
    Mood.THINKING: ["(o O)", "(O o)"],
    Mood.HAPPY: ["(^ ^)", "(^‿^)"],
    Mood.ALERT: ["(O O)", "(O_O)"],
    Mood.SLEEPING: ["(- -)", "(- -)"],
}

COLORS: dict[Mood, str] = {
    Mood.IDLE: "#FF8C42",  # тепле помаранчеве світіння
    Mood.THINKING: "#FFA94D",
    Mood.HAPPY: "#FFB75E",  # яскравіший
    Mood.ALERT: "#E8553A",  # бурштиново-червоний акцент
    Mood.SLEEPING: "#8A6A55",  # приглушені кольори
}


@dataclass(frozen=True)
class Reaction:
    mood: Mood
    lines: tuple[str, ...]


REACTIONS: dict[str, Reaction] = {
    "copilot_start": Reaction(
        Mood.THINKING, ("Думаю над формулюванням…", "Хвилинку, підбираю слова…")
    ),
    "copilot_done": Reaction(
        Mood.HAPPY, ("Готово! Глянь, як звучить.", "Тримай — твоїм голосом.")
    ),
    "copilot_error": Reaction(Mood.ALERT, ("Ой, щось пішло не так: {error}",)),
    "copilot_refusal": Reaction(
        Mood.ALERT, ("З цим я не допоможу — спробуймо сформулювати інакше.",)
    ),
    "no_api_key": Reaction(
        Mood.ALERT, ("Мені потрібен ключ API — введи /key.",)
    ),
    "empty_input": Reaction(Mood.ALERT, ("Спершу напиши або встав текст.",)),
    "contact_added": Reaction(Mood.HAPPY, ("Запам'ятав: {name}.", "Новий друг у списку — {name}!")),
    "contact_updated": Reaction(Mood.HAPPY, ("Оновив нотатки: {name}.",)),
    "contact_deleted": Reaction(Mood.IDLE, ("{name} більше немає в списку.",)),
    "contacted": Reaction(Mood.HAPPY, ("Чудово! {name} — відмітив, що ви сьогодні спілкувались.",)),
    "date_added": Reaction(Mood.HAPPY, ("Запишу й нагадаю заздалегідь: {label}.",)),
    "settings_saved": Reaction(Mood.HAPPY, ("Налаштування збережено.", "Готово, я все запам'ятав.")),
    "coming_soon": Reaction(Mood.IDLE, ("Цей модуль ще в розробці — скоро буде!",)),
    "wake": Reaction(Mood.IDLE, ("Я тут! Трохи задрімав…", "О, привіт знову!")),
    "draft_saved": Reaction(Mood.HAPPY, ("Чернетку збережено.",)),
}

GREETINGS: tuple[str, ...] = (
    "Привіт! Я {phantom}. Чим допомогти сьогодні?",
    "Бу! Не лякайся — це просто я, {phantom}.",
    "Знову разом! Що пишемо?",
)


class PersonaEngine:
    """Стан персонажа. Не залежить від UI, тож його легко тестувати."""

    def __init__(
        self,
        name: str = "Phantom",
        *,
        sleep_after: float = 180.0,
        transient_ticks: int = 8,
        clock: Callable[[], float] = time.monotonic,
        rng: random.Random | None = None,
    ) -> None:
        self.name = name
        self.sleep_after = sleep_after
        self.transient_ticks = transient_ticks
        self._clock = clock
        self._rng = rng or random.Random()
        self.mood: Mood = Mood.IDLE
        self.line: str = ""
        self.frame_index = 0
        self._transient_left = 0
        self._last_activity = clock()

    # --- кадри -------------------------------------------------------------
    @property
    def color(self) -> str:
        return COLORS[self.mood]

    def mini(self) -> str:
        faces = MINI[self.mood]
        return faces[self.frame_index % len(faces)]

    def frame(self) -> list[str]:
        frames = FRAMES[self.mood]
        return frames[self.frame_index % len(frames)]

    # --- зміна стану -------------------------------------------------------
    def set_mood(self, mood: Mood, line: str | None = None) -> None:
        if mood != self.mood:
            self.frame_index = 0
        self.mood = mood
        if line is not None:
            self.line = line
        self._transient_left = self.transient_ticks if mood in (Mood.HAPPY, Mood.ALERT) else 0

    def say(self, line: str) -> None:
        self.line = line

    def react(self, event: str, **fmt: object) -> str:
        """Реакція на подію застосунку: змінює настрій і репліку."""
        reaction = REACTIONS[event]
        line = self._rng.choice(reaction.lines).format(phantom=self.name, **fmt)
        self.set_mood(reaction.mood, line)
        self.poke(wake=False)
        return line

    def greet(self, reminder: str | None = None, last_seen: datetime | None = None,
              now: datetime | None = None) -> str:
        now = now or datetime.now()
        if last_seen is not None and now - last_seen > timedelta(days=3):
            line = f"Давно не бачились! {self.name} вже скучав."
        else:
            line = self._rng.choice(GREETINGS).format(phantom=self.name)
        if reminder:
            line = f"{line}\n{reminder}"
        self.set_mood(Mood.HAPPY, line)
        return line

    def poke(self, *, wake: bool = True) -> None:
        """Користувач щось зробив — фантом прокидається."""
        self._last_activity = self._clock()
        if wake and self.mood == Mood.SLEEPING:
            self.react("wake")

    # --- цикл анімації -----------------------------------------------------
    def tick(self) -> None:
        self.frame_index += 1
        if self._transient_left > 0:
            self._transient_left -= 1
            if self._transient_left == 0:
                self.set_mood(Mood.IDLE)
        if self.mood == Mood.IDLE and self._clock() - self._last_activity >= self.sleep_after:
            self.set_mood(Mood.SLEEPING, "Zzz… розбуди, якщо що.")
