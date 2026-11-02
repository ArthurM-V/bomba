import { formatSimulationTime } from '../domain/simulator';
import type { Alarm, AlarmRecord } from '../domain/types';

const label = { critical: 'Crítico', warning: 'Atenção', info: 'Operação' };
const formatDateTime = (value: string | undefined, virtualHour: number) => value
  ? new Date(value).toLocaleString('pt-BR')
  : formatSimulationTime(virtualHour);

type Props = {
  alarms: Alarm[];
  history?: AlarmRecord[];
  onAcknowledge?: (id: string) => void;
};

function alarmState(record: AlarmRecord | undefined) {
  if (!record) return 'Ativo';
  if (record.clearedAtVirtualHour === null) return record.acknowledgedAtVirtualHour === null ? 'Ativo' : 'Ativo · reconhecido';
  return record.acknowledgedAtVirtualHour === null ? 'Encerrado · pendente' : 'Encerrado · reconhecido';
}

export function AlarmList({ alarms, history = [], onAcknowledge }: Props) {
  const operational = [...new Map(alarms.filter((alarm) => alarm.severity !== 'info').map((alarm) => [alarm.id, alarm])).values()];
  const records = [...history].sort((a, b) => b.occurredAtVirtualHour - a.occurredAtVirtualHour);
  const recordFor = (id: string) => records.find((item) => item.id === id);
  const pendingCount = operational.filter((alarm) => {
    const record = recordFor(alarm.id);
    return record === undefined || record.acknowledgedAtVirtualHour === null;
  }).length;

  return (
    <section className="panel alarm-panel">
      <div className="panel-heading"><div><p className="eyebrow">Eventos do processo</p><h2>Alarmes</h2></div><span>{pendingCount} pendente(s)</span></div>

      <div className="active-alarms">
        {operational.length === 0 ? <div className="empty-state">Nenhum alarme ativo ou pendente de reconhecimento.</div> : operational.map((alarm) => {
          const record = recordFor(alarm.id);
          return <div className={`alarm ${alarm.severity}`} key={alarm.id}>
            <div><strong>{alarm.title}</strong><p>{alarm.detail}</p><p><code>{alarm.id}</code> · {record ? formatDateTime(record.occurredAt, record.occurredAtVirtualHour) : 'Evento atual'} · {alarmState(record)}</p></div>
            <div className="alarm-actions"><span>{label[alarm.severity]}</span>{record && onAcknowledge && record.acknowledgedAtVirtualHour === null ? <button type="button" className="ack-button" onClick={() => onAcknowledge(record.id)}>Reconhecer</button> : null}</div>
          </div>;
        })}
      </div>

      <div className="alarm-history">
        <p className="section-label">Registro de ocorrências</p>
        {records.length === 0 ? <p className="hint">Os eventos aparecerão aqui quando a simulação detectar uma condição de alarme.</p> : (
          <div className="alarm-table" role="table" aria-label="Histórico de alarmes">
            <div className="alarm-table__head" role="row"><span>ID / evento</span><span>Data e hora</span><span>Estado</span><span>Ação</span></div>
            {records.map((record) => <div className="alarm-table__row" role="row" key={`${record.id}-${record.occurredAtVirtualHour}`}>
              <span><code>{record.id}</code><b>{record.title}</b></span>
              <span>{formatDateTime(record.occurredAt, record.occurredAtVirtualHour)}</span>
              <span className={record.clearedAtVirtualHour === null ? 'alarm-state active' : 'alarm-state'}>{alarmState(record)}</span>
              <span>{onAcknowledge && record.acknowledgedAtVirtualHour === null ? <button type="button" className="ack-button" onClick={() => onAcknowledge(record.id)}>Reconhecer</button> : '—'}</span>
            </div>)}
          </div>
        )}
      </div>
    </section>
  );
}
