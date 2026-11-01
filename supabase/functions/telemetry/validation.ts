export const MAX_REQUEST_BYTES = 16 * 1024

export type TelemetryPayload = {
  deviceId?: unknown
  bootId?: unknown
  eventSequence?: unknown
  timestampMs?: unknown
  virtualHours?: unknown
  lowerLevel?: unknown
  upperLevel?: unknown
  mode?: unknown
  leadPump?: unknown
  commandedPump?: unknown
  manualPump?: unknown
  alarms?: unknown
  pumps?: unknown
}

type PumpPayload = {
  id: number
  command: boolean
  running: boolean
  runHours: number
  starts: number
}

export type NormalizedTelemetry = {
  device_id: string
  boot_id: string
  event_sequence: number
  device_timestamp_ms: number | null
  virtual_hours: number
  lower_level: number
  upper_level: number
  operation_mode: 'auto' | 'manual'
  lead_pump: number
  commanded_pump: number | null
  manual_pump: number | null
  alarms: string
  pumps: PumpPayload[]
  raw_payload: TelemetryPayload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function asPumpId(value: unknown): number | null {
  return value === 1 || value === 2 ? value : null
}

function normalizeMode(value: unknown): 'auto' | 'manual' | null {
  if (typeof value !== 'string') return null
  const mode = value.toLowerCase()
  return mode === 'auto' || mode === 'manual' ? mode : null
}

function normalizePumps(value: unknown): PumpPayload[] | null {
  if (!Array.isArray(value) || value.length !== 2) return null

  const pumps: PumpPayload[] = []
  const ids = new Set<number>()
  for (const item of value) {
    if (!isRecord(item)) return null
    const id = asPumpId(item.id)
    const runHours = asFiniteNumber(item.runHours)
    const starts = asNonNegativeInteger(item.starts)
    if (
      id === null || ids.has(id) || typeof item.command !== 'boolean' ||
      typeof item.running !== 'boolean' || runHours === null || runHours < 0 || starts === null
    ) return null
    ids.add(id)
    pumps.push({ id, command: item.command, running: item.running, runHours, starts })
  }

  return pumps
}

export function validate(payload: unknown): { value: NormalizedTelemetry } | { error: string } {
  if (!isRecord(payload)) return { error: 'O corpo deve ser um objeto JSON.' }

  const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : ''
  const bootId = typeof payload.bootId === 'string' ? payload.bootId.trim() : ''
  const eventSequence = asNonNegativeInteger(payload.eventSequence)
  const virtualHours = asFiniteNumber(payload.virtualHours)
  const lowerLevel = asFiniteNumber(payload.lowerLevel)
  const upperLevel = asFiniteNumber(payload.upperLevel)
  const mode = normalizeMode(payload.mode)
  const leadPump = asPumpId(payload.leadPump)
  const commandedPump = payload.commandedPump === 0 ? null : asPumpId(payload.commandedPump)
  const manualPump = payload.manualPump === 0 ? null : asPumpId(payload.manualPump)
  const timestampMs = payload.timestampMs === undefined ? null : asNonNegativeInteger(payload.timestampMs)
  const pumps = normalizePumps(payload.pumps)

  if (deviceId.length === 0 || deviceId.length > 128) return { error: 'deviceId invalido.' }
  if (bootId.length === 0 || bootId.length > 64) return { error: 'bootId invalido.' }
  if (eventSequence === null) return { error: 'eventSequence invalido.' }
  if (virtualHours === null || virtualHours < 0) return { error: 'virtualHours invalido.' }
  if (lowerLevel === null || lowerLevel < 0 || lowerLevel > 100) return { error: 'lowerLevel invalido.' }
  if (upperLevel === null || upperLevel < 0 || upperLevel > 100) return { error: 'upperLevel invalido.' }
  if (!mode) return { error: 'mode deve ser AUTO ou MANUAL.' }
  if (!leadPump) return { error: 'leadPump deve ser 1 ou 2.' }
  if (payload.commandedPump !== 0 && !commandedPump) return { error: 'commandedPump invalido.' }
  if (payload.manualPump !== 0 && !manualPump) return { error: 'manualPump invalido.' }
  if (timestampMs === null && payload.timestampMs !== undefined) return { error: 'timestampMs invalido.' }
  if (typeof payload.alarms !== 'string') return { error: 'alarms deve ser texto.' }
  if (!pumps) return { error: 'pumps deve conter exatamente as duas bombas validas.' }

  return {
    value: {
      device_id: deviceId,
      boot_id: bootId,
      event_sequence: eventSequence,
      device_timestamp_ms: timestampMs,
      virtual_hours: virtualHours,
      lower_level: lowerLevel,
      upper_level: upperLevel,
      operation_mode: mode,
      lead_pump: leadPump,
      commanded_pump: commandedPump,
      manual_pump: manualPump,
      alarms: payload.alarms.slice(0, 1000),
      pumps,
      raw_payload: payload,
    },
  }
}
