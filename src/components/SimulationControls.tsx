import { useState, type Dispatch } from 'react';
import { canStartPumpTest, formatSimulationTime, getPumpTestChecklist, TEST_MIN_UPPER_LEVEL_GAIN, type DemonstrationScenario } from '../domain/simulator';
import type { PlantState, PumpId } from '../domain/types';
import type { SimulationAction } from '../hooks/useSimulation';

type ScenarioButton = { id: DemonstrationScenario; label: string; note: string };

const scenarios: ScenarioButton[] = [
  { id: 'normal', label: 'Estado normal', note: 'Processo estável, sem demanda' },
  { id: 'filling', label: 'Enchimento', note: 'Bomba principal em recalque' },
  { id: 'draining', label: 'Esvaziamento', note: 'Consumo predial em curso' },
  { id: 'low-water', label: 'Falta de água', note: 'Proteção do reservatório inferior' },
  { id: 'lower-recovery', label: 'Retorno seguro', note: 'RI recupera e o recalque é liberado' },
  { id: 'weekly-alternation', label: 'Alternância +1 semana', note: 'Próxima demanda com a reserva' },
  { id: 'test-1', label: 'Testar B1', note: 'Teste individual pronto' },
  { id: 'test-2', label: 'Testar B2', note: 'Teste individual pronto' },
  { id: 'lead-start-failure', label: 'Falha de partida', note: 'Falha na principal e transferência' },
  { id: 'lead-no-flow', label: 'Sem vazão', note: 'Proteção e transferência à reserva' },
];

