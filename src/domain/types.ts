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
}

export interface PlantState {
  lowerLevel: number;
  upperLevel: number;
  mode: OperationMode;
  manualPump: PumpId | null;
  automaticFillRequest: boolean;
  virtualHours: number;
  paused: boolean;
  pumps: Record<PumpId, PumpState>;
  settings: SimulationSettings;
  history: HistoryPoint[];
  lastHistoryHour: number;
  activeTest: { pump: PumpId; startedAt: number; scheduled: boolean } | null;
  nextScheduledTestAt: number;
  scheduledTestPump: PumpId;
  alarmHistory: AlarmRecord[];
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
