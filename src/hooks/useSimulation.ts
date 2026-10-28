import { useEffect, useReducer, useRef } from 'react';
import { createInitialPlant, stepPlant } from '../domain/simulator';
import type { OperationMode, PlantState, PumpId, SimulationSettings } from '../domain/types';
import { loadPlant, savePlant } from '../services/localStore';

type Action =
  | { type: 'tick'; seconds: number }
  | { type: 'hydrate'; plant: PlantState }
  | { type: 'set-level'; tank: 'lower' | 'upper'; level: number }
  | { type: 'set-settings'; settings: Partial<SimulationSettings> }
  | { type: 'set-mode'; mode: OperationMode }
  | { type: 'set-manual-pump'; pump: PumpId | null }
  | { type: 'toggle-pause' }
  | { type: 'set-pump'; pump: PumpId; field: 'available' | 'startFailure' | 'noFlow'; value: boolean }
  | { type: 'reset' };

function reducer(state: PlantState, action: Action): PlantState {
  switch (action.type) {
    case 'tick': return stepPlant(state, action.seconds);
    case 'hydrate': return action.plant;
    case 'set-level': return { ...state, [action.tank === 'lower' ? 'lowerLevel' : 'upperLevel']: action.level };
    case 'set-settings': return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'set-mode': return { ...state, mode: action.mode, manualPump: action.mode === 'auto' ? null : state.manualPump };
    case 'set-manual-pump': return { ...state, manualPump: action.pump };
    case 'toggle-pause': return { ...state, paused: !state.paused };
    case 'set-pump': return { ...state, pumps: { ...state.pumps, [action.pump]: { ...state.pumps[action.pump], [action.field]: action.value } } };
    case 'reset': return createInitialPlant();
  }
}

export function useSimulation() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialPlant);
  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    loadPlant().then((plant) => plant && dispatch({ type: 'hydrate', plant })).catch(() => undefined);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => dispatch({ type: 'tick', seconds: 0.25 }), 250);
    const persist = window.setInterval(() => savePlant(latestState.current).catch(() => undefined), 2000);
    return () => { window.clearInterval(tick); window.clearInterval(persist); };
  }, []);

  return { state, dispatch };
}
