import { describe, expect, it } from 'vitest';
import { canStartPumpTest, createInitialPlant, getActivePump, getAlarms, getWeeklyLeadPump, stepPlant } from './simulator';

describe('simulador hidráulico', () => {
  it('aciona a bomba principal quando o nível superior atinge o limite de partida', () => {
    const plant = createInitialPlant();
    plant.upperLevel = 25;
    const next = stepPlant(plant, 1);
    expect(getActivePump(next)).toBe(1);
  });

  it('bloqueia o recalque se o nível inferior estiver em condição crítica', () => {
    const plant = createInitialPlant();
    plant.upperLevel = 20;
    plant.lowerLevel = 10;
    expect(getActivePump(stepPlant(plant, 1))).toBeNull();
  });

  it('mantém o bloqueio por nível inferior também no modo manual', () => {
    const plant = createInitialPlant();
    plant.mode = 'manual';
    plant.manualPump = 1;
    plant.lowerLevel = 10;

    expect(getActivePump(stepPlant(plant, 1))).toBeNull();
  });

  it('bloqueia o recalque manual no alarme de nível superior alto', () => {
    const plant = createInitialPlant();
    plant.mode = 'manual';
    plant.manualPump = 1;
    plant.upperLevel = plant.settings.upperAlarmLevel;

    expect(getActivePump(stepPlant(plant, 1))).toBeNull();
  });

  it('aciona a reserva quando a principal apresenta falha de partida', () => {
    const plant = createInitialPlant();
    plant.upperLevel = 20;
    plant.pumps[1].startFailure = true;
    expect(getActivePump(stepPlant(plant, 1))).toBe(2);
  });

  it('alterna a bomba principal após sete dias simulados', () => {
    expect(getWeeklyLeadPump(0)).toBe(1);
    expect(getWeeklyLeadPump(168)).toBe(2);
  });

  it('alarma ausência de vazão após dez minutos e transfere para a reserva', () => {
    const plant = createInitialPlant();
    plant.upperLevel = 20;
    plant.pumps[1].noFlow = true;

    const afterTimeout = stepPlant(plant, 0.17);
    expect(getAlarms(afterTimeout).map((alarm) => alarm.id)).toContain('flow-1');

    const afterFailover = stepPlant(afterTimeout, 0.01);
    expect(getActivePump(afterFailover)).toBe(2);
  });

  it('executa o teste individual apenas com condições seguras e o encerra na duração configurada', () => {
    const plant = createInitialPlant();
    plant.lowerLevel = 50;
    plant.upperLevel = 50;
    plant.settings.testDurationHours = 0.25;

    expect(canStartPumpTest(plant, 1)).toBe(true);
    const started = { ...plant, activeTest: { pump: 1 as const, startedAt: 0, scheduled: false } };
    expect(getActivePump(stepPlant(started, 0.1))).toBe(1);

    const completed = stepPlant(started, 0.26);
    expect(completed.activeTest).toBeNull();
    expect(getActivePump(completed)).toBeNull();
  });

  it('agenda testes alternados quando a rotina semanal vence e registra a ocorrência de alarmes', () => {
    const plant = createInitialPlant();
    plant.lowerLevel = 50;
    plant.upperLevel = 50;
    plant.virtualHours = 168;
    plant.nextScheduledTestAt = 168;

    const testing = stepPlant(plant, 0.01);
    expect(testing.activeTest).toMatchObject({ pump: 1, scheduled: true });
    expect(getActivePump(testing)).toBe(1);

    const alarmPlant = createInitialPlant();
    alarmPlant.lowerLevel = 10;
    const alarmed = stepPlant(alarmPlant, 0.01);
    expect(alarmed.alarmHistory).toMatchObject([{ id: 'low-lower', acknowledgedAtVirtualHour: null, clearedAtVirtualHour: null }]);
  });
});
