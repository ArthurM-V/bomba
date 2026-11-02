import { formatSimulationTime } from '../domain/simulator';
import type { AlarmRecord, PlantState } from '../domain/types';

type Props = { plant: PlantState; alarmHistory: AlarmRecord[]; source: 'local' | 'esp32' };

export function ReportSummary({ plant, alarmHistory, source }: Props) {
  const recentAlarms = alarmHistory.slice(-8).reverse();
  const latestTest = plant.testResults[plant.testResults.length - 1];
  return (
    <section className="panel report-summary">
      <div className="panel-heading"><div><p className="eyebrow">Conteúdo do relatório</p><h2>Indicadores e ocorrências</h2></div><span>{source === 'local' ? 'Simulador local' : 'Telemetria ESP32'}</span></div>
      <div className="report-indicators">
        {[1, 2].map((id) => {
          const pump = plant.pumps[id as 1 | 2];
          return <div className="metric" key={id}><b>Bomba {id}</b><span>{pump.runHours.toFixed(2)} h acumuladas · {pump.starts} partidas</span><span>{pump.continuousRunHours.toFixed(2)} h contínuas</span></div>;
        })}
        <div className="metric"><b>{alarmHistory.length}</b><span>ocorrência(s) de alarme</span><span>{alarmHistory.filter((alarm) => alarm.acknowledgedAtVirtualHour === null).length} pendente(s) de reconhecimento</span></div>
        <div className="metric"><b>{latestTest ? 'Teste B' + latestTest.pump + ' ' + latestTest.status : 'Sem teste'}</b><span>{latestTest ? 'RS +' + latestTest.upperLevelGain.toFixed(2) + '% · ' + latestTest.reason : 'Nenhum resultado de teste individual registrado'}</span></div>
      </div>
      <div className="report-occurrences">
        <p className="section-label">Ocorrências de alarme</p>
        {recentAlarms.length === 0 ? <p className="hint">Ainda não há ocorrências registradas.</p> : recentAlarms.map((alarm) => <p key={alarm.id + alarm.occurredAtVirtualHour}><b>{alarm.title}</b> · {formatSimulationTime(alarm.occurredAtVirtualHour)} · {alarm.clearedAtVirtualHour === null ? 'ativo' : 'encerrado'}{alarm.acknowledgedAtVirtualHour === null ? ' · pendente' : ' · reconhecido'}</p>)}
      </div>
    </section>
  );
}
