from typing import Any

from kitty.boss import Boss
from kitty.window import Window


def on_focus_change(boss: Boss, window: Window, data: dict[str, Any]) -> None:
    if not data.get("focused"):
        return

    boss.call_remote_control(
        window,
        (
            "set-tab-title",
            "--match",
            f"window_id:{window.id}",
        ),
    )
