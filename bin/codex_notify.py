#!/usr/bin/env python3

import json
import os
import subprocess
import shutil
import sys


def main() -> int:
    if len(sys.argv) < 2:
        return 0

    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        return 0

    if payload.get("type") != "agent-turn-complete":
        return 0

    socket = os.environ.get("MW_SOCKET", "")
    base_title = os.environ.get("MW_TAB_TITLE", "codex")
    cwd = os.environ.get("MW_CODEX_CWD", "")
    if not socket or not cwd:
        return 0

    waiting_title = f"{base_title} [waiting]"
    subprocess.run(
        [
            "kitty",
            "@",
            "--to",
            socket,
            "set-tab-title",
            "--match",
            f"env:MW_CODEX_CWD={cwd}",
            waiting_title,
        ],
        check=False,
    )

    send_kitty_notification(waiting_title, cwd)
    return 0


def send_kitty_notification(title: str, cwd: str) -> None:
    kitten = shutil.which("kitten")
    if not kitten:
        return

    identifier = f"magicwork-{abs(hash(cwd))}"
    subprocess.run(
        [
            kitten,
            "notify",
            "--app-name",
            "kitty",
            "--icon",
            "info",
            "--urgency",
            "critical",
            "--expire-after",
            "15s",
            "--identifier",
            identifier,
            title,
            "Codex is waiting for input",
            cwd,
        ],
        check=False,
    )
if __name__ == "__main__":
    raise SystemExit(main())
