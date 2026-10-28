import { AlarmList } from './components/AlarmList';
import { ProcessView } from './components/ProcessView';
import { SimulationControls } from './components/SimulationControls';
import { formatSimulationTime, getActivePump, getAlarms, getWeeklyLeadPump } from './domain/simulator';
import { useSimulation } from './hooks/useSimulation';

function App() {
  const { state, dispatch } = useSimulation();
  const alarms = getAlarms(state);
  const activePump = getActivePump(state);
  const leadPump = getWeeklyLeadPump(state.virtualHours);
  return (
    <main className="min-h-screen bg-[#061824] text-slate-100">
      <header className="border-b border-cyan-900/60 bg-[#082433] px-5 py-4 md:px-8"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="brand-mark">≈</div><div><p className="eyebrow">SCADA · SIMULADOR HIDRÁULICO</p><h1>Sistema de abastecimento de água</h1></div></div><div className={`header-status ${state.paused ? 'is-paused' : 'is-running'}`}><span className="pulse" />Simulação {state.paused ? 'pausada' : 'em execução'}<span className="divider" />{formatSimulationTime(state.virtualHours)}</div></div></header>
      <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-8">
        <section className="summary-grid"><div className="summary-card"><span>Modo de operação</span><b>{state.mode === 'auto' ? 'Automático' : 'Manual'}</b><small>{state.mode === 'auto' ? 'Controle por nível' : 'Comando supervisionado'}</small></div><div className="summary-card"><span>Bomba principal</span><b>Bomba {leadPump}</b><small>Alternância a cada 7 dias simulados</small></div><div className="summary-card"><span>Recalque atual</span><b>{activePump ? `Bomba ${activePump}` : 'Nenhuma bomba'}</b><small>{activePump ? 'Estado aplicado' : 'Sistema em espera'}</small></div><div className="summary-card"><span>Condição do processo</span><b className={alarms.some((alarm) => alarm.severity === 'critical') ? 'text-rose-300' : 'text-emerald-300'}>{alarms.some((alarm) => alarm.severity === 'critical') ? 'Alarme crítico' : 'Normal'}</b><small>{alarms.filter((alarm) => alarm.severity !== 'info').length} evento(s) ativo(s)</small></div></section>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]"><div className="space-y-6"><ProcessView plant={state} /><section className="panel"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Registro local</p><h2>Histórico recente</h2></div><span className="text-xs text-slate-400">Persistido no navegador</span></div>{state.history.length === 0 ? <div className="empty-state">As primeiras medições aparecerão após 15 minutos simulados.</div> : <div className="history-list">{state.history.slice(-8).reverse().map((point) => <div key={point.virtualHour} className="history-row"><span>{formatSimulationTime(point.virtualHour)}</span><b>Inferior {point.lowerLevel.toFixed(1)}%</b><b>Superior {point.upperLevel.toFixed(1)}%</b><span>{point.activePump ? `Bomba ${point.activePump}` : 'Em espera'}</span></div>)}</div>}</section></div><aside className="space-y-6"><SimulationControls plant={state} dispatch={dispatch} /><AlarmList alarms={alarms} /></aside></div>
      </div>
    </main>
  );
}

export default App;
