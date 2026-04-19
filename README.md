# MagicWork

[中文说明](./README.zh-CN.md)

MagicWork is a Markdown-first AI development workflow for planning, launching, resuming, and cleaning up parallel coding-agent tasks with isolated git worktrees, task cards, resumable agent sessions, and terminal automation.

The current reference implementation targets `Codex + kitty`, but the core idea is broader: treat AI-assisted development as a daily operating system. Write tasks once, launch isolated workspaces fast, resume the right agent session later, and use terminal-level signals such as notifications and quick switching to move attention across parallel work.

## Prompt To Recreate Or Adapt This Project

Use the prompt below if you want an AI to build a similar system for your own stack.

````text
Build a local AI development workflow tool called <PROJECT_NAME>.

I do not want just another task runner. I want a daily operating system for AI-assisted software development.

Product goal:
- Every day starts from Markdown task cards grouped by date.
- Each task card represents one concrete stream of work for a coding agent.
- Each stream gets its own isolated git worktree, working branch, terminal workspace, and resumable agent session.
- I want to move across multiple parallel AI tasks the way I move across teammates: resume context, notice who is waiting on me, and jump back into the exact workspace that needs attention.
- The system should leave useful work traces automatically instead of depending on manual reporting.
- It should generate per-task summaries automatically so progress can be reviewed later.
- It should support project-specific setup and cleanup through hooks, so the core stays generic while repositories can still bootstrap themselves.

Core design:
- Separate these paths clearly:
  - osRoot: config and runtime state only
  - recordsDir: task cards and summaries
  - codeDir: generated worktrees only
- recordsDir and codeDir must be explicitly configured.
- Use one Markdown card per task as the source of truth.
- Carry unfinished active tasks into the next day by default.

Development constraints:
- Task cards are stable human-authored configuration.
- Runtime state and task cards must be strictly separated.
- Agent session resume is a core capability, not an optional extra.
- Notifications and window switching are part of the workflow, not afterthoughts.
- Project-specific initialization logic must not be hardcoded in the core; use hooks or external scripts.

Required behavior:
- `init`
  - create the date folder if missing
  - create 5 new task cards every time it runs
  - if the day already exists, append instead of overwriting
- `run`
  - create worktrees and launch one terminal workspace per task
  - by default only launch tasks that have not been launched before
- `restore`
  - reopen active task workspaces without reinitializing the environment and without resending the initial prompt
  - if a saved session id exists, resume the previous coding-agent session
- `clean`
  - remove one or more worktrees and branches
- `finish`
  - generate a final task summary
  - mark the task as done
  - then clean up the worktree and branch
  - support `--no-summary`
- `report`
  - generate or append a summary without cleanup
- `config`
  - initialize and inspect configuration

Execution model:
- One task = one isolated worktree + one terminal workspace.
- The terminal layout can vary, but a strong reference pattern is:
  - one agent tab
  - one editor tab
  - one code/setup tab
- Focus should land on the agent tab after launch.
- Restore should reopen the workspace without replaying the initial prompt.

Session, notification, and switching model:
- If the coding agent supports resumable sessions, store the session id in runtime state and use it on restore.
- If the agent stores conversation logs in structured session files such as jsonl, keep only the session id in runtime state and derive summaries from the original conversation source when needed.
- The terminal layer should expose attention signals when the agent is waiting for user input.
- The terminal layer should use a shared remote-control socket or equivalent so all task windows can be discovered and controlled consistently.
- Fast switching between task windows should be easy, for example through a helper like `kls`.

For a `Codex + kitty` implementation, use this concrete reference:
- Run all task windows against one shared kitty socket such as `unix:/tmp/kitty.sock`.
- Detect Codex waiting-for-input events and reflect them in the terminal UI.
- When a task enters a waiting state:
  - update the tab title to something like `<task> [waiting]`
  - emit a kitty notification so I notice it immediately
  - keep enough metadata to jump back to the exact task window fast
- Implement a shell helper like `kls` on top of `kitty @ ls` plus `fzf` so I can jump to any task window quickly.

Useful references:
- Codex notifications: https://developers.openai.com/codex/config-advanced#notifications
- Kitty notify kitten: https://sw.kovidgoyal.net/kitty/kittens/notify/
- Kitty remote control: https://sw.kovidgoyal.net/kitty/remote-control/

For hook support, use this concrete reference from the current repository:
- Configure lifecycle scripts outside task cards and outside the core logic, then inject them through config keys such as `onCodeTabOpen` and `onClean`.
- Run the startup hook inside the task’s code/setup tab so repository-specific initialization happens inside the task workspace instead of blocking the current shell.
- Run the cleanup hook before worktree and branch removal so repositories can release local resources such as databases or caches.

For automatic summaries and work traces, use this concrete reference from the current repository:
- Generate summaries per task, not as one summary for the whole day.
- Tie summary generation to explicit task actions: `finish` should generate the final summary before cleanup, and `report` can generate or append a summary without cleanup.
- Keep runtime state small and use the saved session id to go back to the original agent session source when generating summaries.
- Use the saved `sessionId` to locate the original agent session history and derive summaries from that source so work traces stay reliable.
- If the worktree is missing but the saved session record still exists, summaries should still be generated from the original agent session source instead of being skipped.

