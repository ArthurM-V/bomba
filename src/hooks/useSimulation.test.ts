import { describe, expect, it } from 'vitest';
import { createDemonstrationScenario, createInitialPlant, getAlarms, getWeeklyLeadPump, stepPlant } from '../domain/simulator';
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

  it('avança uma semana sem reiniciar a operação ao solicitar a alternância', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.pumps[1].runHours = 42;
    plant.pumps[1].starts = 7;
    plant.pumps[2].runHours = 31;
    plant.pumps[2].starts = 5;
    plant.history = [{ virtualHour: 0, lowerLevel: plant.lowerLevel, upperLevel: plant.upperLevel, activePump: null, pump1RunHours: 42, pump1Starts: 7, pump2RunHours: 31, pump2Starts: 5, alarmIds: [] }];

    const alternated = simulationReducer(plant, { type: 'run-scenario', scenario: 'weekly-alternation' });

    expect(alternated.paused).toBe(false);
    expect(alternated.virtualHours).toBeCloseTo(168, 8);
    expect(getWeeklyLeadPump(alternated.virtualHours)).toBe(2);
    expect(alternated.pumps[1].runHours).toBeGreaterThanOrEqual(42);
    expect(alternated.pumps[1].starts).toBeGreaterThanOrEqual(7);
    expect(alternated.pumps[2].runHours).toBeGreaterThanOrEqual(31);
    expect(alternated.pumps[2].starts).toBeGreaterThanOrEqual(5);
    expect(alternated.history.length).toBeGreaterThan(plant.history.length);
  });

  it('preserva o relógio virtual ao preparar outro cenário', () => {
    const plant = createInitialPlant();
    plant.virtualHours = 213.5;
    plant.lastHistoryHour = 213.5;

    const scenario = simulationReducer(plant, { type: 'run-scenario', scenario: 'low-water' });

    expect(scenario.virtualHours).toBeCloseTo(213.5 + 1 / 60, 8);
    expect(scenario.lastHistoryHour).toBeCloseTo(213.5, 8);
  });

  it('registra o cenário e a fase de retorno seguro na transição automática', () => {
    let plant = simulationReducer(createInitialPlant(), { type: 'run-scenario', scenario: 'low-water' });
    expect(plant).toMatchObject({ lastScenario: 'low-water', scenarioPhase: 'low-water' });

    for (let elapsed = 0; elapsed < 30; elapsed += 0.25) plant = stepPlant(plant, 0.25);
    expect(plant).toMatchObject({ lastScenario: 'low-water', scenarioPhase: 'lower-recovery' });
  });
});
