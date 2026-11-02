import type { Alarm, AlarmRecord, HistoryPoint, PlantState, PumpId, PumpState, SimulationSettings, TestResult } from './types';

export const DEFAULT_SETTINGS: SimulationSettings = {
  lowerCapacity: 140_000,
  upperCapacity: 70_000,
  incomingFlow: 1_200,
  consumptionFlow: 1_000,
  pumpFlow: 7_000,
  speed: 3_600,
  startUpperLevel: 30,
  stopUpperLevel: 85,
  lowerBlockLevel: 15,
  lowerRecoveryLevel: 25,
  upperAlarmLevel: 95,
  testDurationHours: 15 / 60,
  testIntervalHours: 168,
  maxContinuousRunHours: 8,
};

const makePump = (id: PumpId): PumpState => ({
  id,
  running: false,
  available: true,
  startFailure: false,
  noFlow: false,
  runHours: id === 1 ? 10.57 : 8.17,
  continuousRunHours: 0,
  starts: 0,
  noFlowHours: 0,
});

export const createInitialPlant = (): PlantState => ({
  lowerLevel: 82,
  upperLevel: 48,
  mode: 'auto',
  manualPump: null,
  automaticFillRequest: false,
  virtualHours: 0,
  // A restart must be safe to inspect before time starts advancing again.
  paused: true,
  pumps: { 1: makePump(1), 2: makePump(2) },
  settings: { ...DEFAULT_SETTINGS },
  history: [],
  lastHistoryHour: 0,
  activeTest: null,
  testResults: [],
  nextScheduledTestAt: 168,
  scheduledTestPump: 1,
  alarmHistory: [],
});

export type DemonstrationScenario =
  | 'normal'
  | 'filling'
  | 'draining'
  | 'low-water'
  | 'weekly-alternation'
  | 'test-1'
  | 'test-2'
  | 'lead-start-failure'
  | 'lead-no-flow'
  | 'long-running'
  | 'maintenance-due';

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const NO_FLOW_TIMEOUT_HOURS = 10 / 60;
export const TEST_MIN_UPPER_LEVEL_GAIN = 1;
// One-minute simulation steps keep discrete advances faithful to the continuous
// simulator: level limits, tests, failover and alarm timers are all evaluated
// while time is moving, rather than only at the final clock value.
const CLOCK_STEP_HOURS = 1 / 60;
export const getWeeklyLeadPump = (virtualHours: number): PumpId => Math.floor(virtualHours / 168) % 2 === 0 ? 1 : 2;
export const getActivePump = (plant: PlantState): PumpId | null =>
  plant.pumps[1].running ? 1 : plant.pumps[2].running ? 2 : null;

function isPumpEligible(pump: PumpState) {
  return pump.available && !pump.startFailure && !(pump.noFlow && pump.noFlowHours >= NO_FLOW_TIMEOUT_HOURS);
}

function isSafeToPump(plant: PlantState) {
  return plant.lowerLevel > plant.settings.lowerBlockLevel && plant.upperLevel < plant.settings.upperAlarmLevel;
}

function isTestSafe(plant: PlantState, pump: PumpId) {
  return plant.mode === 'auto' &&
    !plant.automaticFillRequest &&
    plant.upperLevel > plant.settings.startUpperLevel &&
    plant.upperLevel < 70 &&
    plant.lowerLevel >= plant.settings.lowerRecoveryLevel &&
    isSafeToPump(plant) &&
    isPumpEligible(plant.pumps[pump]);
}

export function canStartPumpTest(plant: PlantState, pump: PumpId) {
  return plant.activeTest === null && isTestSafe(plant, pump);
}

export function getPumpTestChecklist(plant: PlantState, pump: PumpId) {
  return [
    { label: 'Modo automático', value: plant.mode === 'auto' ? 'Automático' : 'Manual', passed: plant.mode === 'auto' },
    { label: 'Sem demanda de enchimento', value: plant.automaticFillRequest ? 'Há demanda' : 'Sem demanda', passed: !plant.automaticFillRequest },
    { label: 'Nível superior', value: plant.upperLevel.toFixed(1) + '% (entre ' + plant.settings.startUpperLevel + '% e 70%)', passed: plant.upperLevel > plant.settings.startUpperLevel && plant.upperLevel < 70 },
    { label: 'Nível inferior', value: plant.lowerLevel.toFixed(1) + '% (mín. ' + plant.settings.lowerRecoveryLevel + '%)', passed: plant.lowerLevel >= plant.settings.lowerRecoveryLevel },
    { label: 'Bomba disponível', value: isPumpEligible(plant.pumps[pump]) ? 'Disponível' : 'Indisponível/falha', passed: isPumpEligible(plant.pumps[pump]) },
  ];
}

