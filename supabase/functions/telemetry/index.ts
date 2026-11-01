import { createClient } from 'npm:@supabase/supabase-js@2'
import { MAX_REQUEST_BYTES, validate } from './validation.ts'

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
}

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

function getSecretKey(): string {
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const key = keys.default
  if (!key) throw new Error('SUPABASE_SECRET_KEYS nao foi configurada.')
  return key
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

async function readJson(request: Request): Promise<{ value: unknown } | { error: string; status: number }> {
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null) {
    const length = Number(contentLength)
    if (!Number.isSafeInteger(length) || length < 0) return { error: 'Content-Length invalido.', status: 400 }
    if (length > MAX_REQUEST_BYTES) return { error: 'Corpo da requisicao excede o limite.', status: 413 }
  }

  if (!request.body) return { error: 'Corpo da requisicao ausente.', status: 400 }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel()
        return { error: 'Corpo da requisicao excede o limite.', status: 413 }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  } catch {
    return { error: 'JSON invalido.', status: 400 }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (request.method !== 'POST') return response({ error: 'Metodo nao permitido.' }, 405)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'Content-Type deve ser application/json.' }, 415)
  }

  const expectedDeviceKey = Deno.env.get('DEVICE_API_KEY')
  const expectedDeviceId = Deno.env.get('DEVICE_ID')
  if (!expectedDeviceKey || !expectedDeviceId) {
    console.error('DEVICE_API_KEY ou DEVICE_ID nao configurada.')
    return response({ error: 'Servico ainda nao configurado.' }, 503)
  }
  if (!safeEqual(request.headers.get('x-device-key') ?? '', expectedDeviceKey)) {
    return response({ error: 'Nao autorizado.' }, 401)
  }

  const body = await readJson(request)
  if ('error' in body) return response({ error: body.error }, body.status)

  const validation = validate(body.value)
  if ('error' in validation) return response({ error: validation.error }, 422)
  if (!safeEqual(validation.value.device_id, expectedDeviceId)) {
    return response({ error: 'Dispositivo nao autorizado.' }, 403)
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getSecretKey())
    const { data, error } = await supabase
      .from('telemetry')
      .upsert(validation.value, {
        onConflict: 'device_id,boot_id,event_sequence',
        ignoreDuplicates: true,
      })
      .select('id, received_at')
      .maybeSingle()

    if (error) {
      if (error.code === 'P0001' && error.message === 'TELEMETRY_RATE_LIMITED') {
        return response({ error: 'Limite de telemetria excedido.' }, 429)
      }
      console.error('Erro ao inserir telemetria:', error.message)
      return response({ error: 'Falha ao registrar telemetria.' }, 500)
    }

    if (!data) return response({ duplicate: true }, 200)
    return response({ id: data.id, receivedAt: data.received_at }, 201)
  } catch (error) {
    console.error('Erro inesperado:', error)
    return response({ error: 'Erro interno.' }, 500)
  }
})
