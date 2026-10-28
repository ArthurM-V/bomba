import type { Alarm } from '../domain/types';

const label = { critical: 'Crítico', warning: 'Atenção', info: 'Operação' };

export function AlarmList({ alarms }: { alarms: Alarm[] }) {
  const operational = alarms.filter((alarm) => alarm.severity !== 'info');
  return (
    <section className="panel h-full">
      <div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Eventos do processo</p><h2>Alarmes</h2></div><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{operational.length}</span></div>
      <div className="space-y-2">
        {operational.length === 0 ? <div className="empty-state">Nenhum alarme ativo. Processo em condição normal.</div> : operational.map((alarm) => (
          <div className={`alarm ${alarm.severity}`} key={alarm.id}>
            <div><strong>{alarm.title}</strong><p>{alarm.detail}</p></div><span>{label[alarm.severity]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
