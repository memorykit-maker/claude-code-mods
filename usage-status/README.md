# usage-status: a labeled status line for Claude Code

The default footer shows bare numbers like `7d 59% left`. This mod pins one clear line under the prompt instead:

```
5h session: 77% left (resets 9:40 PM) | 7d week: 59% left (resets Wed 4:00 PM) | ctx 18% | 212k tok | ~9k/1% est | $3.41 | PC ok
```

| Piece | What it is |
|---|---|
| `5h session` / `7d week` | Your plan's rolling 5-hour and 7-day usage windows, as percent left, with the reset time. Whichever hits zero first locks you out. |
| `ctx` | How full the context window is. |
| `tok` | Tokens this session (fresh input + cache writes + output; cache reads left out because they inflate it). |
| `~N/1% est` | Rough tokens per 1% of the 5h window, shown once the meter has moved 2+ points. An estimate, never a quota. |
| `$` | Session cost at API prices. On a flat-rate plan it is a "how heavy was this session" gauge, not your bill. |
| `PC ok` | Every 60 s a read-only check (CPU, free RAM, free disk, ping 1.1.1.1). Names the problem if a drive is under 15% free, RAM under 10% free, CPU over 90%, or the internet is down. `PC ?` means the check itself failed. |
| `NEW DAY: ...` | Shows up if your session runs past midnight, so work doesn't get filed under yesterday. |

## Install

1. Put the `usage-status` folder somewhere permanent.
2. Load it as a plugin folder, either with `claude --plugin-dir <path-to-usage-status>` or by adding its path to `CLAUDE_CODE_PLUGIN_DIRS` (`;`-separated on Windows, `:` elsewhere) in the `env` block of your `settings.json`.
3. Restart Claude Code. Editing the mod later hot-reloads when loaded with `--plugin-dir`; with `CLAUDE_CODE_PLUGIN_DIRS` it needs a restart.

You can run `claude plugin validate` on the folder first.

## Notes and limits

- **Status:** running daily on Windows 11 since 2026-10-03. There is no unit test; it is proven by looking at the line.
- The `PC ok` check is **PowerShell / Windows only**. On macOS or Linux, delete the health pieces (`HEALTH_PS`, `pollHealth`, the `health` part of `buildLine`) or replace the command; the usage, context, token and new-day pieces work anywhere.
- The `tsconfig.json` points at type files that Claude Code generates in `.claude-plugin/types/` when the plugin loads; you don't need to write them.
- Plan limits only appear on a subscription plan. On API billing the `5h` and `7d` pieces simply don't show.
- Read-only: the mod never changes your files or your machine.
