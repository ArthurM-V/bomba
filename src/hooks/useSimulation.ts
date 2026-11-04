import { useEffect, useReducer, useRef } from 'react';
import { advancePlantByHours, canStartPumpTest, createDemonstrationScenario, createInitialPlant, stepPlant, type DemonstrationScenario } from '../domain/simulator';
import type { OperationMode, PlantState, PumpId, SimulationSettings } from '../domain/types';
import { loadPlant, savePlant } from '../services/localStore';

export type SimulationAction =
  | { type: 'tick'; seconds: number }
  | { type: 'advance-time'; hours: number }
  | { type: 'hydrate'; plant: PlantState }
  | { type: 'set-level'; tank: 'lower' | 'upper'; level: number }
  | { type: 'set-settings'; settings: Partial<SimulationSettings> }
  | { type: 'set-mode'; mode: OperationMode }
  | { type: 'set-manual-pump'; pump: PumpId | null }
  | { type: 'toggle-pause' }
  | { type: 'set-pump'; pump: PumpId; field: 'available' | 'startFailure' | 'noFlow'; value: boolean }
  | { type: 'restore-pump'; pump: PumpId }
  | { type: 'run-test'; pump: PumpId }
  | { type: 'acknowledge-alarm'; id: string }
  | { type: 'run-scenario'; scenario: DemonstrationScenario }
  | { type: 'reset' };

function normalizeSettings(current: SimulationSettings, update: Partial<SimulationSettings>): SimulationSettings {
  const candidate = { ...current, ...update };
  const startUpperLevel = Math.min(candidate.startUpperLevel, candidate.stopUpperLevel - 1);
  const stopUpperLevel = Math.max(candidate.stopUpperLevel, startUpperLevel + 1);
  const lowerBlockLevel = Math.min(candidate.lowerBlockLevel, candidate.lowerRecoveryLevel - 1);
  const lowerRecoveryLevel = Math.max(candidate.lowerRecoveryLevel, lowerBlockLevel + 1);
  return {
    ...candidate,
    startUpperLevel,
    stopUpperLevel,
    lowerBlockLevel,
    lowerRecoveryLevel,
    upperAlarmLevel: Math.max(candidate.upperAlarmLevel, stopUpperLevel + 1),
  };
}

function hydratePlant(plant: PlantState): PlantState {
  const initial = createInitialPlant();
  return {
    ...initial,
    ...plant,
    settings: normalizeSettings(initial.settings, plant.settings ?? {}),
    pumps: {
      1: { ...initial.pumps[1], ...plant.pumps?.[1] },
      2: { ...initial.pumps[2], ...plant.pumps?.[2] },
    },
    history: (plant.history ?? []).map((point) => ({
      ...point,
      pump1RunHours: point.pump1RunHours ?? 0,
      pump1Starts: point.pump1Starts ?? 0,
      pump2RunHours: point.pump2RunHours ?? 0,
      pump2Starts: point.pump2Starts ?? 0,
      alarmIds: point.alarmIds ?? [],
    })),
    alarmHistory: plant.alarmHistory ?? [],
    activeTest: plant.activeTest ? {
      ...plant.activeTest,
      startedUpperLevel: plant.activeTest.startedUpperLevel ?? plant.upperLevel,
      startedLowerLevel: plant.activeTest.startedLowerLevel ?? plant.lowerLevel,
      previousSpeed: plant.activeTest.previousSpeed ?? initial.settings.speed,
    } : null,
    testResults: (plant.testResults ?? []).map((result) => ({ ...result, restoredAtVirtualHour: result.restoredAtVirtualHour ?? null })),
    nextScheduledTestAt: plant.nextScheduledTestAt ?? initial.nextScheduledTestAt,
    scheduledTestPump: plant.scheduledTestPump ?? initial.scheduledTestPump,
  };
}

export function simulationReducer(state: PlantState, action: SimulationAction): PlantState {
  switch (action.type) {
    case 'tick': return stepPlant(state, action.seconds);
    case 'advance-time': return advancePlantByHours(state, action.hours);
    case 'hydrate': return hydratePlant(action.plant);
    case 'set-level': return { ...state, [action.tank === 'lower' ? 'lowerLevel' : 'upperLevel']: action.level };
    case 'set-settings': {
      const settings = normalizeSettings(state.settings, action.settings);
      return {
        ...state,
        settings,
        nextScheduledTestAt: action.settings.testIntervalHours === undefined
          ? state.nextScheduledTestAt
          : state.virtualHours + settings.testIntervalHours,
      };
    }
    case 'set-mode': return { ...state, mode: action.mode, manualPump: action.mode === 'auto' ? null : state.manualPump };
    case 'set-manual-pump': return { ...state, manualPump: action.pump };
    case 'toggle-pause': return { ...state, paused: !state.paused };
    case 'set-pump': return { ...state, pumps: { ...state.pumps, [action.pump]: { ...state.pumps[action.pump], [action.field]: action.value } } };
    case 'restore-pump': return {
      ...state,
      pumps: {
        ...state.pumps,
        [action.pump]: {
          ...state.pumps[action.pump],
          available: true,
          startFailure: false,
          noFlow: false,
          noFlowHours: 0,
        },
      },
      testResults: state.testResults.map((result) => result.pump === action.pump && result.status !== 'approved' && result.restoredAtVirtualHour === null
        ? { ...result, restoredAtVirtualHour: state.virtualHours }
        : result),
    };
    case 'run-test': return canStartPumpTest(state, action.pump)
      ? {
        ...state,
        paused: false,
        settings: { ...state.settings, speed: 60 },
        activeTest: {
          pump: action.pump,
          startedAt: state.virtualHours,
          startedUpperLevel: state.upperLevel,
          startedLowerLevel: state.lowerLevel,
          previousSpeed: state.settings.speed,
          scheduled: false,
        },
      }
      : state;
    case 'acknowledge-alarm': return {
      ...state,
      alarmHistory: state.alarmHistory.map((alarm) => alarm.id === action.id && alarm.acknowledgedAtVirtualHour === null
        ? { ...alarm, acknowledgedAtVirtualHour: state.virtualHours, acknowledgedAt: new Date().toISOString() }
        : alarm),
    };
    case 'run-scenario': {
      const next = action.scenario === 'weekly-alternation'
        ? advancePlantByHours(state, 168)
        : createDemonstrationScenario(action.scenario, state.virtualHours);
      return { ...next, lastScenario: action.scenario, scenarioPhase: action.scenario };
    }
    case 'reset': return createInitialPlant();
  }
}

export function useSimulation() {
  const [state, dispatch] = useReducer(simulationReducer, undefined, createInitialPlant);
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