function getTestInterruptionReason(plant: PlantState, pump: PumpId) {
  if (plant.mode !== 'auto') return 'Modo alterado para manual durante o teste.';
  if (plant.automaticFillRequest) return 'Demanda automática de enchimento surgiu durante o teste.';
  if (plant.lowerLevel < plant.settings.lowerRecoveryLevel) return 'Nível inferior abaixo do retorno seguro.';
  if (plant.upperLevel >= 70) return 'Nível superior atingiu o limite seguro para teste.';
  if (plant.lowerLevel <= plant.settings.lowerBlockLevel) return 'Bloqueio por nível inferior baixo.';
  if (plant.upperLevel >= plant.settings.upperAlarmLevel) return 'Bloqueio por nível superior alto.';
  if (plant.pumps[pump].startFailure) return 'Falha de partida detectada na bomba testada.';
  if (plant.pumps[pump].noFlow) return 'Ausência de vazão detectada na bomba testada.';
  if (!plant.pumps[pump].available) return 'Bomba marcada como indisponível.';
  return 'Condição de segurança não atendida durante o teste.';
}

function finishTest(plant: PlantState, test: NonNullable<PlantState['activeTest']>, completed: boolean): TestResult {
  const durationHours = Math.max(0, plant.virtualHours - test.startedAt);
  const upperLevelGain = plant.upperLevel - test.startedUpperLevel;
  const lowerLevelDrop = test.startedLowerLevel - plant.lowerLevel;
  if (!completed) {
    return { id: 'test-' + test.pump + '-' + test.startedAt, pump: test.pump, startedAt: test.startedAt, endedAt: plant.virtualHours, durationHours, upperLevelGain, lowerLevelDrop, status: 'interrupted', reason: getTestInterruptionReason(plant, test.pump), restoredAtVirtualHour: null };
  }
  if (plant.pumps[test.pump].noFlow) {
    return { id: 'test-' + test.pump + '-' + test.startedAt, pump: test.pump, startedAt: test.startedAt, endedAt: plant.virtualHours, durationHours, upperLevelGain, lowerLevelDrop, status: 'failed', reason: 'Teste concluído sem vazão confirmada.', restoredAtVirtualHour: null };
  }
  if (upperLevelGain < TEST_MIN_UPPER_LEVEL_GAIN) {
    return { id: 'test-' + test.pump + '-' + test.startedAt, pump: test.pump, startedAt: test.startedAt, endedAt: plant.virtualHours, durationHours, upperLevelGain, lowerLevelDrop, status: 'failed', reason: 'Ganho no reservatório superior abaixo de ' + TEST_MIN_UPPER_LEVEL_GAIN.toFixed(1) + '%.', restoredAtVirtualHour: null };
  }
  return { id: 'test-' + test.pump + '-' + test.startedAt, pump: test.pump, startedAt: test.startedAt, endedAt: plant.virtualHours, durationHours, upperLevelGain, lowerLevelDrop, status: 'approved', reason: 'Partida confirmada e ganho de nível superior de pelo menos ' + TEST_MIN_UPPER_LEVEL_GAIN.toFixed(1) + '%.', restoredAtVirtualHour: null };
}

function chooseAutomaticPump(plant: PlantState, requested: boolean): PumpId | null {
  if (!requested || !isSafeToPump(plant)) return null;

  const lead = getWeeklyLeadPump(plant.virtualHours);
  const reserve: PumpId = lead === 1 ? 2 : 1;
  const active = getActivePump(plant);
  if (active !== null && isPumpEligible(plant.pumps[active])) {
    return active;
  }
  return [lead, reserve].find((id) => isPumpEligible(plant.pumps[id])) ?? null;
}

function chooseManualPump(plant: PlantState): PumpId | null {
  if (!isSafeToPump(plant) || plant.manualPump === null) return null;
  return isPumpEligible(plant.pumps[plant.manualPump]) ? plant.manualPump : null;
}

