import { getActivePump, getWeeklyLeadPump, isLowerLocked } from './simulator';
import type { Alarm, AlarmRecord, PlantState, PumpId } from './types';

export type ConditionLevel = 'normal' | 'warning' | 'critical';

export type ProcessCondition = {
  level: ConditionLevel;
  label: string;
  detail: string;
  alarmSummary: string;
};

const severityRank = { critical: 2, warning: 1, info: 0 } as const;

export function getProcessCondition(
  plant: PlantState,
  alarms: Alarm[],
  alarmHistory: AlarmRecord[],
  isRemote: boolean,
): ProcessCondition {
  const settings = plant.settings;
  const active = alarms
    .filter((alarm) => alarm.severity !== 'info')
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  const pending = isRemote ? 0 : alarmHistory.filter((record) => record.acknowledgedAtVirtualHour === null).length;
  const alarmSummary = active.length === 0 && pending === 0
    ? 'Sem alarmes'
    : active.length + ' alarme(s) ativo(s)' + (isRemote ? '' : ' · ' + pending + ' a reconhecer');

  const running = getActivePump(plant);
  const lead = getWeeklyLeadPump(plant.virtualHours);
  const faulty = ([1, 2] as PumpId[]).filter((id) => {
    const pump = plant.pumps[id];
    return !pump.available || pump.startFailure || pump.noFlow;
  });
  const suffix = [
    plant.mode === 'manual' ? 'modo manual' : '',
    !isRemote && plant.paused ? 'simulação pausada' : '',
  ].filter(Boolean).join(' · ');
  const result = (level: ConditionLevel, label: string, detail: string): ProcessCondition => ({
    level,
    label,
    detail: suffix ? detail + ' · ' + suffix : detail,
    alarmSummary,
  });
  const top = active[0];
  const more = active.length > 1 ? ' (+' + (active.length - 1) + ' ativo(s))' : '';

  if (isLowerLocked(plant)) {
    return result('critical', 'Recalque bloqueado', 'Reservatório inferior em ' + plant.lowerLevel.toFixed(1) + '% (bloqueio até recuperar ' + settings.lowerRecoveryLevel + '%). Bombas protegidas.');
  }
  if (plant.upperLevel >= settings.upperAlarmLevel) {
    return result('critical', 'Risco de transbordamento', 'Reservatório superior em ' + plant.upperLevel.toFixed(1) + '% (alarme em ' + settings.upperAlarmLevel + '%). Recalque bloqueado.');
  }
  if (top?.severity === 'critical') return result('critical', top.title, top.detail + more);
  if (faulty.length > 0) {
    const names = faulty.map((id) => 'B' + id).join(' e ');
    return result('warning', 'Redundância reduzida', names + ' com falha ou indisponível. ' + (running ? 'Bomba ' + running + ' mantém o recalque.' : 'Nenhuma bomba em recalque.'));
  }
  if (top) return result('warning', top.title, top.detail + more);
  if (plant.activeTest) {
    return result('normal', 'Teste individual da Bomba ' + plant.activeTest.pump, 'Rotina em andamento; a outra bomba permanece em reserva.');
  }
  if (running) {
    return result('normal', 'Recalque em andamento', 'Bomba ' + running + ' (' + (running === lead ? 'principal' : 'reserva') + ') · superior em ' + plant.upperLevel.toFixed(1) + '%.');
  }
  return result('normal', 'Em espera', 'Níveis na faixa: RI ' + plant.lowerLevel.toFixed(1) + '% · RS ' + plant.upperLevel.toFixed(1) + '%.');
}
