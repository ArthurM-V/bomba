import type { Dispatch } from 'react';
import { canStartPumpTest, formatSimulationTime } from '../domain/simulator';
import type { PlantState, PumpId } from '../domain/types';

type Action = Parameters<Dispatch<any>>[0];

function Range({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="range-row"><span>{label}<b>{value.toFixed(step < 1 ? 1 : 0)}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function SimulationControls({ plant, dispatch }: { plant: PlantState; dispatch: Dispatch<Action> }) {
  const pumpToggle = (pump: PumpId, field: 'available' | 'startFailure' | 'noFlow', label: string) => {
    // The UI exposes faults; availability is therefore intentionally inverted.
    const checked = field === 'available' ? !plant.pumps[pump].available : plant.pumps[pump][field];
    return <label className="check-row" key={`${pump}-${field}`}><input type="checkbox" checked={checked} onChange={(event) => dispatch({ type: 'set-pump', pump, field, value: field === 'available' ? !event.target.checked : event.target.checked })} />{label}</label>;
  };
  const activeTest = plant.activeTest;
  const testHint = activeTest
    ? `${activeTest.scheduled ? 'Rotina programada' : 'Teste manual'} em B${activeTest.pump}; termina em ${formatSimulationTime(activeTest.startedAt + plant.settings.testDurationHours)}.`
    : `Próximo teste programado: B${plant.scheduledTestPump} em ${formatSimulationTime(plant.nextScheduledTestAt)}.`;
  return (
    <section className="panel controls-panel">
      <div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">Operação virtual</p><h2>Simulação e testes</h2></div><button className="icon-button" onClick={() => dispatch({ type: 'reset' })} title="Reiniciar simulação">↺</button></div>
      <div className="mode-switch"><button className={plant.mode === 'auto' ? 'selected' : ''} onClick={() => dispatch({ type: 'set-mode', mode: 'auto' })}>Automático</button><button className={plant.mode === 'manual' ? 'selected' : ''} onClick={() => dispatch({ type: 'set-mode', mode: 'manual' })}>Manual</button></div>
      <div className="mt-4 space-y-4">
        <Range label="Nível inferior" value={plant.lowerLevel} min={0} max={100} suffix="%" onChange={(level) => dispatch({ type: 'set-level', tank: 'lower', level })} />
        <Range label="Nível superior" value={plant.upperLevel} min={0} max={100} suffix="%" onChange={(level) => dispatch({ type: 'set-level', tank: 'upper', level })} />
        <Range label="Consumo predial" value={plant.settings.consumptionFlow} min={0} max={4000} suffix=" L/h" onChange={(consumptionFlow) => dispatch({ type: 'set-settings', settings: { consumptionFlow } })} />
        <Range label="Relógio virtual" value={plant.settings.speed} min={300} max={7200} suffix="×" onChange={(speed) => dispatch({ type: 'set-settings', settings: { speed } })} />
      </div>
      <div className="mt-5 border-t border-slate-800 pt-4 space-y-4"><p className="section-label">Parâmetros de proteção</p>
        <Range label="Partida por nível superior" value={plant.settings.startUpperLevel} min={5} max={80} suffix="%" onChange={(startUpperLevel) => dispatch({ type: 'set-settings', settings: { startUpperLevel } })} />
        <Range label="Parada por nível superior" value={plant.settings.stopUpperLevel} min={20} max={94} suffix="%" onChange={(stopUpperLevel) => dispatch({ type: 'set-settings', settings: { stopUpperLevel } })} />
        <Range label="Bloqueio do reservatório inferior" value={plant.settings.lowerBlockLevel} min={1} max={45} suffix="%" onChange={(lowerBlockLevel) => dispatch({ type: 'set-settings', settings: { lowerBlockLevel } })} />
        <Range label="Retorno seguro do inferior" value={plant.settings.lowerRecoveryLevel} min={5} max={60} suffix="%" onChange={(lowerRecoveryLevel) => dispatch({ type: 'set-settings', settings: { lowerRecoveryLevel } })} />
        <Range label="Alarme alto do superior" value={plant.settings.upperAlarmLevel} min={60} max={100} suffix="%" onChange={(upperAlarmLevel) => dispatch({ type: 'set-settings', settings: { upperAlarmLevel } })} />
      </div>
      <div className="mt-5 border-t border-slate-800 pt-4"><p className="section-label">Comando manual</p><div className="grid grid-cols-3 gap-2"><button disabled={plant.mode !== 'manual'} className={plant.manualPump === 1 ? 'button active' : 'button'} onClick={() => dispatch({ type: 'set-manual-pump', pump: 1 })}>Ligar B1</button><button disabled={plant.mode !== 'manual'} className={plant.manualPump === 2 ? 'button active' : 'button'} onClick={() => dispatch({ type: 'set-manual-pump', pump: 2 })}>Ligar B2</button><button disabled={plant.mode !== 'manual'} className="button" onClick={() => dispatch({ type: 'set-manual-pump', pump: null })}>Parar</button></div><p className="hint">Intertravamentos continuam ativos no modo manual.</p></div>
      <div className="mt-5 border-t border-slate-800 pt-4 space-y-4"><p className="section-label">Rotina de testes</p>
        <Range label="Duração do teste" value={plant.settings.testDurationHours * 60} min={5} max={60} suffix=" min" onChange={(minutes) => dispatch({ type: 'set-settings', settings: { testDurationHours: minutes / 60 } })} />
        <Range label="Intervalo da rotina" value={plant.settings.testIntervalHours} min={24} max={336} suffix=" h" onChange={(testIntervalHours) => dispatch({ type: 'set-settings', settings: { testIntervalHours } })} />
        <div className="grid grid-cols-2 gap-2"><button disabled={!canStartPumpTest(plant, 1)} className="button" onClick={() => dispatch({ type: 'run-test', pump: 1 })}>Testar B1</button><button disabled={!canStartPumpTest(plant, 2)} className="button" onClick={() => dispatch({ type: 'run-test', pump: 2 })}>Testar B2</button></div>
        <p className="hint">Exige automático, sem demanda, inferior em recuperação e superior entre partida e 70%.</p><p className="hint">{testHint}</p>
      </div>
      <div className="mt-5 border-t border-slate-800 pt-4"><p className="section-label">Injeção de falhas</p><div className="fault-grid"><div><b>Bomba 1</b>{pumpToggle(1, 'startFailure', 'Falha de partida')}{pumpToggle(1, 'noFlow', 'Sem vazão')}{pumpToggle(1, 'available', 'Indisponível')}</div><div><b>Bomba 2</b>{pumpToggle(2, 'startFailure', 'Falha de partida')}{pumpToggle(2, 'noFlow', 'Sem vazão')}{pumpToggle(2, 'available', 'Indisponível')}</div></div></div>
      <button className="pause-button" onClick={() => dispatch({ type: 'toggle-pause' })}>{plant.paused ? '▶ Continuar simulação' : 'Ⅱ Pausar simulação'}</button>
    </section>
  );
}
