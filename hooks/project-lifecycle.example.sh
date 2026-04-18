#!/bin/sh

set -eu

event="${1:-}"
worktree="${MW_TASK_WORKTREE:-}"
repo="${MW_TASK_REPO:-}"

log() {
  printf '[hook] %s\n' "$*"
}

is_javascript_repo() {
  [ -f "${worktree}/package.json" ]
}

case "${event}" in
  onCodeTabOpen)
    log "event=onCodeTabOpen task=${MW_TASK_NAME:-} repo=${repo}"

    if ! is_javascript_repo; then
      log "skip: no package.json found"
      exit 0
    fi

    cd "${worktree}"

    # Put project-specific bootstrap logic here.
    #
    # Example ideas:
    # - install dependencies
    # - copy local env templates
    # - start dev services
    # - choose ports and write local config
    #
    # Keep this file generic in the public repo. For private workflows,
    # point config hooks to your own script outside the repository.
    log "example hook matched a JavaScript repository; no-op by default"
    exec "${SHELL:-/bin/sh}" -l
    ;;
  onClean)
    log "event=onClean task=${MW_TASK_NAME:-} repo=${repo}"

    # Put project-specific cleanup logic here.
    #
    # Example ideas:
    # - drop local databases
    # - stop background services
    # - remove generated cache/state
    log "example clean hook is a no-op"
    exit 0
    ;;
  *)
    log "unknown event: ${event}"
    exit 0
    ;;
esac
