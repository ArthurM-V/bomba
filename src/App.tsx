import { useEffect, useState } from 'react';
import { AlarmList } from './components/AlarmList';
import { HistoryChart } from './components/HistoryChart';
import { ProcessView } from './components/ProcessView';
import { ReportActions } from './components/ReportActions';
import { ReportSummary } from './components/ReportSummary';
import { TestResultCard } from './components/TestResultCard';
import { SimulationControls } from './components/SimulationControls';
import { CloudConnection } from './components/CloudConnection';
import { RemoteControls } from './components/RemoteControls';
import { formatSimulationTime, getActivePump, getAlarms, getWeeklyLeadPump } from './domain/simulator';
import { getProcessCondition } from './domain/processCondition';
import { hasLiveRemoteTelemetry, useRemoteTelemetry } from './hooks/useRemoteTelemetry';
import { useSimulation } from './hooks/useSimulation';

type Tab = 'operacao' | 'alarmes' | 'historico' | 'conexao';

function App() {
  const [tab, setTab] = useState<Tab>('operacao');
  const [bannerVisible, setBannerVisible] = useState(false);
  const [testNoticeVisible, setTestNoticeVisible] = useState(false);
  const { state: localState, dispatch } = useSimulation();
  const remote = useRemoteTelemetry();
  // Cached telemetry must never keep the dashboard locked in remote mode after
  // a network/Supabase failure; the deterministic local simulator stays usable.
  const isRemote = hasLiveRemoteTelemetry(remote.status, remote.plant);
  const state = remote.plant ?? localState;
  const alarms = remote.alarms ?? getAlarms(state);
  const alarmHistory = isRemote ? [] : localState.alarmHistory;
  const activePump = getActivePump(state);
  const leadPump = getWeeklyLeadPump(state.virtualHours);
  const paused = isRemote ? false : state.paused;
  const currentOperationalAlarms = alarms.filter((alarm) => alarm.severity !== 'info');
  const latestRecordFor = (id: string) => [...alarmHistory].reverse().find((record) => record.id === id);
  // A transient protection remains notified until recognition. An alarm that
  // is still active after recognition stays on the Alarmes tab, but no longer
  // occupies the global action banner or its badge.
  const unacknowledgedCurrentAlarms = currentOperationalAlarms.filter((alarm) => {
    const record = latestRecordFor(alarm.id);
    return record === undefined || record.acknowledgedAtVirtualHour === null;
  });
  const pendingAlarms = isRemote
    ? []
    : alarmHistory
      .filter((record) => record.acknowledgedAtVirtualHour === null)
      .filter((record) => !currentOperationalAlarms.some((alarm) => alarm.id === record.id));
  const notificationAlarms = [...unacknowledgedCurrentAlarms, ...pendingAlarms];
  const notificationKey = notificationAlarms
    .map((alarm) => {
      const record = latestRecordFor(alarm.id);
      return alarm.id + ':' + (record?.occurredAtVirtualHour ?? 'current');
    })
    .sort()
    .join('|');
  const hasCriticalNotification = notificationAlarms.some((alarm) => alarm.severity === 'critical');
  const condition = getProcessCondition(state, alarms, alarmHistory, isRemote);
  const lastTestResult = state.testResults[state.testResults.length - 1];

  useEffect(() => {
    if (!notificationKey) {
      setBannerVisible(false);
      return;
    }
    setBannerVisible(true);
    const timeout = window.setTimeout(() => setBannerVisible(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [notificationKey]);

  useEffect(() => {
    if (!lastTestResult) {
      setTestNoticeVisible(false);
      return;
    }
    setTestNoticeVisible(true);
    const timeout = window.setTimeout(() => setTestNoticeVisible(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [lastTestResult?.id]);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'operacao', label: 'Operação' },
    { id: 'alarmes', label: 'Alarmes', badge: notificationAlarms.length },
    { id: 'historico', label: 'Histórico e relatório' },
    { id: 'conexao', label: isRemote ? 'Conexão remota ●' : 'Conexão remota' },
  ];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand">
            <div className="brand-mark">≈</div>
            <div>
              <p className="eyebrow">CENTRO DE OPERAÇÕES · {isRemote ? 'ESP32 CONECTADO' : 'SIMULADOR HIDRÁULICO'}</p>
              <h1>Sistema de abastecimento de água</h1>
            </div>
          </div>
          <div className="header-meta">
            <div className={`header-status ${paused ? 'is-paused' : 'is-running'}`}>
              <span className="pulse" />
              {isRemote ? 'Telemetria ao vivo' : `Simulação ${paused ? 'pausada' : 'em execução'}`}
            </div>
            <span className="divider" />
            <time>{formatSimulationTime(state.virtualHours)}</time>
          </div>
        </div>
      </header>

      <div className="app-content">
        {bannerVisible && notificationAlarms.length > 0 ? (
          <a
            className={`alert-banner ${hasCriticalNotification ? 'critical' : 'warning'}`}
            href="#alarmes"
            onClick={(event) => { event.preventDefault(); setTab('alarmes'); }}
          >
            <span>{hasCriticalNotification ? 'Ação necessária' : 'Atenção operacional'}</span>
            <strong>{notificationAlarms[0].title}</strong>
            <small>{notificationAlarms.length > 1 ? `+ ${notificationAlarms.length - 1} evento(s) pendente(s)` : notificationAlarms[0].detail}</small>
            <b>Ver alarmes →</b>
          </a>
        ) : null}

        <nav className="tab-bar" role="tablist" aria-label="Seções do supervisório">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`tab-button ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.badge ? <span className="tab-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        {tab === 'operacao' ? (
          <>
            <section className="summary-grid" aria-label="Resumo operacional">
              <div className="summary-card level-card lower"><span>Reservatório inferior</span><b>{state.lowerLevel.toFixed(1)}%</b><small>{Math.round(state.lowerLevel / 100 * state.settings.lowerCapacity).toLocaleString('pt-BR')} L disponíveis</small></div>
              <div className="summary-card level-card upper"><span>Reservatório superior</span><b>{state.upperLevel.toFixed(1)}%</b><small>{Math.round(state.upperLevel / 100 * state.settings.upperCapacity).toLocaleString('pt-BR')} L disponíveis</small></div>
              <div className="summary-card"><span>Bomba em recalque</span><b>{activePump ? `Bomba ${activePump}` : 'Em espera'}</b><small>Principal da semana: Bomba {leadPump}</small></div>
              <div className={`summary-card process-status ${condition.level}`}><span>Condição do processo</span><b>{condition.label}</b><small>{condition.detail}</small><small>{condition.alarmSummary}</small></div>
            </section>
            {testNoticeVisible && lastTestResult ? <section className={['test-completion-notice', lastTestResult.status].join(' ')} role="status"><b>Teste B{lastTestResult.pump} {lastTestResult.status === 'approved' ? 'concluído e aprovado' : lastTestResult.status === 'failed' ? 'concluído e reprovado' : 'interrompido'}</b><span>{lastTestResult.reason}</span></section> : null}
            <div className="workspace-grid">
              <div className="main-workspace">
                <section className="process-workspace">
                  <div className="workspace-heading">
                    <div><p className="eyebrow">Visão operacional</p><h2>Fluxo hidráulico</h2></div>
                    <span className={`process-pill ${activePump ? 'active' : ''}`}>{activePump ? `Bomba ${activePump} em operação` : 'Sistema em espera'}</span>
                  </div>
                  <ProcessView plant={state} />
                </section>
              </div>
              <aside className="operations-rail" aria-label="Comandos e estado operacional">
                {isRemote
                  ? <RemoteControls plant={state} onCommand={remote.sendCommand} latestCommand={remote.latestCommand} />
                  : <SimulationControls plant={state} dispatch={dispatch} />}
              </aside>
            </div>
          </>
        ) : null}

        {tab === 'alarmes' ? (
          <div className="tab-page" id="alarmes">
            <AlarmList
              alarms={[...alarms, ...pendingAlarms]}
              history={alarmHistory}
              onAcknowledge={isRemote ? undefined : (id) => dispatch({ type: 'acknowledge-alarm', id })}
            />
          </div>
        ) : null}

        {tab === 'historico' ? (
          <div className="tab-page">
            <section className="panel data-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Tendência de níveis</p><h2>Histórico operacional</h2></div>
                <span>{state.history.length} leitura(s)</span>
              </div>
              <HistoryChart history={state.history} />
            </section>
            <section className="storage-note" aria-label="Fonte e persistência dos dados">
              <b>{isRemote ? 'Fonte atual: Supabase / ESP32' : 'Fonte atual: IndexedDB local'}</b>
              <span>{isRemote ? 'A tela consulta a telemetria recebida do ESP32 pelo Supabase.' : 'O simulador grava neste navegador os níveis, horímetros, partidas, histórico e alarmes. A operação funciona offline.'}</span>
            </section>
            <section className="panel data-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">{isRemote ? 'Registro do ESP32' : 'Registro local'}</p><h2>Últimas medições</h2></div>
                <span>{isRemote ? 'Recebido pela API' : 'Persistido neste navegador'}</span>
              </div>
              {state.history.length === 0 ? (
                <div className="empty-state">{isRemote ? 'Aguardando a primeira telemetria do ESP32.' : 'As primeiras medições aparecerão após 15 minutos simulados.'}</div>
              ) : (
                <div className="history-list history-records">
                  <div className="history-records__head"><span>Hora</span><span>Níveis</span><span>Recalque</span><span>Horas e partidas</span><span>Falhas</span></div>
                  {state.history.slice(-8).reverse().map((point, index) => (
                    <div key={point.virtualHour + '-' + index} className="history-row history-records__row">
                      <span>{formatSimulationTime(point.virtualHour)}</span>
                      <span><b>RI {point.lowerLevel.toFixed(1)}%</b><b>RS {point.upperLevel.toFixed(1)}%</b></span>
                      <span>{point.activePump ? 'Bomba ' + point.activePump : 'Em espera'}</span>
                      <span>B1 {point.pump1RunHours.toFixed(1)} h · {point.pump1Starts} partida(s)<br />B2 {point.pump2RunHours.toFixed(1)} h · {point.pump2Starts} partida(s)</span>
                      <span className={point.alarmIds.length ? 'history-faults active' : 'history-faults'}>{point.alarmIds.length ? point.alarmIds.join(', ') : 'Sem falhas'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <TestResultCard result={lastTestResult} />
            <ReportSummary plant={state} alarmHistory={alarmHistory} source={isRemote ? 'esp32' : 'local'} />
            <ReportActions plant={state} alarms={alarms} alarmHistory={alarmHistory} source={isRemote ? 'esp32' : 'local'} />
          </div>
        ) : null}

        {tab === 'conexao' ? (
          <div className="tab-page">
            <CloudConnection configured={remote.configured} status={remote.status} error={remote.error} email={remote.session?.email ?? null} deviceId={remote.deviceId} lastReceivedAt={remote.lastReceivedAt} onLogin={remote.login} onLogout={remote.logout} />
          </div>
        )  : null}
      </div>
    </main>
  );
}

export default App;
