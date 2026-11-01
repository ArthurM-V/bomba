import { useCallback, useEffect, useMemo, useState } from 'react';
import { createInitialPlant } from '../domain/simulator';
import type { Alarm, PlantState, PumpId } from '../domain/types';
import {
  fetchTelemetry,
  fetchRemoteCommands,
  enqueueRemoteCommand,
  getPanelConfig,
  loadPanelSession,
  refreshSession,
  savePanelSession,
  signIn,
  type PanelSession,
  type RemoteCommandAction,
  type RemoteCommandPayload,
  type RemoteCommandRecord,
  type TelemetryRecord,
} from '../services/supabaseRest';

type RemoteStatus = 'not-configured' | 'signed-out' | 'loading' | 'connected' | 'error';

const alarmCatalog: Record<string, Omit<Alarm, 'id'>> = {
  LOWER_BLOCK: { title: 'Reservatório inferior baixo', detail: 'Bombeamento bloqueado pelo ESP32.', severity: 'critical' },
  UPPER_HIGH_HIGH: { title: 'Nível superior crítico', detail: 'Proteção de transbordamento ativa.', severity: 'critical' },
  START_FAIL_B1: { title: 'Falha de partida Bomba 1', detail: 'A bomba foi retirada da seleção.', severity: 'critical' },
  START_FAIL_B2: { title: 'Falha de partida Bomba 2', detail: 'A bomba foi retirada da seleção.', severity: 'critical' },
  NO_FLOW_B1: { title: 'Sem vazão na Bomba 1', detail: 'Não houve elevação de nível detectada.', severity: 'critical' },
  NO_FLOW_B2: { title: 'Sem vazão na Bomba 2', detail: 'Não houve elevação de nível detectada.', severity: 'critical' },
  LONG_RUN_B1: { title: 'Tempo excessivo Bomba 1', detail: 'Proteção por tempo máximo de operação.', severity: 'warning' },
  LONG_RUN_B2: { title: 'Tempo excessivo Bomba 2', detail: 'Proteção por tempo máximo de operação.', severity: 'warning' },
};

function toPlant(records: TelemetryRecord[]): PlantState | null {
  const latest = records[0];
  if (!latest) return null;
  const base = createInitialPlant();
  const activeAlarms = latest.alarms.split('|').filter((value) => value && value !== 'NONE');
  const faulted = (pump: PumpId, kind: 'START_FAIL' | 'NO_FLOW') => activeAlarms.includes(`${kind}_B${pump}`);
  const byId = new Map(latest.pumps.map((pump) => [pump.id, pump]));
  const toPump = (id: PumpId) => {
    const remote = byId.get(id);
    const startFailure = faulted(id, 'START_FAIL');
    const noFlow = faulted(id, 'NO_FLOW');
    return {
      ...base.pumps[id],
      running: remote?.running ?? false,
      available: !startFailure && !noFlow,
      startFailure,
      noFlow,
      runHours: remote?.runHours ?? 0,
      starts: remote?.starts ?? 0,
    };
  };

  return {
    ...base,
    lowerLevel: latest.lower_level,
    upperLevel: latest.upper_level,
    mode: latest.operation_mode,
    manualPump: latest.manual_pump,
    virtualHours: latest.virtual_hours,
    paused: false,
    pumps: { 1: toPump(1), 2: toPump(2) },
    history: records.slice().reverse().map((record) => {
      const pump1 = record.pumps.find((pump) => pump.id === 1);
      const pump2 = record.pumps.find((pump) => pump.id === 2);
      return {
        virtualHour: record.virtual_hours,
        lowerLevel: record.lower_level,
        upperLevel: record.upper_level,
        activePump: record.commanded_pump,
        pump1RunHours: pump1?.runHours ?? 0,
        pump1Starts: pump1?.starts ?? 0,
        pump2RunHours: pump2?.runHours ?? 0,
        pump2Starts: pump2?.starts ?? 0,
      };
    }),
  };
}

function toAlarms(record: TelemetryRecord | undefined): Alarm[] | null {
  if (!record) return null;
  return record.alarms.split('|').filter((code) => code && code !== 'NONE').map((code) => ({
    id: code,
    ...(alarmCatalog[code] ?? { title: code, detail: 'Alarme informado pelo ESP32.', severity: 'warning' as const }),
  }));
}

export function useRemoteTelemetry() {
  const config = useMemo(getPanelConfig, []);
  const [session, setSession] = useState<PanelSession | null>(() => config ? loadPanelSession() : null);
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [commands, setCommands] = useState<RemoteCommandRecord[]>([]);
  const [status, setStatus] = useState<RemoteStatus>(() => config ? 'signed-out' : 'not-configured');
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    savePanelSession(null);
    setSession(null);
    setRecords([]);
    setStatus(config ? 'signed-out' : 'not-configured');
  }, [config]);

  const login = useCallback(async (email: string, password: string) => {
    if (!config) return;
    setStatus('loading');
    setError(null);
    try {
      const nextSession = await signIn(config, email, password);
      savePanelSession(nextSession);
      setSession(nextSession);
    } catch (reason) {
      setStatus('signed-out');
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar a sessão.');
    }
  }, [config]);

  const sendCommand = useCallback(async (action: RemoteCommandAction, payload: RemoteCommandPayload) => {
    if (!config || !session) throw new Error('Entre no painel antes de enviar comandos.');
    await enqueueRemoteCommand(config, session, action, payload);
  }, [config, session]);

  useEffect(() => {
    if (!config || !session) return;
    let cancelled = false;
    let currentSession = session;

    const poll = async () => {
      try {
        if (currentSession.expiresAt - Math.floor(Date.now() / 1000) < 60) {
          currentSession = await refreshSession(config, currentSession.refreshToken);
          savePanelSession(currentSession);
          if (!cancelled) setSession(currentSession);
        }
        const nextRecords = await fetchTelemetry(config, currentSession);
        const nextCommands = await fetchRemoteCommands(config, currentSession);
        if (!cancelled) {
          setRecords(nextRecords);
          setCommands(nextCommands);
          setStatus('connected');
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) {
          setStatus('error');
          setError(reason instanceof Error ? reason.message : 'Falha ao consultar a telemetria.');
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [config, session]);

  return {
    configured: Boolean(config),
    status,
    error,
    session,
    deviceId: config?.deviceId ?? 'esp32-agua-01',
    plant: toPlant(records),
    alarms: toAlarms(records[0]),
    lastReceivedAt: records[0]?.received_at ?? null,
    latestCommand: commands[0] ?? null,
    login,
    logout,
    sendCommand,
  };
}