function stepPlantByHours(previous: PlantState, dtHours: number): PlantState {
  const settings = previous.settings;
  const virtualHours = previous.virtualHours + dtHours;

  let automaticFillRequest = previous.automaticFillRequest;
  if (previous.upperLevel <= settings.startUpperLevel) automaticFillRequest = true;
  if (previous.upperLevel >= settings.stopUpperLevel) automaticFillRequest = false;
  if (previous.lowerLevel <= settings.lowerBlockLevel) automaticFillRequest = false;
  if (previous.lowerLevel >= settings.lowerRecoveryLevel && previous.upperLevel <= settings.startUpperLevel) automaticFillRequest = true;

  const base: PlantState = { ...previous, virtualHours, automaticFillRequest };
  let activeTest = base.activeTest;
  let testResults = base.testResults;
  let restoredSpeed: number | null = null;
  let nextScheduledTestAt = base.nextScheduledTestAt;
  let scheduledTestPump = base.scheduledTestPump;

  if (activeTest === null && base.virtualHours >= nextScheduledTestAt && canStartPumpTest(base, scheduledTestPump)) {
    activeTest = { pump: scheduledTestPump, startedAt: base.virtualHours, startedUpperLevel: base.upperLevel, startedLowerLevel: base.lowerLevel, previousSpeed: base.settings.speed, scheduled: true };
  }

  let selectedPump: PumpId | null;
  if (activeTest !== null) {
    const completed = base.virtualHours - activeTest.startedAt >= settings.testDurationHours;
    if (!isTestSafe(base, activeTest.pump) || completed) {
      const result = finishTest(base, activeTest, completed);
      testResults = [...base.testResults, result].slice(-50);
      restoredSpeed = activeTest.previousSpeed;
      if (activeTest.scheduled) {
        nextScheduledTestAt = base.virtualHours + settings.testIntervalHours;
        scheduledTestPump = activeTest.pump === 1 ? 2 : 1;
      }
      activeTest = null;
      selectedPump = base.mode === 'auto'
        ? chooseAutomaticPump(base, automaticFillRequest)
        : chooseManualPump(base);
    } else {
      selectedPump = activeTest.pump;
    }
  } else {
    selectedPump = base.mode === 'auto'
      ? chooseAutomaticPump(base, automaticFillRequest)
      : chooseManualPump(base);
  }

  const pumps: Record<PumpId, PumpState> = { 1: { ...base.pumps[1] }, 2: { ...base.pumps[2] } };
  ([1, 2] as PumpId[]).forEach((id) => {
    const wasRunning = pumps[id].running;
    const running = selectedPump === id;
    pumps[id].running = running;
    pumps[id].runHours += running ? dtHours : 0;
    pumps[id].continuousRunHours = running ? pumps[id].continuousRunHours + dtHours : 0;
    pumps[id].starts += running && !wasRunning ? 1 : 0;
    pumps[id].noFlowHours = running && pumps[id].noFlow ? pumps[id].noFlowHours + dtHours : 0;
  });

  const activePump = selectedPump === null ? null : pumps[selectedPump];
  const transferredLiters = activePump && !activePump.noFlow ? settings.pumpFlow * dtHours : 0;
  const lowerLiters = clamp(
    previous.lowerLevel + ((settings.incomingFlow * dtHours - transferredLiters) / settings.lowerCapacity) * 100,
  );
  const upperLiters = clamp(
    previous.upperLevel + ((transferredLiters - settings.consumptionFlow * dtHours) / settings.upperCapacity) * 100,
  );

  const next: PlantState = {
    ...base,
    lowerLevel: lowerLiters,
    upperLevel: upperLiters,
    pumps,
    settings: restoredSpeed === null ? base.settings : { ...base.settings, speed: restoredSpeed },
    activeTest,
    testResults,
    nextScheduledTestAt,
    scheduledTestPump,
  };
  if (virtualHours - previous.lastHistoryHour >= 0.25 - 1e-9) {
    const point: HistoryPoint = {
      virtualHour: virtualHours,
      lowerLevel: lowerLiters,
      upperLevel: upperLiters,
      activePump: selectedPump,
      pump1RunHours: pumps[1].runHours,
      pump1Starts: pumps[1].starts,
      pump2RunHours: pumps[2].runHours,
      pump2Starts: pumps[2].starts,
      alarmIds: getAlarms(next).filter((alarm) => alarm.severity !== 'info').map((alarm) => alarm.id),
    };
    next.history = [...previous.history, point].slice(-96);
    next.lastHistoryHour = virtualHours;
  }
  next.alarmHistory = updateAlarmHistory(next.alarmHistory, next);
  return next;
}

