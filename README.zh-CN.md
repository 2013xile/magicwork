# MagicWork

[English README](./README.md)

MagicWork 是一套以 Markdown 为核心的 AI 开发工作流：你可以按天规划任务、为每个 AI 编码任务创建独立 git worktree、启动独立终端工作区、恢复 agent 会话，并在并行任务之间靠通知与快速切换来分配注意力。

当前仓库的参考实现基于 `Codex + kitty`，但核心思想并不绑定这两个工具。重点不是“再做一个命令行脚本”，而是把 AI 辅助开发变成一套日常操作系统：写一次任务，快速拉起隔离工作区，后续恢复原会话，并能明确知道哪个任务正在等你。

## 用于生成同类项目的完整提示词

如果你想让 AI 按这个思路，为你自己的工具链生成一个类似系统，可以直接复制下面这段提示词。

````text
请帮我构建一个本地 AI 开发工作流工具，项目名叫 <PROJECT_NAME>。

我不是想再做一个 task runner，而是想做一套“AI 辅助开发的日常操作系统”。

产品目标：
- 每天从按日期组织的 Markdown 任务卡开始。
- 每张任务卡代表一个独立的 AI 编码工作流。
- 每个工作流都有自己的 git worktree、工作分支、终端工作区和可恢复的 agent 会话。
- 我希望自己在多个并行 AI 任务之间切换时，像在多个同事之间切换一样自然：知道谁在等我、能恢复上下文、能一键回到正确窗口。
- 系统应该自动留下有用的工作留痕，而不是依赖手工汇报。
- 它应该支持按任务自动总结，方便后续复盘和查看进展。
- 它应该通过 hook 支持项目特定的 setup / cleanup，让 core 保持通用，同时又允许仓库做自己的初始化。

核心设计：
- 明确拆分这些路径：
  - osRoot：只放配置和运行时状态
  - recordsDir：放任务卡、每日索引、总结
  - codeDir：只放生成出来的 worktree
- recordsDir 和 codeDir 必须显式配置。
- 用单任务 Markdown 卡片作为唯一配置源。
- 每一天根据任务卡自动生成 index.md。
- 默认把未完成的 active 任务带到下一天。

开发约束：
- 任务卡是人写的稳定配置。
- 运行时状态和任务卡必须严格分离。
- agent 会话恢复是核心能力，不是附属功能。
- 通知和窗口切换是工作流的一部分，不是最后再补的优化项。
- 项目特定初始化逻辑不能写死在 core 里，要通过 hook 或外部脚本扩展。

需要具备的行为：
- `init`
  - 如果当天目录不存在则创建
  - 每次执行追加 5 张新任务卡
  - 如果当天已存在则继续追加，不覆盖
- `sync`
  - 根据任务卡重建 index.md
- `run`
  - 创建 worktree，并为每个任务启动一个独立终端工作区
  - 默认只启动“还没启动过”的任务
- `restore`
  - 恢复 active 任务工作区
  - 不重新初始化环境
  - 不重复发送初始 prompt
  - 如果有 session id，就恢复原来的 agent 会话
- `clean`
  - 清理一个或多个 worktree 和分支
  - 清理前可选生成总结
  - 支持 `--no-summary`
- `report`
  - 不清理，只生成或追加总结
- `config`
  - 初始化和查看配置

执行模型：
- 一个任务 = 一个独立 worktree + 一个独立终端工作区。
- 终端布局可以按实现调整，但一个很强的参考模式是：
  - 一个 agent tab
  - 一个 editor tab
  - 一个 code/setup tab
- 启动后焦点落在 agent tab。
- restore 时不要重放初始 prompt。

会话、通知与切换模型：
- 如果 coding agent 支持可恢复会话，就把 session id 存在运行时状态里，并在 restore 时使用它。
- 如果 agent 的对话记录保存在结构化会话文件里，例如 jsonl，则运行时只存 session id；需要生成总结时，再回到原始会话源读取。
- 终端层需要能表达“agent 正在等我输入”这种注意力信号。
- 终端层最好有统一的 remote-control socket，这样所有任务窗口都能被一致发现和控制。
- 应该让快速切换任务窗口变得非常容易，例如提供一个 `kls` 这样的辅助命令。

如果实现是 `Codex + kitty`，请参考这条具体方案：
- 所有任务窗口都挂到同一个 kitty socket，例如 `unix:/tmp/kitty.sock`
- 检测 Codex 的 waiting-for-input 事件，并把这个状态反映到终端层
- 当任务进入 waiting 状态时：
  - 把 tab title 改成 `<task> [waiting]`
  - 通过 kitty 发出通知，让我立刻知道哪个任务在等我
  - 保留足够的任务元数据，方便我快速跳回正确窗口
- 再提供一个基于 `kitty @ ls` + `fzf` 的 `kls` 快速切换命令，用来在所有任务窗口之间跳转

