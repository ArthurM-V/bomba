import type { Alarm, HistoryPoint, PlantState, PumpId, PumpState, SimulationSettings } from './types';

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
};

const makePump = (id: PumpId): PumpState => ({
  id,
  running: false,
  available: true,
  startFailure: false,
  noFlow: false,
  runHours: id === 1 ? 10.57 : 8.17,
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
  paused: false,
  pumps: { 1: makePump(1), 2: makePump(2) },
  settings: { ...DEFAULT_SETTINGS },
  history: [],
  lastHistoryHour: 0,
});

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
export const getWeeklyLeadPump = (virtualHours: number): PumpId => Math.floor(virtualHours / 168) % 2 === 0 ? 1 : 2;
export const getActivePump = (plant: PlantState): PumpId | null =>
  plant.pumps[1].running ? 1 : plant.pumps[2].running ? 2 : null;

function isPumpEligible(pump: PumpState) {
  return pump.available && !pump.startFailure;
}

function chooseAutomaticPump(plant: PlantState, requested: boolean): PumpId | null {
  if (!requested || plant.lowerLevel <= plant.settings.lowerBlockLevel) return null;

  const lead = getWeeklyLeadPump(plant.virtualHours);
  const reserve: PumpId = lead === 1 ? 2 : 1;
  const active = getActivePump(plant);
  if (active !== null && !(plant.pumps[active].noFlow && plant.pumps[active].noFlowHours >= 0.08)) {
    return active;
  }
  return [lead, reserve].find((id) => isPumpEligible(plant.pumps[id])) ?? null;
}

function chooseManualPump(plant: PlantState): PumpId | null {
  if (plant.lowerLevel <= plant.settings.lowerBlockLevel || plant.manualPump === null) return null;
  return isPumpEligible(plant.pumps[plant.manualPump]) ? plant.manualPump : null;
}

export function stepPlant(previous: PlantState, realSeconds: number): PlantState {
  if (previous.paused) return previous;
  const settings = previous.settings;
  const dtHours = (realSeconds * settings.speed) / 3600;
  const virtualHours = previous.virtualHours + dtHours;

  let automaticFillRequest = previous.automaticFillRequest;
  if (previous.upperLevel <= settings.startUpperLevel) automaticFillRequest = true;
  if (previous.upperLevel >= settings.stopUpperLevel) automaticFillRequest = false;
  if (previous.lowerLevel <= settings.lowerBlockLevel) automaticFillRequest = false;
  if (previous.lowerLevel >= settings.lowerRecoveryLevel && previous.upperLevel <= settings.startUpperLevel) automaticFillRequest = true;

  const base: PlantState = { ...previous, virtualHours, automaticFillRequest };
  const selectedPump = base.mode === 'auto'
    ? chooseAutomaticPump(base, automaticFillRequest)
    : chooseManualPump(base);

  const pumps: Record<PumpId, PumpState> = { 1: { ...base.pumps[1] }, 2: { ...base.pumps[2] } };
  ([1, 2] as PumpId[]).forEach((id) => {
    const wasRunning = pumps[id].running;
    const running = selectedPump === id;
    pumps[id].running = running;
    pumps[id].runHours += running ? dtHours : 0;
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

  const next: PlantState = { ...base, lowerLevel: lowerLiters, upperLevel: upperLiters, pumps };
  if (virtualHours - previous.lastHistoryHour >= 0.25) {
    const point: HistoryPoint = { virtualHour: virtualHours, lowerLevel: lowerLiters, upperLevel: upperLiters, activePump: selectedPump };
    next.history = [...previous.history, point].slice(-96);
    next.lastHistoryHour = virtualHours;
  }
  return next;
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
    if (pump.startFailure) alarms.push({ id: `start-${id}`, title: `Falha de partida Bomba ${id}`, detail: 'A bomba foi excluída da seleção automática.', severity: 'critical' });
    if (!pump.available) alarms.push({ id: `unavailable-${id}`, title: `Bomba ${id} indisponível`, detail: 'Equipamento colocado em manutenção simulada.', severity: 'warning' });
    if (pump.running && pump.noFlow && pump.noFlowHours >= 0.03) {
      alarms.push({ id: `flow-${id}`, title: `Sem vazão na Bomba ${id}`, detail: 'Motor ligado sem elevação de nível detectada.', severity: 'critical' });
    }
    if (pump.runHours >= 100) alarms.push({ id: `maintenance-${id}`, title: `Manutenção preventiva Bomba ${id}`, detail: 'Horímetro acima de 100 horas simuladas.', severity: 'warning' });
  });
  if (active !== null) alarms.push({ id: 'pumping', title: `Bomba ${active} em operação`, detail: 'Recalque em andamento.', severity: 'info' });
  return alarms;
}

export const formatSimulationTime = (hours: number) => {
  const weeks = Math.floor(hours / 168);
  const days = Math.floor((hours % 168) / 24);
  const hour = Math.floor(hours % 24).toString().padStart(2, '0');
  const minute = Math.floor((hours % 1) * 60).toString().padStart(2, '0');
  return `${weeks} sem · ${days} d · ${hour}:${minute}`;
};
