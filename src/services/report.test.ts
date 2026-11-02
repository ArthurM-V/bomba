import { describe, expect, it } from 'vitest';
import { createInitialPlant } from '../domain/simulator';
import { buildReportCsv } from './report';

describe('relatório CSV', () => {
  it('inclui indicadores, parâmetros, histórico operacional e reconhecimento de alarmes', () => {
    const plant = createInitialPlant();
    plant.history.push({
      virtualHour: 1.25,
      lowerLevel: 80,
      upperLevel: 45,
      activePump: 1,
      pump1RunHours: 10.75,
      pump1Starts: 2,
      pump2RunHours: 8.17,
      pump2Starts: 0,
      alarmIds: ['low-lower'],
    });
    plant.alarmHistory.push({
      id: 'low-lower',
      title: 'Reservatório inferior baixo',
      detail: 'Bombeamento bloqueado.',
      severity: 'critical',
      occurredAtVirtualHour: 1,
      acknowledgedAtVirtualHour: 1.1,
      clearedAtVirtualHour: 1.2,
      occurredAt: '2026-11-01T12:00:00.000Z',
      acknowledgedAt: '2026-11-01T12:01:00.000Z',
      clearedAt: '2026-11-01T12:02:00.000Z',
    });
    plant.testResults.push({
      id: 'test-1-1',
      pump: 1,
      startedAt: 1,
      endedAt: 1.25,
      durationHours: 0.25,
      upperLevelGain: 2.1,
      lowerLevelDrop: 1,
      status: 'approved',
      reason: 'Partida confirmada.',
      restoredAtVirtualHour: null,
    });

    const csv = buildReportCsv(plant, [], 'local', plant.alarmHistory);

    expect(csv).toContain('Parâmetros ativos');
    expect(csv).toContain('Histórico de alarmes');
    expect(csv).toContain('Reservatório inferior baixo');
    expect(csv).toContain('Histórico operacional');
    expect(csv).toContain('10.750');
    expect(csv).toContain('IndexedDB');
    expect(csv).toContain('Resultados de testes individuais');
    expect(csv).toContain('Partida confirmada.');
  });
});
