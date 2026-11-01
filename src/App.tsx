import { AlarmList } from './components/AlarmList';
import { HistoryChart } from './components/HistoryChart';
import { ProcessView } from './components/ProcessView';
import { ReportActions } from './components/ReportActions';
import { SimulationControls } from './components/SimulationControls';
import { CloudConnection } from './components/CloudConnection';
import { RemoteControls } from './components/RemoteControls';
import { formatSimulationTime, getActivePump, getAlarms, getWeeklyLeadPump } from './domain/simulator';
import { useRemoteTelemetry } from './hooks/useRemoteTelemetry';
import { useSimulation } from './hooks/useSimulation';

function App() {
  const { state: localState, dispatch } = useSimulation();
  const remote = useRemoteTelemetry();
  const isRemote = remote.plant !== null;
  const state = remote.plant ?? localState;
  const alarms = remote.alarms ?? getAlarms(state);
  const activePump = getActivePump(state);
  const leadPump = getWeeklyLeadPump(state.virtualHours);
  const paused = isRemote ? false : state.paused;
  return (
    <main className="min-h-screen bg-[#061824] text-slate-100">
      <header className="border-b border-cyan-900/60 bg-[#082433] px-5 py-4 md:px-8"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="brand-mark">≈</div><div><p className="eyebrow">SCADA · {isRemote ? 'ESP32 CONECTADO' : 'SIMULADOR HIDRÁULICO'}</p><h1>Sistema de abastecimento de água</h1></div></div><div className={`header-status ${paused ? 'is-paused' : 'is-running'}`}><span className="pulse" />{isRemote ? 'Telemetria em execução' : `Simulação ${paused ? 'pausada' : 'em execução'}`}<span className="divider" />{formatSimulationTime(state.virtualHours)}</div></div></header>
      <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-8">
        <section className="summary-grid"><div className="summary-card"><span>Modo de operação</span><b>{state.mode === 'auto' ? 'Automático' : 'Manual'}</b><small>{state.mode === 'auto' ? 'Controle por nível' : 'Comando supervisionado'}</small></div><div className="summary-card"><span>Bomba principal</span><b>Bomba {leadPump}</b><small>Alternância a cada 7 dias simulados</small></div><div className="summary-card"><span>Recalque atual</span><b>{activePump ? `Bomba ${activePump}` : 'Nenhuma bomba'}</b><small>{activePump ? 'Estado aplicado' : 'Sistema em espera'}</small></div><div className="summary-card"><span>Condição do processo</span><b className={alarms.some((alarm) => alarm.severity === 'critical') ? 'text-rose-300' : 'text-emerald-300'}>{alarms.some((alarm) => alarm.severity === 'critical') ? 'Alarme crítico' : 'Normal'}</b><small>{alarms.filter((alarm) => alarm.severity !== 'info').length} evento(s) ativo(s)</small></div></section>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]"><div className="space-y-6"><ProcessView plant={state} /><section className="panel"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Tendência de níveis</p><h2>Gráfico histórico</h2></div><span className="text-xs text-slate-400">{state.history.length} leitura(s)</span></div><HistoryChart history={state.history} /></section><section className="panel"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">{isRemote ? 'Registro do ESP32' : 'Registro local'}</p><h2>Histórico recente</h2></div><span className="text-xs text-slate-400">{isRemote ? 'Recebido pela API' : 'Persistido no navegador'}</span></div>{state.history.length === 0 ? <div className="empty-state">{isRemote ? 'Aguardando a primeira telemetria do ESP32.' : 'As primeiras medições aparecerão após 15 minutos simulados.'}</div> : <div className="history-list">{state.history.slice(-8).reverse().map((point, index) => <div key={`${point.virtualHour}-${index}`} className="history-row"><span>{formatSimulationTime(point.virtualHour)}</span><b>Inferior {point.lowerLevel.toFixed(1)}%</b><b>Superior {point.upperLevel.toFixed(1)}%</b><span>{point.activePump ? `Bomba ${point.activePump}` : 'Em espera'}</span></div>)}</div>}</section><ReportActions plant={state} alarms={alarms} alarmHistory={isRemote ? [] : localState.alarmHistory} source={isRemote ? 'esp32' : 'local'} /></div><aside className="space-y-6"><CloudConnection configured={remote.configured} status={remote.status} error={remote.error} email={remote.session?.email ?? null} deviceId={remote.deviceId} lastReceivedAt={remote.lastReceivedAt} onLogin={remote.login} onLogout={remote.logout} />{isRemote ? <RemoteControls plant={state} onCommand={remote.sendCommand} latestCommand={remote.latestCommand} /> : <SimulationControls plant={state} dispatch={dispatch} />}<AlarmList alarms={alarms} history={isRemote ? [] : localState.alarmHistory} onAcknowledge={isRemote ? undefined : (id) => dispatch({ type: 'acknowledge-alarm', id})} /></aside></div>
      </div>
    </main>
  );
}

export default App;