export function stepPlant(previous: PlantState, realSeconds: number): PlantState {
  if (previous.paused || !Number.isFinite(realSeconds) || realSeconds < 0) return previous;
  return stepPlantByHours(previous, (realSeconds * previous.settings.speed) / 3600);
}

/**
 * Advances the virtual clock while running the hydraulic model at one-minute
 * intervals. It deliberately works while the live clock is paused, so an
 * operator can inspect the plant and move it forward in controlled steps.
 */
export function advancePlantByHours(previous: PlantState, hours: number): PlantState {
  if (!Number.isFinite(hours) || hours <= 0) return previous;

  const wasPaused = previous.paused;
  let next = wasPaused ? { ...previous, paused: false } : previous;
  let remaining = hours;

  while (remaining > CLOCK_STEP_HOURS) {
    next = stepPlantByHours(next, CLOCK_STEP_HOURS);
    remaining -= CLOCK_STEP_HOURS;
  }
  if (remaining > 0) next = stepPlantByHours(next, remaining);

  return wasPaused ? { ...next, paused: true } : next;
}

/**
 * Returns a clean, paused and repeatable starting point for each item in the
 * demonstration.  Scenarios deliberately begin from a fresh plant so one
 * demonstration never leaks a fault or a manual command into the next one.
 */
export function createDemonstrationScenario(scenario: DemonstrationScenario): PlantState {
  const plant = createInitialPlant();
  plant.paused = true;
  plant.upperLevel = 60;

  const startAndPause = (hours = CLOCK_STEP_HOURS) => advancePlantByHours(plant, hours);

  switch (scenario) {
    case 'normal':
      return plant;
    case 'filling':
      plant.upperLevel = 29;
      return startAndPause();
    case 'draining':
      plant.upperLevel = 65;
      plant.settings.consumptionFlow = 2_000;
      return startAndPause(1);
    case 'low-water':
      // The lower reservoir starts safely above the interlock, then falls
      // during recalque until the protective interlock stops the pump.
      plant.upperLevel = 29;
      plant.lowerLevel = 16;
      plant.settings.incomingFlow = 0;
      return startAndPause(0.25);
    case 'weekly-alternation':
      // Crossing 168 h switches the weekly lead.  The demand below is created
      // afterwards so B2 visibly performs the next pumping cycle.
      plant.virtualHours = 168;
      plant.nextScheduledTestAt = 336;
      plant.upperLevel = 29;
      return startAndPause();
    case 'test-1':
    case 'test-2': {
      const pump: PumpId = scenario === 'test-1' ? 1 : 2;
      plant.lowerLevel = 50;
      plant.upperLevel = 50;
      // 60× equals one simulated minute per real second, making the
      // 15-minute individual test observable during the presentation.
      plant.settings.speed = 60;
      plant.activeTest = { pump, startedAt: plant.virtualHours, startedUpperLevel: plant.upperLevel, startedLowerLevel: plant.lowerLevel, previousSpeed: DEFAULT_SETTINGS.speed, scheduled: false };
      return { ...startAndPause(), paused: false };
    }
    case 'lead-start-failure':
      plant.upperLevel = 29;
      plant.pumps[1].startFailure = true;
      return startAndPause();
    case 'lead-no-flow':
      plant.upperLevel = 29;
      plant.pumps[1].noFlow = true;
      // Ten minutes causes the protective detection; another minute transfers
      // the demand to the reserve pump.
      return startAndPause(NO_FLOW_TIMEOUT_HOURS + CLOCK_STEP_HOURS);
    case 'long-running':
      plant.upperLevel = 29;
      // Consumption equal to pump flow keeps the upper tank below the stop
      // threshold while B1 runs long enough to trigger the preventive limit.
      plant.settings.consumptionFlow = plant.settings.pumpFlow;
      return startAndPause(plant.settings.maxContinuousRunHours + CLOCK_STEP_HOURS);
    case 'maintenance-due':
      plant.upperLevel = 29;
      plant.pumps[1].runHours = 99.9;
      return startAndPause(0.25);
  }
}

