import { createClient } from 'npm:@supabase/supabase-js@2'

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }
const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

function getSecretKey(): string {
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  if (!keys.default) throw new Error('SUPABASE_SECRET_KEYS nao configurada.')
  return keys.default
}

function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index]
  return difference === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasValidDeviceCredentials(request: Request, deviceId: string): boolean {
  const expectedKey = Deno.env.get('DEVICE_API_KEY')
  const expectedDeviceId = Deno.env.get('DEVICE_ID')
  return Boolean(expectedKey && expectedDeviceId &&
    safeEqual(request.headers.get('x-device-key') ?? '', expectedKey) &&
    safeEqual(deviceId, expectedDeviceId))
}

async function listCommands(request: Request) {
  const deviceId = new URL(request.url).searchParams.get('deviceId') ?? ''
  if (!hasValidDeviceCredentials(request, deviceId)) return response({ error: 'Nao autorizado.' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getSecretKey())
  const { data, error } = await supabase
    .from('remote_commands')
    .select('id, action, payload, requested_at')
    .eq('device_id', deviceId)
    .eq('status', 'queued')
    .order('requested_at', { ascending: true })
    .limit(4)

  if (error) {
    console.error('Erro ao consultar comandos:', error.message)
    return response({ error: 'Falha ao consultar comandos.' }, 500)
  }
  return response({ commands: data ?? [] })
}

async function acknowledgeCommand(request: Request) {
  const deviceId = request.headers.get('x-device-id') ?? ''
  if (!hasValidDeviceCredentials(request, deviceId)) return response({ error: 'Nao autorizado.' }, 401)

  let body: unknown
  try { body = await request.json() } catch { return response({ error: 'JSON invalido.' }, 400) }
  if (!isRecord(body) || typeof body.commandId !== 'string' ||
      (body.status !== 'executed' && body.status !== 'rejected') ||
      typeof body.result !== 'string' || body.result.length > 250) {
    return response({ error: 'Confirmacao invalida.' }, 422)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getSecretKey())
  const { data, error } = await supabase
    .from('remote_commands')
    .update({ status: body.status, execution_result: body.result, completed_at: new Date().toISOString() })
    .eq('id', body.commandId)
    .eq('device_id', deviceId)
    .eq('status', 'queued')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Erro ao confirmar comando:', error.message)
    return response({ error: 'Falha ao confirmar comando.' }, 500)
  }
  return response({ acknowledged: Boolean(data) })
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'GET') return await listCommands(request)
    if (request.method === 'POST') return await acknowledgeCommand(request)
    return response({ error: 'Metodo nao permitido.' }, 405)
  } catch (error) {
    console.error('Erro inesperado:', error)
    return response({ error: 'Erro interno.' }, 500)
  }
})
