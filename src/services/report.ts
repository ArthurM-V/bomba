import type { Alarm, AlarmRecord, PlantState } from '../domain/types';

type CsvCell = string | number;

function csv(value: CsvCell) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const yesNo = (value: boolean) => value ? 'Sim' : 'Não';
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—';

export function buildReportCsv(plant: PlantState, alarms: Alarm[], source: 'local' | 'esp32', alarmHistory: AlarmRecord[] = []) {
  const rows: CsvCell[][] = [
    ['Relatório SCADA - Abastecimento de Água'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Origem', source === 'esp32' ? 'Telemetria ESP32' : 'Simulador local'],
    [],
    ['Resumo atual'],
    ['Nível inferior (%)', plant.lowerLevel.toFixed(2)],
    ['Nível superior (%)', plant.upperLevel.toFixed(2)],
    ['Modo', plant.mode],
    ['Bomba manual', plant.manualPump ?? 'Nenhuma'],
    [],
    ['Bomba', 'Horas acumuladas', 'Partidas', 'Em operação', 'Disponível', 'Falha de partida', 'Sem vazão'],
    [1, plant.pumps[1].runHours.toFixed(3), plant.pumps[1].starts, yesNo(plant.pumps[1].running), yesNo(plant.pumps[1].available), yesNo(plant.pumps[1].startFailure), yesNo(plant.pumps[1].noFlow)],
    [2, plant.pumps[2].runHours.toFixed(3), plant.pumps[2].starts, yesNo(plant.pumps[2].running), yesNo(plant.pumps[2].available), yesNo(plant.pumps[2].startFailure), yesNo(plant.pumps[2].noFlow)],
    [],
    ['Parâmetros ativos'],
    ['Partida superior (%)', plant.settings.startUpperLevel],
    ['Parada superior (%)', plant.settings.stopUpperLevel],
    ['Bloqueio inferior (%)', plant.settings.lowerBlockLevel],
    ['Recuperação inferior (%)', plant.settings.lowerRecoveryLevel],
    ['Alarme alto superior (%)', plant.settings.upperAlarmLevel],
    ['Duração do teste (min)', (plant.settings.testDurationHours * 60).toFixed(0)],
    ['Intervalo de teste (h)', plant.settings.testIntervalHours],
    [],
    ['Alarmes ativos'],
    ...(alarms.length ? alarms.map((alarm) => [alarm.severity, alarm.title, alarm.detail]) : [['Nenhum']]),
    [],
    ['Histórico de alarmes'],
    ['Ocorrência', 'Hora virtual', 'Severidade', 'Alarme', 'Reconhecimento', 'Normalização'],
    ...(alarmHistory.length ? alarmHistory.map((alarm) => [dateTime(alarm.occurredAt), alarm.occurredAtVirtualHour.toFixed(3), alarm.severity, alarm.title, dateTime(alarm.acknowledgedAt), dateTime(alarm.clearedAt)]) : [['Nenhum evento registrado']]),
    [],
    ['Histórico operacional'],
    ['Hora virtual', 'Nível inferior (%)', 'Nível superior (%)', 'Bomba ativa', 'Horas B1', 'Partidas B1', 'Horas B2', 'Partidas B2'],
    ...plant.history.map((point) => [point.virtualHour.toFixed(3), point.lowerLevel.toFixed(2), point.upperLevel.toFixed(2), point.activePump ?? 'Nenhuma', point.pump1RunHours.toFixed(3), point.pump1Starts, point.pump2RunHours.toFixed(3), point.pump2Starts]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csv).join(';')).join('\r\n')}`;
}

export function downloadReportCsv(plant: PlantState, alarms: Alarm[], source: 'local' | 'esp32', alarmHistory: AlarmRecord[] = []) {
  const content = buildReportCsv(plant, alarms, source, alarmHistory);
  const href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = href;
  link.download = `relatorio-scada-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(href);
}