Extensibility:
- Do not hardcode project-specific repository logic into the core.
- Provide lifecycle hooks or external scripts for setup and cleanup.
- Typical hook responsibilities include dependency installation, env bootstrapping, local database creation, service startup, and cleanup.

Implementation preferences:
- Use a single CLI entrypoint.
- Prefer simple local files over databases for runtime state.
- Keep the code pragmatic and easy to inspect.
- Write the README around product capabilities and workflow concepts, not just command syntax.
````

## What It Does

- Creates daily task cards under a date folder.
- Maps each task to its own git branch and git worktree.
- Launches one terminal workspace per task.
- Tracks active tasks and saved session ids outside the task cards.
- Restores active workspaces later without re-sending the initial prompt.
- Generates task summaries during `finish`, unless you explicitly skip them with `--no-summary`.
- Supports project-specific bootstrap and cleanup through lifecycle hooks.

## Architecture

MagicWork separates three kinds of paths:

- `osRoot`
  - config and runtime state only
  - default: `~/.config/magicwork`
- `recordsDir`
  - date folders, task cards, indexes, summaries
  - must be configured explicitly
- `codeDir`
  - generated git worktrees only
  - must be configured explicitly

Optional:

- `defaultRepo`
  - default source repository for new task cards
- `hooks`
  - external lifecycle scripts for project-specific bootstrap and cleanup

## Daily Records Layout

Each day under `recordsDir` looks like this:

```text
YYYY-MM-DD/
  tasks/
    01-task-1.md
    02-task-2.md
    ...
  summaries/
    01-task-1.md
    02-task-2.md
    ...
```

Meaning:

- `tasks/*.md`
  - source of truth
  - edited by you
- `summaries/*.md`
  - generated task summaries
  - appended by `report` or `finish`

## Installation

MagicWork is currently a local CLI script. A simple way to install it is to symlink `bin/magicwork` into a directory already on your `PATH`.

Example:

```bash
chmod +x bin/magicwork
ln -sf "$(pwd)/bin/magicwork" /usr/local/bin/mw
```

If you do not want a global command, you can run it directly:

```bash
./bin/magicwork help
```

Reference implementation requirements:

- `git`
- `node`
- `kitty`
- `python3`
- `codex`

Suggested global install:

```bash
chmod +x bin/magicwork
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/magicwork" ~/.local/bin/mw
```

Make sure `~/.local/bin` is on your `PATH`.

## Kitty Socket And Quick Switching

The current implementation controls kitty through a shared remote-control socket. By default it uses:

```text
unix:/tmp/kitty.sock
```

This matters for two reasons:

- MagicWork can create and restore task workspaces reliably.
- You can build helper commands such as `kls` to quickly jump across any kitty window or tab.

You can either let MagicWork start a kitty instance on that socket automatically, or make all your kitty instances use the same socket yourself.

Example startup:

```bash
kitty --listen-on unix:/tmp/kitty.sock
```

MagicWork also supports overriding the socket:

```bash
mw run --socket unix:/tmp/kitty.sock
mw restore --socket unix:/tmp/kitty.sock
```

If you want a quick-switch helper in shell, a simple pattern is to wrap `kitty @ ls` on the shared socket and feed the results into `fzf`.

Example `~/.zshrc` function:

```bash
kls() {
  local socket="${KITTY_SOCKET:-unix:/tmp/kitty.sock}"
  local target
  target="$(
    kitty @ --to "$socket" ls | jq -r '
      .[] as $os
      | $os.tabs[]
      | . as $tab
      | $tab.windows[]
      | "\(.id)\t\($tab.title // "-")\t\(.title // "-")"
    ' | fzf
  )" || return 1

  local window_id
  window_id="$(printf '%s\n' "$target" | cut -f1)"
  [ -n "$window_id" ] || return 1
  kitty @ --to "$socket" focus-window --match "id:$window_id"
}
```

That example is intentionally generic. You can replace it with your own `kls` implementation.

## Configuration

Initialize config:

```bash
mw config init \
  --os-root ~/.config/magicwork \
  --records-dir /path/to/magicwork-records \
  --code-dir /path/to/magicwork-code \
  --default-repo /path/to/default-repo \
  --hook-on-code-tab-open /path/to/hook.sh \
  --hook-on-clean /path/to/hook.sh
```

Show current config:

```bash
mw config show
```

## Commands

Create today’s task cards:

```bash
mw init
```

Running `mw init` again on the same day appends 5 more task cards.

Launch today’s tasks:

```bash
mw run
mw run 3
mw run 1 3 5
```

By default, `mw run` launches only tasks that have not been launched before. To relaunch already active tasks, use:

```bash
mw run --rerun-launched
```

You can also point to a specific day directory or task card:

```bash
mw run /path/to/records/2026-04-18
mw run /path/to/records/2026-04-18/tasks/01-task-1.md
```

Restore active task windows:

```bash
mw restore
mw restore 1
mw restore task-1234
```

Clean worktrees and branches:

