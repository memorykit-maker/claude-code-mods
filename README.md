# claude-code-mods

Two small mods for [Claude Code](https://claude.com/claude-code), each in its own folder with its own README.

| Mod | What it does | Status |
|---|---|---|
| [`usage-status`](usage-status/) | Pins one labeled line under the prompt: `5h session: 77% left (resets 9:40 PM) \| 7d week: 59% left \| ctx 18% \| 212k tok \| $3.41 \| PC ok`. Replaces the bare `7d 59% left` footer with something you can read at a glance. | Running daily on Windows 11 since 2026-10-03. No unit tests. The `PC ok` health check is PowerShell/Windows only. |
| [`cold-session-warning`](cold-session-warning/) | A `SessionStart` hook that warns you when you resume a session whose prompt cache has expired, with the estimated cost of re-sending the transcript, so you can start fresh instead. | PowerShell version tested against fake payloads. Not yet seen live at a real resume. The `.sh` version is untested. |

Both are read-only: they never change your files or your machine.

The cold-session warning is a heads-up, not a fix. The cache expiring is a cost and latency fact; it is not proven to be what makes an idle session die.

Found a bug, or got one working on macOS/Linux? Open an issue.

MIT licensed.
