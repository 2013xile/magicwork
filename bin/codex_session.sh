#!/bin/zsh

set -u

if [ "$#" -lt 1 ]; then
  echo "usage: codex_session.sh <command> [args...]" >&2
  exit 1
fi

export MW_SESSION_STARTED_AT_MS="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"

if [ -n "${MW_REGISTER_SESSION_SCRIPT:-}" ] && [ -f "${MW_REGISTER_SESSION_SCRIPT}" ]; then
  node "${MW_REGISTER_SESSION_SCRIPT}" >/dev/null 2>&1 &
fi

"$@"
