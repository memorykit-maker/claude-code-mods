import type { Engine, Register } from 'claude-code'

type Limit = { kind: string; percentUsed: number; resetsAt?: string }

const LABELS: readonly (readonly [string, string])[] = [
  ['five_hour', '5h session'],
  ['seven_day', '7d week'],
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const HEALTH_MS = 60 * 1000
const DATE_CHECK_MS = 5 * 60 * 1000
const DISK_MIN = 15
const RAM_MIN = 10
const CPU_MAX = 90
const EST_MIN_POINTS = 2

const HEALTH_PS = [
  '$c = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average',
  '$o = Get-CimInstance Win32_OperatingSystem',
  '$ram = [math]::Round(100 * $o.FreePhysicalMemory / $o.TotalVisibleMemorySize)',
  '$disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { [pscustomobject]@{ id = $_.DeviceID; free = [math]::Round(100 * $_.FreeSpace / $_.Size) } })',
  '$net = [bool](Test-Connection 1.1.1.1 -Count 1 -Quiet)',
  '[pscustomobject]@{ cpu = [math]::Round($c); ram = $ram; disks = $disks; net = $net } | ConvertTo-Json -Compress',
].join('; ')

let limits: readonly Limit[] = []
let ctxPercent: number | undefined
let costUsd: number | undefined
let tokens = 0
let health = 'PC ...'
let baseline: { percent: number; tokens: number } | undefined
let sessionDate = ''
let dateRolled = false

const compact = (n: number): string =>
  n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)

const clockText = (d: Date): string => {
  const h = d.getHours()
  const m = d.getMinutes()
  return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' AM' : ' PM')
}

const resetText = (kind: string, iso: string | undefined): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return kind === 'five_hour' ? clockText(d) : DAYS[d.getDay()] + ' ' + clockText(d)
}

// Calibration for the "~N/1% est" figure: tokens this session spent per point of the 5h window
// used since we first saw it (re-based whenever the window resets and the percent drops).
// Rough by design: other devices and cache behavior also move the meter.
const track = (): void => {
  const hit = limits.find((l) => l.kind === 'five_hour')
  if (!hit) return
  if (!baseline || hit.percentUsed < baseline.percent) baseline = { percent: hit.percentUsed, tokens }
}

const estimate = (): string | undefined => {
  const hit = limits.find((l) => l.kind === 'five_hour')
  if (!hit || !baseline) return undefined
  const moved = hit.percentUsed - baseline.percent
  const spent = tokens - baseline.tokens
  if (moved < EST_MIN_POINTS || spent <= 0) return undefined
  return '~' + compact(Math.round(spent / moved)) + '/1% est'
}

const localDate = (d: Date): string =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

const checkDate = ($: Engine): void => {
  const now = localDate(new Date())
  if (sessionDate && now !== sessionDate) {
    dateRolled = true
    sessionDate = now
    render($)
  }
}

const buildLine = (): string | undefined => {
  const parts: string[] = []
  if (dateRolled) parts.push('NEW DAY: the date changed since this session started')
  for (const [kind, label] of LABELS) {
    const hit = limits.find((l) => l.kind === kind)
    if (!hit) continue
    const reset = resetText(kind, hit.resetsAt)
    parts.push(label + ': ' + Math.round(100 - hit.percentUsed) + '% left' + (reset ? ' (resets ' + reset + ')' : ''))
  }
  if (ctxPercent !== undefined) parts.push('ctx ' + Math.round(ctxPercent) + '%')
  if (tokens > 0) parts.push(compact(tokens) + ' tok')
  const est = estimate()
  if (est) parts.push(est)
  if (costUsd !== undefined) parts.push('$' + costUsd.toFixed(2))
  parts.push(health)
  return parts.join(' | ')
}

const render = ($: Engine): void => {
  $.ui.status(buildLine())
}

const judge = (raw: string): string => {
  const h = JSON.parse(raw) as { cpu: number; ram: number; disks: { id: string; free: number }[]; net: boolean }
  const issues: string[] = []
  for (const d of h.disks) if (d.free < DISK_MIN) issues.push(d.id + ' ' + d.free + '% free')
  if (h.ram < RAM_MIN) issues.push('RAM ' + h.ram + '% free')
  if (h.cpu > CPU_MAX) issues.push('CPU ' + h.cpu + '%')
  if (!h.net) issues.push('internet down')
  return issues.length > 0 ? 'PC: ' + issues.join(', ') : 'PC ok'
}

const pollHealth = async ($: Engine): Promise<void> => {
  try {
    const r = await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', HEALTH_PS], {
      timeoutMs: 20000,
    })
    health = r.exitCode === 0 ? judge(r.stdout) : 'PC ?'
  } catch {
    health = 'PC ?'
  }
  render($)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    sessionDate = localDate(new Date())
    dateRolled = false
    const usage = await $.session.usage()
    limits = usage.rateLimits
    ctxPercent = usage.context.percent
    costUsd = usage.cost?.usd
    track()
    render($)
    void pollHealth($)
    $.clock.every(HEALTH_MS, () => pollHealth($))
    $.clock.every(DATE_CHECK_MS, () => checkDate($))
    return next(e)
  })

  on('session.measure', ($, e, next) => {
    limits = e.rateLimits
    ctxPercent = e.context.percent
    costUsd = e.cost?.usd
    track()
    render($)
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    const u = e.usage
    if (u) tokens += u.input_tokens + u.cache_creation_input_tokens + u.output_tokens
    render($)
    return next(e)
  })
}
