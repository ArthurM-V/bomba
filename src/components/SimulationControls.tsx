import type { Dispatch } from 'react';
import type { PlantState, PumpId } from '../domain/types';

type Action = Parameters<Dispatch<any>>[0];

function Range({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="range-row"><span>{label}<b>{value.toFixed(value < 10 ? 1 : 0)}{suffix}</b></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function SimulationControls({ plant, dispatch }: { plant: PlantState; dispatch: Dispatch<Action> }) {
  const pumpToggle = (pump: PumpId, field: 'available' | 'startFailure' | 'noFlow', label: string) => {
    // The UI exposes faults; availability is therefore intentionally inverted.
    const checked = field === 'available' ? !plant.pumps[pump].available : plant.pumps[pump][field];
    return <label className="check-row" key={`${pump}-${field}`}><input type="checkbox" checked={checked} onChange={(event) => dispatch({ type: 'set-pump', pump, field, value: field === 'available' ? !event.target.checked : event.target.checked })} />{label}</label>;
  };
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
      <div className="mt-5 border-t border-slate-800 pt-4"><p className="section-label">Comando manual</p><div className="grid grid-cols-3 gap-2"><button disabled={plant.mode !== 'manual'} className={plant.manualPump === 1 ? 'button active' : 'button'} onClick={() => dispatch({ type: 'set-manual-pump', pump: 1 })}>Ligar B1</button><button disabled={plant.mode !== 'manual'} className={plant.manualPump === 2 ? 'button active' : 'button'} onClick={() => dispatch({ type: 'set-manual-pump', pump: 2 })}>Ligar B2</button><button disabled={plant.mode !== 'manual'} className="button" onClick={() => dispatch({ type: 'set-manual-pump', pump: null })}>Parar</button></div><p className="hint">Intertravamentos continuam ativos no modo manual.</p></div>
      <div className="mt-5 border-t border-slate-800 pt-4"><p className="section-label">Injeção de falhas</p><div className="fault-grid"><div><b>Bomba 1</b>{pumpToggle(1, 'startFailure', 'Falha de partida')}{pumpToggle(1, 'noFlow', 'Sem vazão')}{pumpToggle(1, 'available', 'Indisponível')}</div><div><b>Bomba 2</b>{pumpToggle(2, 'startFailure', 'Falha de partida')}{pumpToggle(2, 'noFlow', 'Sem vazão')}{pumpToggle(2, 'available', 'Indisponível')}</div></div></div>
      <button className="pause-button" onClick={() => dispatch({ type: 'toggle-pause' })}>{plant.paused ? '▶ Continuar simulação' : 'Ⅱ Pausar simulação'}</button>
    </section>
  );
}