```bash
mw clean 1 3
mw clean --all
mw finish 1 3
```

`mw clean` only removes runtime state, worktrees, and branches. It does not mark a task as done.

Finish tasks with summary and cleanup:

```bash
mw finish 1
mw finish --all
mw finish 1 --no-summary
```

Generate summaries without cleanup:

```bash
mw report 1
mw report --all
```

## Task Card Format

Example:

````md
---
name: "Fix auth button"
status: "todo"
workdir: "/path/to/repo"
baseBranch: "main"
newBranch: ""
hooks:
  - onBeforeLaunch
  - onCodeTabOpen
  - onClean
workspaceRepos:
  - source: "git@github.com:your-org/admin-ui.git"
    dest: ".deps/admin-ui"
    branch: "main"
    pull: true
---

```prompt
Read the relevant page, locate the root cause, implement the fix, and verify it.
```
````

Notes:

- front matter is the task configuration source
- `status` uses `todo | doing | done`
- `status: "done"` means the task is finished and will not be launched by `run`
- `run` promotes `todo` tasks to `doing`
- a task with an empty `prompt` stays as a draft and will not be launched by `run`
- `prompt` is the initial agent prompt
- `newBranch` can be left empty for auto-generation
- `hooks` controls which lifecycle hook events are enabled for that task
- for example, `hooks: [onClean]` skips the startup hook but keeps cleanup enabled
- `workspaceRepos` is an optional custom field that can be consumed by your own hook scripts
- `workspaceRepos[].pull` defaults to `false`; repositories are synced only when you explicitly set `pull: true`
- `workspaceRepos[].dest` is the final target directory, not a parent directory
- for example, `dest: ".deps/admin-ui"` clones into `<task-worktree>/.deps/admin-ui`

## Session Tracking And Restore

MagicWork treats task cards as static configuration and keeps runtime state elsewhere.

- Active task state is stored under `osRoot`
- `restore` resumes the saved session if the current agent supports session resume
- Summaries are generated from the original agent session history referenced by `sessionId`

In the current reference implementation, session tracking is based on Codex session ids and `~/.codex/sessions/*.jsonl`.

## Summaries And Work Traces

MagicWork treats summaries and work traces as part of the workflow design, not as an afterthought.

The core idea is:

- keep task cards as stable input
- keep runtime state lightweight
- keep the original agent session as the source of truth
- generate summaries per task instead of writing one large summary for the whole day

In practice, this means:

- the system stores the task `sessionId` in runtime state instead of copying full conversation logs into task cards
- `report` can generate or append a task summary without destroying the workspace
- `finish` generates a final task summary, marks the task as done, and then cleans up the workspace
- `clean` only clears runtime state and local worktree resources without marking the task as done
- summaries are written under `summaries/` so they remain separate from task configuration
- when a summary is needed, the system uses that `sessionId` to locate the original Codex session record and derives the summary from that history

This keeps task cards clean while preserving a reliable path back to the original agent conversation for reporting and review.

## Hooks

The core does not contain project-specific bootstrap logic.

- `hooks.onBeforeLaunch`
  - runs after the task worktree is created but before any tabs are opened
  - use it for prerequisites that must finish before environment initialization or prompt delivery
  - a common example is syncing extra repositories declared in task metadata such as `workspaceRepos`
- `hooks.onCodeTabOpen`
  - runs when the code/setup tab opens during `run`
  - runs after `onBeforeLaunch`
  - runs only when the task card enables `onCodeTabOpen` in `hooks`
- `hooks.onClean`
  - runs before worktree and branch cleanup
  - runs only when the task card enables `onClean` in `hooks`

Typical launch order in the current implementation:

1. Create the task worktree.
2. Run `onBeforeLaunch`.
3. Open the task tabs.
4. Run `onCodeTabOpen` inside the code/setup tab.
5. Start the agent and send the initial prompt.

The repository includes a generic example hook:

```bash
hooks/project-lifecycle.example.sh
```

This example is intentionally generic. Put private or repository-specific logic in your own hook script outside this repository.

Hook environment variables include:

- `MW_HOOK_EVENT`
- `MW_TASK_NAME`
- `MW_TASK_INDEX`
- `MW_TASK_REPO`
- `MW_TASK_BRANCH`
- `MW_TASK_WORKTREE`
- `MW_TASK_FILE`
- `MW_TASK_DATE`
- `MW_TASK_SLUG`
- `MW_RECORDS_DAY_DIR`
- `MW_OS_ROOT`
- `MW_CODE_DIR`
- `MW_TASK_META_JSON`

## Agent Sessions And Notifications

MagicWork keeps runtime state outside task cards and lets the terminal layer handle live interaction signals.

In the current `Codex + kitty` setup:

- task runtime state stores the Codex `sessionId`
- `restore` can reopen the task workspace and resume the same session
- all task windows are launched against one shared kitty socket
- when Codex enters a waiting-for-input state, the tab title can change and a kitty notification can be emitted
- the shared socket also makes fast window switching possible with helpers such as `kls`

These mechanics are implementation-specific, but the pattern is portable to other agents and terminal tools.
