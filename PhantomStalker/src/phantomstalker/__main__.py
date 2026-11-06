"""Точка входу: `phantomstalker` або `python -m phantomstalker`."""

from __future__ import annotations

import argparse

from phantomstalker import __version__


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="phantomstalker", description="Твій фантом. Твої люди. Твій слід.")
    parser.add_argument("--db", help="шлях до бази SQLite (за замовчуванням ~/.phantomstalker/phantom.db)")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    args = parser.parse_args(argv)

    from phantomstalker.app import PhantomStalkerApp
    from phantomstalker.services.settings import load_dotenv

    load_dotenv()
    PhantomStalkerApp(db=args.db).run()


if __name__ == "__main__":
    main()
