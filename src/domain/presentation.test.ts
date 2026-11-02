import { describe, expect, it } from 'vitest';
import { buildReportCsv } from '../services/report';
import { createInitialPlant, getActivePump, getAlarms, getWeeklyLeadPump, stepPlant } from './simulator';

describe('cenários locais de apresentação', () => {
  it('T01 — enche o RS automaticamente e para no nível configurado', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.upperLevel = plant.settings.startUpperLevel;
    const pumping = stepPlant(plant, 1);
    expect(getActivePump(pumping)).toBe(1);

    const full = stepPlant(pumping, 7);
    expect(full.upperLevel).toBeGreaterThanOrEqual(full.settings.stopUpperLevel);
    expect(getActivePump(stepPlant(full, 0.01))).toBeNull();
  });

  it('T02 e T03 — simula consumo e bloqueia a partida manual com RI baixo', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.mode = 'manual';
    plant.upperLevel = 60;
    const draining = stepPlant(plant, 1);
    expect(draining.upperLevel).toBeLessThan(60);

    draining.lowerLevel = 10;
    draining.manualPump = 1;
    const blocked = stepPlant(draining, 0.01);
    expect(getActivePump(blocked)).toBeNull();
    expect(getAlarms(blocked).map((alarm) => alarm.id)).toContain('low-lower');
  });

  it('T04 e T05 — alterna a principal e executa teste individual seguro', () => {
    expect(getWeeklyLeadPump(0)).toBe(1);
    expect(getWeeklyLeadPump(168)).toBe(2);

    const plant = createInitialPlant();
    plant.paused = false;
    plant.lowerLevel = 50;
    plant.upperLevel = 50;
    plant.activeTest = { pump: 2, startedAt: 0, startedUpperLevel: plant.upperLevel, startedLowerLevel: plant.lowerLevel, previousSpeed: plant.settings.speed, scheduled: false };
    expect(getActivePump(stepPlant(plant, 0.1))).toBe(2);
  });

  it('T06 e T07 — seleciona a reserva para falha de partida e falta de vazão', () => {
    const failedStart = createInitialPlant();
    failedStart.paused = false;
    failedStart.upperLevel = 20;
    failedStart.pumps[1].startFailure = true;
    expect(getActivePump(stepPlant(failedStart, 0.01))).toBe(2);

    const noFlow = createInitialPlant();
    noFlow.paused = false;
    noFlow.upperLevel = 20;
    noFlow.pumps[1].noFlow = true;
    const afterTimeout = stepPlant(noFlow, 0.17);
    expect(getAlarms(afterTimeout).map((alarm) => alarm.id)).toContain('flow-1');
    expect(getActivePump(stepPlant(afterTimeout, 0.01))).toBe(2);
  });

  it('T09 — conserva histórico e gera relatório exportável', () => {
    const initial = createInitialPlant();
    initial.paused = false;
    const plant = stepPlant(initial, 0.25);
    const csv = buildReportCsv(plant, getAlarms(plant), 'local', plant.alarmHistory);
    expect(plant.history).toHaveLength(1);
    expect(csv).toContain('Histórico operacional');
    expect(csv).toContain('Horas B1');
  });
});
