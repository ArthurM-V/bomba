import { describe, expect, it } from 'vitest';
import { advancePlantByHours, canStartPumpTest, createDemonstrationScenario, createInitialPlant, getActivePump, getAlarms, getWeeklyLeadPump, stepPlant } from './simulator';

describe('simulador hidráulico', () => {
  it('aciona a bomba principal quando o nível superior atinge o limite de partida', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.upperLevel = 25;
    const next = stepPlant(plant, 1);
    expect(getActivePump(next)).toBe(1);
  });

  it('bloqueia o recalque se o nível inferior estiver em condição crítica', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.upperLevel = 20;
    plant.lowerLevel = 10;
    expect(getActivePump(stepPlant(plant, 1))).toBeNull();
  });

  it('mantém o bloqueio por nível inferior também no modo manual', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.mode = 'manual';
    plant.manualPump = 1;
    plant.lowerLevel = 10;

    expect(getActivePump(stepPlant(plant, 1))).toBeNull();
  });

  it('bloqueia o recalque manual no alarme de nível superior alto', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.mode = 'manual';
    plant.manualPump = 1;
    plant.upperLevel = plant.settings.upperAlarmLevel;

    expect(getActivePump(stepPlant(plant, 1))).toBeNull();
  });

  it('aciona a reserva quando a principal apresenta falha de partida', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.upperLevel = 20;
    plant.pumps[1].startFailure = true;
    expect(getActivePump(stepPlant(plant, 1))).toBe(2);
  });

  it('alterna a bomba principal após sete dias simulados', () => {
    expect(getWeeklyLeadPump(0)).toBe(1);
    expect(getWeeklyLeadPump(168)).toBe(2);
  });

  it('avança o relógio minuto a minuto, mesmo pausado, sem pular o processo', () => {
    const plant = createInitialPlant();
    plant.paused = true;
    plant.upperLevel = 30;

    const advanced = advancePlantByHours(plant, 7);

    expect(advanced.paused).toBe(true);
    expect(advanced.virtualHours).toBeCloseTo(7, 8);
    expect(advanced.upperLevel).toBeGreaterThan(80);
    expect(advanced.upperLevel).toBeLessThanOrEqual(advanced.settings.stopUpperLevel);
    expect(getActivePump(advanced)).toBeNull();
    expect(advanced.pumps[1].runHours).toBeGreaterThan(plant.pumps[1].runHours);
  });

  it('processa a semana inteira e aplica a alternância ao avançar o relógio', () => {
    const advanced = advancePlantByHours(createInitialPlant(), 168);

    expect(advanced.virtualHours).toBeCloseTo(168, 8);
    expect(getWeeklyLeadPump(advanced.virtualHours)).toBe(2);
    expect(advanced.history.length).toBeGreaterThan(0);
  });

  it('alarma ausência de vazão após dez minutos e transfere para a reserva', () => {
    const plant = createInitialPlant();
    plant.paused = false;
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
    const started = { ...plant, paused: false, activeTest: { pump: 1 as const, startedAt: 0, startedUpperLevel: plant.upperLevel, startedLowerLevel: plant.lowerLevel, previousSpeed: plant.settings.speed, scheduled: false } };
    expect(getActivePump(stepPlant(started, 0.1))).toBe(1);

    const completed = stepPlant(started, 0.26);
    expect(completed.activeTest).toBeNull();
    expect(getActivePump(completed)).toBeNull();
  });

  it('agenda testes alternados quando a rotina semanal vence e registra a ocorrência de alarmes', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.lowerLevel = 50;
    plant.upperLevel = 50;
    plant.virtualHours = 168;
    plant.nextScheduledTestAt = 168;

    const testing = stepPlant(plant, 0.01);
    expect(testing.activeTest).toMatchObject({ pump: 1, scheduled: true });
    expect(getActivePump(testing)).toBe(1);

    const alarmPlant = createInitialPlant();
    alarmPlant.paused = false;
    alarmPlant.lowerLevel = 10;
    const alarmed = stepPlant(alarmPlant, 0.01);
    expect(alarmed.alarmHistory).toMatchObject([{ id: 'low-lower', acknowledgedAtVirtualHour: null, clearedAtVirtualHour: null }]);
  });

  it('prepara cenários da demonstração com o processo observável', () => {
    const normal = createDemonstrationScenario('normal');
    const filling = createDemonstrationScenario('filling');
    const draining = createDemonstrationScenario('draining');
    const lowWater = createDemonstrationScenario('low-water');

    expect(normal).toMatchObject({ paused: true, mode: 'auto', upperLevel: 60 });
    expect(getActivePump(filling)).toBe(1);
    expect(draining.upperLevel).toBeLessThan(65);
    expect(lowWater.paused).toBe(false);
    expect(getActivePump(lowWater)).toBe(1);
    const tripped = advancePlantByHours(lowWater, 0.25);
    expect(getActivePump(tripped)).toBeNull();
    expect(getAlarms(tripped).map((alarm) => alarm.id)).toContain('low-lower');
  });

  it('mantém o bloqueio do inferior até o retorno seguro', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.lowerLevel = 14;
    plant.upperLevel = 20;

    const mid = advancePlantByHours(plant, 6);
    expect(mid.lowerLevel).toBeGreaterThan(15);
    expect(mid.lowerLevel).toBeLessThan(25);
    expect(getActivePump(mid)).toBeNull();
    expect(mid.pumps[1].starts + mid.pumps[2].starts).toBe(0);
    expect(getAlarms(mid).map((alarm) => alarm.id)).toContain('low-lower');

    const after = advancePlantByHours(mid, 8);
    expect(getActivePump(after)).toBe(1);
    expect(getAlarms(after).map((alarm) => alarm.id)).not.toContain('low-lower');
  });

  it('demonstra o retorno seguro sem zerar a entrada de água', () => {
    const recovering = createDemonstrationScenario('lower-recovery');

    expect(recovering.paused).toBe(false);
    expect(recovering.settings.incomingFlow).toBeGreaterThan(0);
    expect(getAlarms(recovering).map((alarm) => alarm.id)).toContain('low-lower');

    const recovered = advancePlantByHours(recovering, 13);
    expect(getAlarms(recovered).map((alarm) => alarm.id)).not.toContain('low-lower');
    expect(getActivePump(recovered)).toBe(1);
  });

  it('transita de falta de água para retorno seguro após trinta segundos reais', () => {
    let plant = createDemonstrationScenario('low-water');
    for (let elapsed = 0; elapsed < 30; elapsed += 0.25) plant = stepPlant(plant, 0.25);

    expect(plant.lowerRecoveryTransitionAtVirtualHour).toBeUndefined();
    expect(plant.lowerLockout).toBe(true);
    expect(plant.settings.speed).toBe(3600);
    expect(plant.settings.consumptionFlow).toBe(300);
  });

  it('descarta o comando manual quando a proteção atua', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.mode = 'manual';
    plant.manualPump = 1;
    plant.lowerLevel = 10;

    const tripped = stepPlant(plant, 1);
    expect(tripped.manualPump).toBeNull();
    const refilled = advancePlantByHours({ ...tripped, lowerLevel: 60 }, 1);
    expect(getActivePump(refilled)).toBeNull();
  });

  it('prepara alternância, testes e falhas com o resultado demonstrável', () => {
    const alternation = createDemonstrationScenario('weekly-alternation');
    const testOne = createDemonstrationScenario('test-1');
    const testTwo = createDemonstrationScenario('test-2');
    const failedStart = createDemonstrationScenario('lead-start-failure');
    const noFlow = createDemonstrationScenario('lead-no-flow');

    expect(alternation.virtualHours).toBeGreaterThanOrEqual(168);
    expect(getWeeklyLeadPump(alternation.virtualHours)).toBe(2);
    expect(getActivePump(alternation)).toBe(2);
    expect(testOne.activeTest?.pump).toBe(1);
    expect(getActivePump(testOne)).toBe(1);
    expect(testOne.paused).toBe(false);
    expect(testOne.settings.speed).toBe(60);
    expect(testTwo.activeTest?.pump).toBe(2);
    expect(getActivePump(testTwo)).toBe(2);
    expect(getActivePump(failedStart)).toBe(2);
    expect(getAlarms(failedStart).map((alarm) => alarm.id)).toContain('start-1');
    expect(getActivePump(noFlow)).toBe(2);
    expect(noFlow.alarmHistory.some((alarm) => alarm.id === 'flow-1' && alarm.acknowledgedAtVirtualHour === null)).toBe(true);
  });

  it('gera avisos preventivos por tempo contínuo e horímetro', () => {
    const longRunning = createDemonstrationScenario('long-running');
    const maintenanceDue = createDemonstrationScenario('maintenance-due');

    expect(getActivePump(longRunning)).toBe(1);
    expect(longRunning.pumps[1].continuousRunHours).toBeGreaterThanOrEqual(longRunning.settings.maxContinuousRunHours);
    expect(getAlarms(longRunning).map((alarm) => alarm.id)).toContain('continuous-1');
    expect(maintenanceDue.pumps[1].runHours).toBeGreaterThanOrEqual(100);
    expect(getAlarms(maintenanceDue).map((alarm) => alarm.id)).toContain('maintenance-1');
  });

  it('registra o veredito de um teste individual e restaura a velocidade anterior', () => {
    const testing = createDemonstrationScenario('test-1');
    const completed = advancePlantByHours(testing, 0.3);
    const result = completed.testResults[0];

    expect(completed.activeTest).toBeNull();
    expect(completed.settings.speed).toBe(3600);
    expect(result).toMatchObject({ pump: 1, status: 'approved' });
    expect(result.upperLevelGain).toBeGreaterThanOrEqual(1);
  });

  it('registra um teste interrompido e emite o alarme de reprovação', () => {
    const plant = createDemonstrationScenario('test-1');
    plant.pumps[1].startFailure = true;
    const interrupted = stepPlant(plant, 0.25);

    expect(interrupted.activeTest).toBeNull();
    expect(interrupted.testResults[0]).toMatchObject({ pump: 1, status: 'interrupted' });
    expect(getAlarms(interrupted).map((alarm) => alarm.id)).toContain('test-failed-1');
  });
});