参考文档：
- Codex notifications: https://developers.openai.com/codex/config-advanced#notifications
- Kitty notify kitten: https://sw.kovidgoyal.net/kitty/kittens/notify/
- Kitty remote control: https://sw.kovidgoyal.net/kitty/remote-control/

如果要实现 hook 机制，可以参考当前仓库这条方案：
- 生命周期脚本配置在任务卡之外，也不写死在 core 里，而是通过 `onCodeTabOpen`、`onClean` 这类配置项注入。
- 启动 hook 在任务自己的 code/setup tab 中执行，这样仓库特定初始化发生在任务工作区内部，而不会阻塞当前 shell。
- 清理 hook 在删除 worktree 和 branch 之前执行，这样仓库可以先释放数据库、缓存等本地资源。

如果要实现自动总结和工作留痕，可以参考当前仓库这条方案：
- 总结按任务生成，而不是按整天生成一份大总结。
- 总结流程和清理、显式 report 绑定：`clean` 可以在删除前自动生成总结，`report` 可以在不清理的情况下生成或追加总结。
- 运行时状态尽量保持轻量，只保存 session id，再在生成总结时回到原始 agent 会话源读取内容。
- 使用保存下来的 `sessionId` 回到原始 agent 会话历史，再从这个来源派生总结，这样工作留痕会更可靠。

扩展机制：
- 不要把项目特定仓库逻辑硬编码进 core。
- 提供生命周期 hook 或外部脚本，用来承载 setup / cleanup。
- 常见 hook 职责包括依赖安装、env 模板复制、本地数据库创建、服务启动、清理。

实现偏好：
- 使用单一 CLI 入口。
- 运行时状态优先用简单本地文件，不要引入数据库。
- 代码风格保持务实、容易检查、容易二次开发。
- README 优先讲产品能力和工作流思想，而不是只堆命令用法。
````

## 它能做什么

- 按日期生成当天任务卡。
- 为每个任务创建独立 git branch 和 git worktree。
- 为每个任务启动独立终端工作区。
- 在任务卡之外保存 active 状态与 session id。
- 根据任务卡自动重建当天 `index.md`。
- 后续恢复窗口时，不重复发送初始 prompt。
- 清理前自动总结，或者通过 `--no-summary` 显式跳过。
- 通过 hook 承载项目特定的初始化与清理逻辑。

## 架构

MagicWork 明确拆分三类路径：

- `osRoot`
  - 只放配置和运行时状态
  - 默认值：`~/.config/magicwork`
- `recordsDir`
  - 放日期目录、任务卡、索引、总结
  - 必须显式配置
- `codeDir`
  - 只放生成出来的 git worktree
  - 必须显式配置

可选项：

- `defaultRepo`
  - 新任务卡默认指向的源仓库
- `hooks`
  - 项目特定生命周期脚本

## recordsDir 结构

`recordsDir` 下每天的结构如下：

```text
YYYY-MM-DD/
  index.md
  tasks/
    01-task-1.md
    02-task-2.md
    ...
  summaries/
    01-task-1.md
    02-task-2.md
    ...
```

含义：

- `tasks/*.md`
  - 配置源
  - 由你维护
- `index.md`
  - 自动生成的总览页
  - 可展示任务状态和 `sessionId`
- `summaries/*.md`
  - 自动生成的任务总结
  - 由 `report` 或 `clean` 追加内容

## 安装

当前版本是本地 CLI 脚本。最简单的用法，是把 `bin/magicwork` 链接到你 `PATH` 中的某个位置。

示例：

```bash
chmod +x bin/magicwork
ln -sf "$(pwd)/bin/magicwork" /usr/local/bin/mw
```

如果你不想全局安装，也可以直接这样运行：

```bash
./bin/magicwork help
```

当前参考实现依赖：

- `git`
- `node`
- `kitty`
- `python3`
- `codex`

推荐的全局安装方式：

```bash
chmod +x bin/magicwork
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/magicwork" ~/.local/bin/mw
```

并确保 `~/.local/bin` 已经加入 `PATH`。

## Kitty Socket 与快速切换

当前实现通过一个共享的 kitty remote-control socket 来控制终端，默认值是：

```text
unix:/tmp/kitty.sock
```

这样做有两个直接好处：

- MagicWork 可以稳定地创建和恢复任务工作区。
- 你可以基于这个统一 socket 做 `kls` 之类的快速切换命令，在任意 kitty 窗口之间跳转。

你可以让 MagicWork 自动启动一个监听这个 socket 的 kitty，也可以自己手动统一所有 kitty 实例的监听地址。

示例：

```bash
kitty --listen-on unix:/tmp/kitty.sock
```

如果你想显式指定 socket，也可以：

```bash
mw run --socket unix:/tmp/kitty.sock
mw restore --socket unix:/tmp/kitty.sock
```

如果你想在 shell 里加一个快速切换命令，一个通用做法是：用共享 socket 调 `kitty @ ls`，再接 `fzf` 做选择。

