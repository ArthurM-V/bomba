import type { Alarm, AlarmRecord, PlantState } from '../domain/types';
import { downloadReportCsv } from '../services/report';

type Props = { plant: PlantState; alarms: Alarm[]; alarmHistory?: AlarmRecord[]; source: 'local' | 'esp32' };

export function ReportActions({ plant, alarms, alarmHistory, source }: Props) {
  return (
    <section className="panel report-actions no-print">
      <div><p className="eyebrow">Entrega</p><h2>Relatório</h2><p className="hint">Inclui níveis, horímetros, partidas, falhas, alarmes reconhecidos e histórico operacional.</p></div>
      <div className="report-buttons"><button className="button" onClick={() => downloadReportCsv(plant, alarms, source, alarmHistory)}>↓ Exportar CSV</button><button className="button" onClick={() => window.print()}>⎙ Imprimir / PDF</button></div>
    </section>
  );
}
