import { describe, expect, it } from 'vitest';
import { createInitialPlant } from '../domain/simulator';
import { hasLiveRemoteTelemetry } from './useRemoteTelemetry';

describe('continuidade entre telemetria remota e simulador local', () => {
  it('usa telemetria somente enquanto a conexão está confirmada', () => {
    const telemetry = createInitialPlant();

    expect(hasLiveRemoteTelemetry('connected', telemetry)).toBe(true);
    expect(hasLiveRemoteTelemetry('error', telemetry)).toBe(false);
    expect(hasLiveRemoteTelemetry('loading', telemetry)).toBe(false);
    expect(hasLiveRemoteTelemetry('connected', null)).toBe(false);
  });
});
