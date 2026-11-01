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

export function AlarmList({ alarms, history = [], onAcknowledge }: Props) {
  const operational = alarms.filter((alarm) => alarm.severity !== 'info');
  return (
    <section className="panel h-full">
      <div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Eventos do processo</p><h2>Alarmes</h2></div><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{operational.length}</span></div>
      <div className="space-y-2">
        {operational.length === 0 ? <div className="empty-state">Nenhum alarme ativo. Processo em condição normal.</div> : operational.map((alarm) => {
          const record = history.find((item) => item.id === alarm.id && item.clearedAtVirtualHour === null);
          return (
          <div className={`alarm ${alarm.severity}`} key={alarm.id}>
            <div><strong>{alarm.title}</strong><p>{alarm.detail}</p>{record ? <p>Ocorrido em {formatDateTime(record.occurredAt, record.occurredAtVirtualHour)} · {record.acknowledgedAtVirtualHour === null ? 'Pendente' : `Reconhecido em ${formatDateTime(record.acknowledgedAt ?? undefined, record.acknowledgedAtVirtualHour)}`}</p> : null}</div><div className="alarm-actions"><span>{label[alarm.severity]}</span>{record && onAcknowledge && record.acknowledgedAtVirtualHour === null ? <button className="ack-button" onClick={() => onAcknowledge(record.id)}>Reconhecer</button> : null}</div>
          </div>
          );
        })}
      </div>
      {history.length > 0 ? <div className="alarm-history"><p className="section-label">Últimos eventos</p>{history.slice(-5).reverse().map((record) => <p key={`${record.id}-${record.occurredAtVirtualHour}`}>{formatDateTime(record.occurredAt, record.occurredAtVirtualHour)} · {record.title} · {record.clearedAtVirtualHour === null ? 'ativo' : 'normalizado'}{record.acknowledgedAtVirtualHour === null ? '' : ' · reconhecido'}</p>)}</div> : null}
    </section>
  );
}
