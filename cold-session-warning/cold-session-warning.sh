#!/usr/bin/env bash
# SessionStart hook: warn when a resumed session's prompt cache has expired.
# Claude Code passes the hook a JSON payload on stdin; on resume/fork it carries
# seconds_since_last_response, prompt_cache_likely_expired, context_tokens and
# estimated_cache_write_usd. Silent on a fresh start or a still-warm cache.
# Needs jq.
payload=$(cat)
[ -z "$payload" ] && exit 0
[ "$(echo "$payload" | jq -r '.prompt_cache_likely_expired // false')" = "true" ] || exit 0

secs=$(echo "$payload" | jq -r '.seconds_since_last_response // 0 | floor')
tokens=$(echo "$payload" | jq -r '.context_tokens // 0')
usd=$(echo "$payload" | jq -r '.estimated_cache_write_usd // empty')

if [ "$secs" -ge 3600 ]; then idle="$((secs / 3600))h $(((secs % 3600) / 60))m"; else idle="$((secs / 60))m"; fi
if [ "$tokens" -ge 1000 ]; then tok="$(((tokens + 500) / 1000))k"; else tok="$tokens"; fi
cost=""; [ -n "$usd" ] && cost=$(printf ' (about $%.2f)' "$usd")

msg="Cold session: idle $idle, so the prompt cache has expired. Your first message re-sends ~$tok tokens uncached$cost and may be slow. For a long job, consider starting fresh and loading context from your notes instead of resuming."
jq -cn --arg m "$msg" '{systemMessage: $m}'