示例 `~/.zshrc` 函数：

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

上面只是一个通用示例，你可以替换成你自己的 `kls` 实现。

## 配置

初始化配置：

```bash
mw config init \
  --os-root ~/.config/magicwork \
  --records-dir /path/to/magicwork-records \
  --code-dir /path/to/magicwork-code \
  --default-repo /path/to/default-repo \
  --hook-on-code-tab-open /path/to/hook.sh \
  --hook-on-clean /path/to/hook.sh
```

查看当前配置：

```bash
mw config show
```

## 命令

生成当天任务卡：

```bash
mw init
```

同一天再次执行，会继续追加 5 张任务卡。

根据任务卡重建索引：

```bash
mw sync --date 2026-04-18
```

启动当天任务：

```bash
mw run
```

默认只启动“还没启动过”的任务。如果你明确要重开已启动任务：

```bash
mw run --rerun-launched
```

也可以直接指定某个索引或某张任务卡：

```bash
mw run /path/to/records/2026-04-18/index.md
mw run /path/to/records/2026-04-18/tasks/01-task-1.md
```

恢复 active 任务窗口：

```bash
mw restore
mw restore 1
mw restore task-1234
```

清理 worktree 和分支：

```bash
mw clean 1 3
mw clean --all
mw clean 1 3 --no-summary
```

只生成总结，不清理：

```bash
mw report 1
mw report --all
```

## 任务卡格式

示例：

````md
---
name: "Fix auth button"
enabled: true
workdir: "/path/to/repo"
baseBranch: "main"
newBranch: ""
hooks:
  - onCodeTabOpen
  - onClean
---

```prompt
Read the relevant page, locate the root cause, implement the fix, and verify it.
```
````

说明：

- front matter 是任务配置源
- `enabled: true` 才会参与 `run`
- `prompt` 是启动 agent 时发送的初始提示词
- `newBranch` 留空时自动生成
- `hooks` 用来控制该任务启用哪些 lifecycle hook event
- 例如 `hooks: [onClean]` 会跳过启动 hook，但保留清理 hook

## 会话记录与恢复

MagicWork 把任务卡视为静态配置，把运行时状态放在别处。

- active 任务状态保存在 `osRoot`
- `index.md` 会在可用时展示 `sessionId`
- `restore` 会在 agent 支持的前提下恢复对应会话
- 总结优先根据 `sessionId` 回到原始 agent 会话历史生成

在当前参考实现里，会话追踪基于 Codex 的 `sessionId` 和 `~/.codex/sessions/*.jsonl`。

## 总结与工作留痕

MagicWork 把“总结”和“工作留痕”视为工作流设计的一部分，而不是事后补上的附加功能。

核心思路是：

- 任务卡保持为稳定输入
- 运行时状态尽量轻量
- 原始 agent 会话是事实来源
- 总结按任务生成，而不是整天只写一份大总结

落实到实现上，就是：

- 系统只在运行时状态里保存任务的 `sessionId`，而不把整段对话复制回任务卡
- `report` 可以在不销毁工作区的前提下生成或追加任务总结
- `clean` 可以在删除 worktree 和 branch 之前生成最终总结
- 总结统一写到 `summaries/` 目录，和任务配置分开
- 当需要生成总结时，系统会使用这个 `sessionId` 去定位原始 Codex 会话记录，并基于那段历史生成总结。

这样既能保持任务卡干净，又保留了一条稳定的路径，让你之后还能回到原始 agent 对话做复盘和回顾。

## Hook

core 不内建项目特定初始化逻辑。

- `hooks.onCodeTabOpen`
  - 在 `run` 时打开 code/setup tab 触发
  - 只有任务卡的 `Hooks` 包含 `onCodeTabOpen` 才会触发
- `hooks.onClean`
  - 在删除 worktree / branch 之前触发
  - 只有任务卡的 `Hooks` 包含 `onClean` 才会触发

仓库里只提供一个公开的通用示例：

```bash
hooks/project-lifecycle.example.sh
```

这个示例故意保持通用。你自己的私有初始化逻辑，应该放到仓库外的 hook 脚本中，再通过配置文件引用。

hook 可读取的环境变量包括：

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

## Agent 会话与通知

MagicWork 把运行时状态放在任务卡之外，同时把实时交互信号交给终端层处理。

在当前的 `Codex + kitty` 组合里：

- 任务运行时状态会保存 Codex 的 `sessionId`
- `restore` 可以重新打开任务工作区并恢复同一个会话
- 所有任务窗口都挂在同一个 kitty socket 上
- 当 Codex 进入等待用户输入状态时，可以更新 tab title 并发出 kitty 通知
- 共享 socket 也让 `kls` 这种快速窗口切换命令成为可能

这些细节属于当前实现，但设计模式本身可以迁移到其他 agent 和终端工具。