function Range({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="range-row"><span>{label}<b>{value.toFixed(step < 1 ? 1 : 0)}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function SimulationControls({ plant, dispatch }: { plant: PlantState; dispatch: Dispatch<SimulationAction> }) {
  const [customHours, setCustomHours] = useState('');
  const labelForScenario = (id?: string) => scenarios.find((scenario) => scenario.id === id)?.label ?? 'Nenhum cenário selecionado';
  const hasScenarioTransition = plant.lastScenario !== undefined && plant.scenarioPhase !== undefined && plant.lastScenario !== plant.scenarioPhase;
  const advanceTime = (hours: number) => dispatch({ type: 'advance-time', hours });
  const advanceCustomTime = () => {
    const hours = Number(customHours.replace(',', '.'));
    if (Number.isFinite(hours) && hours > 0) advanceTime(hours);
  };
  const pumpToggle = (pump: PumpId, field: 'available' | 'startFailure' | 'noFlow', label: string) => {
    const checked = field === 'available' ? !plant.pumps[pump].available : plant.pumps[pump][field];
    return <label className="check-row" key={`${pump}-${field}`}><input type="checkbox" checked={checked} onChange={(event) => dispatch({ type: 'set-pump', pump, field, value: field === 'available' ? !event.target.checked : event.target.checked })} />{label}</label>;
  };
  const activeTest = plant.activeTest;
  const testHint = activeTest
    ? `${activeTest.scheduled ? 'Rotina programada' : 'Teste manual'} em B${activeTest.pump}; termina em ${formatSimulationTime(activeTest.startedAt + plant.settings.testDurationHours)}.`
    : `Próximo teste programado: B${plant.scheduledTestPump} em ${formatSimulationTime(plant.nextScheduledTestAt)}.`;
  const testMinutesRemaining = activeTest
    ? Math.max(0, (activeTest.startedAt + plant.settings.testDurationHours - plant.virtualHours) * 60)
    : 0;
  const testProgress = activeTest
    ? Math.min(100, Math.max(0, ((plant.virtualHours - activeTest.startedAt) / plant.settings.testDurationHours) * 100))
    : 0;
  const testGain = activeTest ? plant.upperLevel - activeTest.startedUpperLevel : 0;

  return (
    <section className="panel controls-panel">
      <div className="controls-heading">
        <div><p className="eyebrow">Operação virtual</p><h2>Comandos da demonstração</h2></div>
        <button type="button" className="icon-button" onClick={() => dispatch({ type: 'reset' })} title="Reiniciar simulação" aria-label="Reiniciar simulação">↺</button>
      </div>

      <div className="simulation-toolbar" aria-label="Controles rápidos da simulação">
        <button type="button" className="pause-button" onClick={() => dispatch({ type: 'toggle-pause' })}>{plant.paused ? '▶ Continuar' : 'Ⅱ Pausar'}</button>
        <div className="speed-buttons" aria-label="Velocidade virtual">
          {[60, 300, 1800, 3600, 7200].map((speed) => <button type="button" key={speed} className={`button ${plant.settings.speed === speed ? 'active' : ''}`} onClick={() => dispatch({ type: 'set-settings', settings: { speed } })}>{speed}×</button>)}
        </div>
      </div>

      <div className="mode-switch" aria-label="Modo de operação">
        <button type="button" className={plant.mode === 'auto' ? 'selected' : ''} onClick={() => dispatch({ type: 'set-mode', mode: 'auto' })}>Automático</button>
        <button type="button" className={plant.mode === 'manual' ? 'selected' : ''} onClick={() => dispatch({ type: 'set-mode', mode: 'manual' })}>Manual</button>
      </div>

      <section className="scenario-block" aria-labelledby="scenario-title">
        <div><p className="section-label" id="scenario-title">Cenários de demonstração</p><p className="hint">Cada botão prepara um estado isolado, mantendo o relógio virtual. Os testes individuais iniciam em 60× para serem observados.</p></div>
        <div className="scenario-last" role="status"><span>Último cenário testado</span><b>{labelForScenario(plant.lastScenario)}{hasScenarioTransition ? ` → ${labelForScenario(plant.scenarioPhase)}` : ''}</b></div>
        <div className="scenario-grid">
          {scenarios.map((scenario) => <button type="button" key={scenario.id} className="scenario-button" onClick={() => dispatch({ type: 'run-scenario', scenario: scenario.id })}><b>{scenario.label}</b><span>{scenario.note}</span></button>)}
        </div>
        <div className="scenario-recovery"><span>Após demonstrar uma falha, restaure a bomba para retornar à operação normal.</span><div><button type="button" className="restore-pump-button" onClick={() => dispatch({ type: 'restore-pump', pump: 1 })}>Restaurar B1</button><button type="button" className="restore-pump-button" onClick={() => dispatch({ type: 'restore-pump', pump: 2 })}>Restaurar B2</button></div></div>
      </section>

      {activeTest ? <div className="test-status" role="status"><b>Teste individual em andamento: B{activeTest.pump}</b><span>{testMinutesRemaining.toFixed(0)} min simulados restantes · B{activeTest.pump === 1 ? 2 : 1} permanece em reserva</span><div className="test-progress"><i style={{ width: testProgress + '%' }} /></div><span>Ganho RS: {testGain.toFixed(2)}% · aprovação a partir de {TEST_MIN_UPPER_LEVEL_GAIN.toFixed(1)}%</span></div> : null}

      {plant.mode === 'manual' ? <section className="manual-controls" aria-labelledby="manual-title">
        <p className="section-label" id="manual-title">Comando manual</p>
        <div className="grid grid-cols-3 gap-2"><button type="button" className={plant.manualPump === 1 ? 'button active' : 'button'} onClick={() => dispatch({ type: 'set-manual-pump', pump: 1 })}>Ligar B1</button><button type="button" className={plant.manualPump === 2 ? 'button active' : 'button'} onClick={() => dispatch({ type: 'set-manual-pump', pump: 2 })}>Ligar B2</button><button type="button" className="button" onClick={() => dispatch({ type: 'set-manual-pump', pump: null })}>Parar</button></div>
        <p className="hint">Intertravamentos continuam ativos no modo manual.</p>
      </section> : null}

      <details className="advanced-controls">
        <summary>Avançado <span>níveis, tempo, proteções, testes e falhas</span></summary>
        <div className="advanced-content">
          <div className="control-group">
            <p className="section-label">Processo</p>
            <Range label="Nível inferior" value={plant.lowerLevel} min={0} max={100} suffix="%" onChange={(level) => dispatch({ type: 'set-level', tank: 'lower', level })} />
            <Range label="Nível superior" value={plant.upperLevel} min={0} max={100} suffix="%" onChange={(level) => dispatch({ type: 'set-level', tank: 'upper', level })} />
            <Range label="Consumo predial" value={plant.settings.consumptionFlow} min={0} max={4000} suffix=" L/h" onChange={(consumptionFlow) => dispatch({ type: 'set-settings', settings: { consumptionFlow } })} />
          </div>
          <div className="clock-controls">
            <div><p className="section-label">Relógio da simulação</p><p className="clock-reading">{formatSimulationTime(plant.virtualHours)}</p></div>
            <div className="clock-buttons"><button type="button" className="button" onClick={() => advanceTime(1)}>+1 hora</button><button type="button" className="button" onClick={() => advanceTime(24)}>+1 dia</button><button type="button" className="button" onClick={() => advanceTime(168)}>+1 semana</button></div>
            <div className="custom-clock"><label htmlFor="custom-hours">Avançar horas</label><input id="custom-hours" inputMode="decimal" min="0.01" step="0.01" placeholder="Ex.: 12,5" value={customHours} onChange={(event) => setCustomHours(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') advanceCustomTime(); }} /><button type="button" className="button" disabled={!Number.isFinite(Number(customHours.replace(',', '.'))) || Number(customHours.replace(',', '.')) <= 0} onClick={advanceCustomTime}>Avançar</button></div>
          </div>
          <div className="control-group">
            <p className="section-label">Parâmetros de proteção</p>
            <Range label="Partida por nível superior" value={plant.settings.startUpperLevel} min={5} max={80} suffix="%" onChange={(startUpperLevel) => dispatch({ type: 'set-settings', settings: { startUpperLevel } })} />
            <Range label="Parada por nível superior" value={plant.settings.stopUpperLevel} min={20} max={94} suffix="%" onChange={(stopUpperLevel) => dispatch({ type: 'set-settings', settings: { stopUpperLevel } })} />
            <Range label="Bloqueio do reservatório inferior" value={plant.settings.lowerBlockLevel} min={1} max={45} suffix="%" onChange={(lowerBlockLevel) => dispatch({ type: 'set-settings', settings: { lowerBlockLevel } })} />
            <Range label="Retorno seguro do inferior" value={plant.settings.lowerRecoveryLevel} min={5} max={60} suffix="%" onChange={(lowerRecoveryLevel) => dispatch({ type: 'set-settings', settings: { lowerRecoveryLevel } })} />
            <Range label="Alarme alto do superior" value={plant.settings.upperAlarmLevel} min={60} max={100} suffix="%" onChange={(upperAlarmLevel) => dispatch({ type: 'set-settings', settings: { upperAlarmLevel } })} />
            <Range label="Limite de funcionamento contínuo" value={plant.settings.maxContinuousRunHours} min={1} max={24} suffix=" h" onChange={(maxContinuousRunHours) => dispatch({ type: 'set-settings', settings: { maxContinuousRunHours } })} />
          </div>
          <div className="control-group">
            <p className="section-label">Rotina de testes</p>
            <Range label="Duração do teste" value={plant.settings.testDurationHours * 60} min={5} max={60} suffix=" min" onChange={(minutes) => dispatch({ type: 'set-settings', settings: { testDurationHours: minutes / 60 } })} />
            <Range label="Intervalo da rotina" value={plant.settings.testIntervalHours} min={24} max={336} suffix=" h" onChange={(testIntervalHours) => dispatch({ type: 'set-settings', settings: { testIntervalHours } })} />
            <div className="test-checklists">{([1, 2] as PumpId[]).map((pump) => <div className="test-checklist" key={pump}><b>Prontidão B{pump}</b>{getPumpTestChecklist(plant, pump).map((item) => <span key={item.label} className={item.passed ? 'passed' : 'failed'}>{item.passed ? '✓' : '✗'} {item.label}: {item.value}</span>)}</div>)}</div>
            <div className="grid grid-cols-2 gap-2"><button type="button" disabled={!canStartPumpTest(plant, 1)} className="button" onClick={() => dispatch({ type: 'run-test', pump: 1 })}>Testar B1</button><button type="button" disabled={!canStartPumpTest(plant, 2)} className="button" onClick={() => dispatch({ type: 'run-test', pump: 2 })}>Testar B2</button></div>
            <p className="hint">{testHint}</p>
          </div>
          <div className="control-group">
            <p className="section-label">Cenários de alarme preventivo</p>
            <div className="grid grid-cols-2 gap-2"><button type="button" className="button" onClick={() => dispatch({ type: 'run-scenario', scenario: 'long-running' })}>Excesso de tempo ligado</button><button type="button" className="button" onClick={() => dispatch({ type: 'run-scenario', scenario: 'maintenance-due' })}>Manutenção por horas</button></div>
            <p className="hint">Preparam os dois avisos preventivos e pausam o resultado para consulta.</p>
          </div>
          <div className="control-group"><p className="section-label">Injeção de falhas</p><div className="fault-grid"><div><b>Bomba 1</b>{pumpToggle(1, 'startFailure', 'Falha de partida')}{pumpToggle(1, 'noFlow', 'Sem vazão')}{pumpToggle(1, 'available', 'Indisponível')}</div><div><b>Bomba 2</b>{pumpToggle(2, 'startFailure', 'Falha de partida')}{pumpToggle(2, 'noFlow', 'Sem vazão')}{pumpToggle(2, 'available', 'Indisponível')}</div></div></div>
        </div>
      </details>
    </section>
  );
}
