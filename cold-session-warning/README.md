# cold-session-warning: a heads-up before you resume a stale Claude Code session

When you resume a session after the prompt cache has expired (about an hour on the long setting, minutes on the short one), your first message re-sends the whole transcript uncached. That is slower and costs more, and on a big transcript it is the moment long-idle sessions have tended to fall over. This hook shows a one-line warning when you resume into that state, with the estimated re-cache cost, so you can choose to start fresh instead.

```
Cold session: idle 19h 10m, so the prompt cache has expired. Your first message re-sends ~412k tokens uncached (about $2.58) and may be slow. For a long job, consider starting fresh and loading context from your notes instead of resuming.
```

It is silent on a fresh start and on a resume with a warm cache.

## How it works

On resume or fork, Claude Code gives `SessionStart` hooks a JSON payload on stdin that includes `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired` and `estimated_cache_write_usd`. The script reads those and prints a `systemMessage`. No plugin and no API calls.

## Install (Windows, PowerShell)

Copy `cold-session-warning.ps1` somewhere permanent, then add this to the `hooks` section of `~/.claude/settings.json` (fix the path):

```json
"hooks": {
  "SessionStart": [
    {
      "matcher": "resume",
      "hooks": [
        { "type": "command", "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:\\path\\to\\cold-session-warning.ps1" }
      ]
    }
  ]
}
```

macOS / Linux: use `cold-session-warning.sh` (needs `jq`) with `"command": "bash /path/to/cold-session-warning.sh"`.

## Status, honestly

- **Tested:** the PowerShell script against fake payloads (cold 19 h with cost, cold 58 min without cost, warm cache, fresh startup, garbage input, empty input). It prints valid JSON when cold and stays silent otherwise.
- **Not yet verified live:** that Claude Code shows the `systemMessage` text to you at resume. It is the standard hook output field, but check it on your own setup.
- **Not tested:** the `.sh` version (written to match the PowerShell one; no `jq` on the machine it was written on).
- This is a warning, not a fix. The cache expiring is a cost and latency fact; it is **not proven** to be what kills a session. The hook just makes the risky case visible.
