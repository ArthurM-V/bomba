export type PumpId = 1 | 2;
export type OperationMode = 'auto' | 'manual';
export type AlarmSeverity = 'critical' | 'warning' | 'info';

export interface PumpState {
  id: PumpId;
  running: boolean;
  available: boolean;
  startFailure: boolean;
  noFlow: boolean;
  runHours: number;
  continuousRunHours: number;
  starts: number;
  noFlowHours: number;
}

export interface SimulationSettings {
  lowerCapacity: number;
  upperCapacity: number;
  incomingFlow: number;
  consumptionFlow: number;
  pumpFlow: number;
  speed: number;
  startUpperLevel: number;
  stopUpperLevel: number;
  lowerBlockLevel: number;
  lowerRecoveryLevel: number;
  upperAlarmLevel: number;
  testDurationHours: number;
  testIntervalHours: number;
  maxContinuousRunHours: number;
}

export interface HistoryPoint {
  virtualHour: number;
  lowerLevel: number;
  upperLevel: number;
  activePump: PumpId | null;
  pump1RunHours: number;
  pump1Starts: number;
  pump2RunHours: number;
  pump2Starts: number;
  alarmIds: string[];
}

export interface PlantState {
  lowerLevel: number;
  upperLevel: number;
  mode: OperationMode;
  manualPump: PumpId | null;
  automaticFillRequest: boolean;
  /** Histerese do RI: trava em nível crítico e libera somente na recuperação. */
  lowerLockout?: boolean;
  virtualHours: number;
  paused: boolean;
  pumps: Record<PumpId, PumpState>;
  settings: SimulationSettings;
  history: HistoryPoint[];
  lastHistoryHour: number;
  activeTest: ActiveTest | null;
  testResults: TestResult[];
  nextScheduledTestAt: number;
  scheduledTestPump: PumpId;
  alarmHistory: AlarmRecord[];
}

export interface ActiveTest {
  pump: PumpId;
  startedAt: number;
  startedUpperLevel: number;
  startedLowerLevel: number;
  previousSpeed: number;
  scheduled: boolean;
}

export interface TestResult {
  id: string;
  pump: PumpId;
  startedAt: number;
  endedAt: number;
  durationHours: number;
  upperLevelGain: number;
  lowerLevelDrop: number;
  status: 'approved' | 'failed' | 'interrupted';
  reason: string;
  restoredAtVirtualHour: number | null;
}

export interface Alarm {
  id: string;
  title: string;
  detail: string;
  severity: AlarmSeverity;
}

export interface AlarmRecord extends Alarm {
  occurredAtVirtualHour: number;
  acknowledgedAtVirtualHour: number | null;
  clearedAtVirtualHour: number | null;
  occurredAt: string;
  acknowledgedAt: string | null;
  clearedAt: string | null;
}
