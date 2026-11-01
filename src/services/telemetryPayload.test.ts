import { describe, expect, it } from 'vitest';
import { MAX_REQUEST_BYTES, validate } from '../../supabase/functions/telemetry/validation';

const validPayload = {
  deviceId: 'esp32-agua-01',
  bootId: 'AABBCCDDEEFF-12345678',
  eventSequence: 0,
  timestampMs: 5000,
  virtualHours: 5.25,
  lowerLevel: 82.5,
  upperLevel: 48.25,
  mode: 'AUTO',
  leadPump: 1,
  commandedPump: 1,
  manualPump: 0,
  alarms: 'NONE',
  pumps: [
    { id: 1, command: true, running: true, runHours: 1.25, starts: 3 },
    { id: 2, command: false, running: false, runHours: 0, starts: 0 },
  ],
};

describe('contrato de telemetria', () => {
  it('normaliza um payload valido e conserva sua chave de idempotencia', () => {
    const result = validate(validPayload);
    expect('value' in result).toBe(true);
    if ('value' in result) {
      expect(result.value).toMatchObject({
        device_id: 'esp32-agua-01',
        boot_id: 'AABBCCDDEEFF-12345678',
        event_sequence: 0,
        operation_mode: 'auto',
      });
    }
  });

  it('rejeita payload sem chave de idempotencia', () => {
    const { bootId: _bootId, ...withoutBootId } = validPayload;
    expect(validate(withoutBootId)).toEqual({ error: 'bootId invalido.' });
  });

  it('rejeita bombas incompletas ou com campos invalidos', () => {
    expect(validate({ ...validPayload, pumps: [validPayload.pumps[0]] })).toEqual({
      error: 'pumps deve conter exatamente as duas bombas validas.',
    });
    expect(validate({ ...validPayload, pumps: [{ ...validPayload.pumps[0], starts: -1 }, validPayload.pumps[1]] })).toEqual({
      error: 'pumps deve conter exatamente as duas bombas validas.',
    });
  });

  it('mantem um limite de corpo pequeno para a funcao de borda', () => {
    expect(MAX_REQUEST_BYTES).toBe(16 * 1024);
  });
});
