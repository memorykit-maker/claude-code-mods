# SessionStart hook: warn when a resumed session's prompt cache has expired.
# Claude Code passes the hook a JSON payload on stdin; on resume/fork it carries
# seconds_since_last_response, prompt_cache_likely_expired, context_tokens and
# estimated_cache_write_usd. Silent on a fresh start or a still-warm cache.
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $e = $raw | ConvertFrom-Json } catch { exit 0 }
if (-not $e.prompt_cache_likely_expired) { exit 0 }

$secs = [int]$e.seconds_since_last_response
$idle = if ($secs -ge 3600) { '{0}h {1}m' -f [math]::Floor($secs / 3600), [math]::Floor(($secs % 3600) / 60) } else { '{0}m' -f [math]::Floor($secs / 60) }
$tok = if ($e.context_tokens -ge 1000) { '{0}k' -f [math]::Round($e.context_tokens / 1000) } else { [string]$e.context_tokens }
$usd = if ($null -ne $e.estimated_cache_write_usd) { ' (about $' + ('{0:N2}' -f [double]$e.estimated_cache_write_usd) + ')' } else { '' }

$msg = "Cold session: idle $idle, so the prompt cache has expired. Your first message re-sends ~$tok tokens uncached$usd and may be slow. For a long job, consider starting fresh and loading context from your notes instead of resuming."
@{ systemMessage = $msg } | ConvertTo-Json -Compress