export function getAlarms(plant: PlantState): Alarm[] {
  const alarms: Alarm[] = [];
  const active = getActivePump(plant);
  if (plant.lowerLevel <= plant.settings.lowerBlockLevel) {
    alarms.push({ id: 'low-lower', title: 'Reservatório inferior baixo', detail: 'Bombeamento bloqueado para proteger as bombas.', severity: 'critical' });
  }
  if (plant.upperLevel >= plant.settings.upperAlarmLevel) {
    alarms.push({ id: 'high-upper', title: 'Nível superior crítico', detail: 'Risco de transbordamento no reservatório superior.', severity: 'critical' });
  }
  ([1, 2] as PumpId[]).forEach((id) => {
    const pump = plant.pumps[id];
    if (pump.startFailure) alarms.push({ id: `start-${id}`, title: `Falha de partida Bomba ${id}`, detail: 'Comando de partida emitido, mas a bomba não entrou em operação.', severity: 'critical' });
    if (!pump.available) alarms.push({ id: `unavailable-${id}`, title: `Bomba ${id} indisponível`, detail: 'Equipamento colocado em manutenção simulada.', severity: 'warning' });
    if (pump.running && pump.noFlow && pump.noFlowHours >= NO_FLOW_TIMEOUT_HOURS) {
      alarms.push({ id: `flow-${id}`, title: `Sem vazão na Bomba ${id}`, detail: 'Motor ligado sem elevação de nível detectada.', severity: 'critical' });
    }
    if (pump.runHours >= 100) alarms.push({ id: `maintenance-${id}`, title: `Manutenção preventiva Bomba ${id}`, detail: 'Horímetro acima de 100 horas simuladas.', severity: 'warning' });
    if (pump.continuousRunHours >= plant.settings.maxContinuousRunHours) {
      alarms.push({ id: `continuous-${id}`, title: `Tempo contínuo excessivo Bomba ${id}`, detail: `Bomba ligada por mais de ${plant.settings.maxContinuousRunHours} h sem parada.`, severity: 'warning' });
    }
  });
  const latestTest = plant.testResults[plant.testResults.length - 1];
  if (latestTest && latestTest.status !== 'approved' && latestTest.restoredAtVirtualHour === null) {
    alarms.push({ id: 'test-failed-' + latestTest.pump, title: 'Teste reprovado Bomba ' + latestTest.pump, detail: latestTest.reason, severity: 'warning' });
  }
  if (active !== null) alarms.push({ id: 'pumping', title: `Bomba ${active} em operação`, detail: 'Recalque em andamento.', severity: 'info' });
  return alarms;
}

export function updateAlarmHistory(history: AlarmRecord[], plant: PlantState): AlarmRecord[] {
  const activeAlarms = getAlarms(plant).filter((alarm) => alarm.severity !== 'info');
  const activeIds = new Set(activeAlarms.map((alarm) => alarm.id));
  const recordedAt = new Date().toISOString();
  const next = history.map((record) => record.clearedAtVirtualHour === null && !activeIds.has(record.id)
    ? { ...record, clearedAtVirtualHour: plant.virtualHours, clearedAt: recordedAt }
    : record);

  activeAlarms.forEach((alarm) => {
    const isAlreadyOpen = next.some((record) => record.id === alarm.id && record.clearedAtVirtualHour === null);
    if (!isAlreadyOpen) {
      next.push({
        ...alarm,
        occurredAtVirtualHour: plant.virtualHours,
        acknowledgedAtVirtualHour: null,
        clearedAtVirtualHour: null,
        occurredAt: recordedAt,
        acknowledgedAt: null,
        clearedAt: null,
      });
    }
  });
  return next.slice(-100);
}

export const formatSimulationTime = (hours: number) => {
  const weeks = Math.floor(hours / 168);
  const days = Math.floor((hours % 168) / 24);
  const hour = Math.floor(hours % 24).toString().padStart(2, '0');
  const minute = Math.floor((hours % 1) * 60).toString().padStart(2, '0');
  return `${weeks} sem · ${days} d · ${hour}:${minute}`;
};
