import { describe, expect, it } from 'vitest';
import { createDemonstrationScenario, createInitialPlant, getAlarms, stepPlant } from '../domain/simulator';
import { simulationReducer } from './useSimulation';

describe('estado da simulação', () => {
  it('reinicia em automático, sem eventos e sem histórico residual', () => {
    const dirty = createInitialPlant();
    dirty.mode = 'manual';
    dirty.manualPump = 2;
    dirty.history = [{ virtualHour: 10, lowerLevel: 10, upperLevel: 90, activePump: 2, pump1RunHours: 20, pump1Starts: 4, pump2RunHours: 30, pump2Starts: 6, alarmIds: [] }];
    dirty.alarmHistory = [{ id: 'low-lower', title: 'Teste', detail: 'Teste', severity: 'critical', occurredAtVirtualHour: 10, acknowledgedAtVirtualHour: null, clearedAtVirtualHour: null, occurredAt: '2026-01-01T00:00:00.000Z', acknowledgedAt: null, clearedAt: null }];
    dirty.pumps[1].runHours = 75;

    const reset = simulationReducer(dirty, { type: 'reset' });

    expect(reset.mode).toBe('auto');
    expect(reset.manualPump).toBeNull();
    expect(reset.paused).toBe(true);
    expect(reset.history).toEqual([]);
    expect(reset.alarmHistory).toEqual([]);
    expect(reset.pumps[1].runHours).toBe(10.57);
    expect(reset.pumps[1].continuousRunHours).toBe(0);
  });

  it('restaura uma bomba sem apagar o resultado histórico do teste', () => {
    const testing = createDemonstrationScenario('test-1');
    testing.pumps[1].startFailure = true;
    const failed = stepPlant(testing, 0.25);
    const restored = simulationReducer(failed, { type: 'restore-pump', pump: 1 });

    expect(restored.pumps[1]).toMatchObject({ available: true, startFailure: false, noFlow: false, noFlowHours: 0 });
    expect(restored.testResults[0].restoredAtVirtualHour).toBe(restored.virtualHours);
    expect(getAlarms(restored).map((alarm) => alarm.id)).not.toContain('test-failed-1');
  });
});
