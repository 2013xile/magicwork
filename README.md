# MagicWork

每天使用 Markdown 填 5 个任务，然后批量创建 worktree、打开 kitty tab，并在每个 tab 里启动 `codex` 发送初始提示词。

## 用法

生成当天模板：

```bash
./bin/magicwork init
```

不带 active 任务，生成空白模板：

```bash
./bin/magicwork init --no-carry-active
```

会在当前目录下创建 `YYYY-MM-DD/`，并生成：

- 第一次：`tasks.md`
- 第二次开始：`tasks-02.md`、`tasks-03.md` ...

执行当天任务：

```bash
./bin/magicwork run
```

默认只启动还没启动过的任务。若要显式重开已启动任务：

```bash
./bin/magicwork run --rerun-launched
```

先预览将要执行的结果：

```bash
./bin/magicwork run --dry-run
```

也可以指定文件：

```bash
./bin/magicwork run 2026-04-17/tasks.md
```

如果 kitty 重启了，可以按 active 状态恢复所有任务窗口：

```bash
./bin/magicwork restore
```

`restore` 只重开窗口和 3 个 tab，不重新初始化环境，也不会再次发送 prompt。

也可以只恢复单个或多个 active 任务：

```bash
./bin/magicwork restore 1
./bin/magicwork restore 1 3
./bin/magicwork restore task-3512
./bin/magicwork restore 01-task-1
```

清理单个或多个任务的 worktree 和分支：

```bash
./bin/magicwork clean 1 3
./bin/magicwork clean 01-task-1
./bin/magicwork clean magicwork/2026-04-17/01-task-1
```

清理当天全部任务的 worktree 和分支：

```bash
./bin/magicwork clean --all
```

为单个或多个任务生成进展总结并写入 `records/`：

```bash
./bin/magicwork report 1
./bin/magicwork report 1 3
./bin/magicwork report --all
```

## 模板字段

- `Enabled`: 改成 `yes` 才会执行。
- `Workdir`: 源仓库目录。默认 `/Users/xile/code/nocobase/nocobase`。
- `BaseBranch`: worktree 的起点分支。留空时取 `Workdir` 当前分支。
- `NewBranch`: 新分支名。留空时自动生成 `magicwork/<date>/<task>`。
- `InitEnv`: 是否自动初始化环境。默认 `yes`。
- `prompt`: 启动 `codex` 时发送的初始提示词。
- 默认会把尚未 `clean` 的 active 任务自动带到新一天模板中。
- 如果新建的是 NocoBase worktree，会自动做初始化。
- `report` 会按任务把总结追加到 `records/*.md`。
- `run` 默认只启动未启动过的任务；已启动任务会跳过，除非使用 `--rerun-launched`。
- `restore` 默认会按 `.magicwork-active.json` 重开全部 active 任务，也支持按索引、目录名、分支名单独恢复；不重复初始化，也不重复发送 prompt。

模板示例：

````md
## Task 1

- Name: 修复权限按钮
- Enabled: yes
- Workdir: /Users/xile/code/nocobase/nocobase
- BaseBranch: main
- NewBranch:

```prompt
修复权限按钮在移动端不显示的问题。
先阅读相关页面、定位根因、完成修复并自行验证。
```
````

## 行为说明

- 每个启用任务都会在当天目录下创建一个 worktree，目录名格式为 `01-task-name`。
- 如果 `NewBranch` 已存在，则复用该分支创建 worktree。
- 如果 `NewBranch` 为空，则自动创建新分支。
- `codex` 通过 `--dangerously-bypass-approvals-and-sandbox` 启动。
- 每个启用任务会打开一个新的 kitty 窗口，窗口标题使用任务名。
- 每个窗口固定创建 3 个 tab：`codex`、`vi`、`code`。
- `--dry-run` 只打印计划，不创建 worktree，也不打开 kitty。
- `clean` 会同时删除对应的 git worktree 和本地分支。
- 对于 NocoBase 任务，`clean` 还会删除自动创建的主库和测试库。
- `run` 成功启动后会把任务登记到 `.magicwork-active.json`。
- `clean` 成功后会把对应任务从 `.magicwork-active.json` 移除。
- `restore` 会根据 `.magicwork-active.json` 和当前 git worktree 状态恢复窗口。
- `report` 会调用 `codex exec` 读取任务 worktree，并把进展总结写入对应任务记录。
- 新建 NocoBase worktree 时，第三个 `code` tab 会自动执行初始化：直接执行 `yarn install`，随后重写 `.env` 和 `.env.test` 的 Postgres 配置、创建主库和测试库、分配不冲突的 `APP_PORT` / inspect 端口、最后执行 `yarn nocobase install`。

## 注意

- `kitty` 和 `codex` 需要已安装并在 PATH 内。
- `Workdir` 必须是 Git 仓库。
- 已存在且非空、但不是 Git worktree 的目标目录会直接报错，避免误覆盖。
