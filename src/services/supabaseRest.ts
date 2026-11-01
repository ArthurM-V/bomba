export type SupabasePanelConfig = {
  url: string;
  publishableKey: string;
  deviceId: string;
};

export type PanelSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string | null;
};

export type TelemetryPump = {
  id: 1 | 2;
  command: boolean;
  running: boolean;
  runHours: number;
  starts: number;
};

export type TelemetryRecord = {
  id: string;
  received_at: string;
  device_id: string;
  virtual_hours: number;
  lower_level: number;
  upper_level: number;
  operation_mode: 'auto' | 'manual';
  lead_pump: 1 | 2;
  commanded_pump: 1 | 2 | null;
  manual_pump: 1 | 2 | null;
  alarms: string;
  pumps: TelemetryPump[];
};

export type RemoteCommandAction = 'set_mode' | 'set_manual_pump' | 'run_test';
export type RemoteCommandPayload = { mode: 'auto' | 'manual' } | { pump: 0 | 1 | 2 };
export type RemoteCommandRecord = {
  id: string;
  action: RemoteCommandAction;
  status: 'queued' | 'executed' | 'rejected';
  requested_at: string;
  completed_at: string | null;
  execution_result: string | null;
};

const SESSION_KEY = 'scada-supabase-session';

export function getPanelConfig(): SupabasePanelConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const deviceId = import.meta.env.VITE_DEVICE_ID ?? 'esp32-agua-01';
  return url && publishableKey ? { url, publishableKey, deviceId } : null;
}

function requestHeaders(config: SupabasePanelConfig, accessToken?: string): HeadersInit {
  return {
    apikey: config.publishableKey,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

function toSession(payload: Record<string, unknown>): PanelSession {
  const user = payload.user as Record<string, unknown> | undefined;
  const accessToken = payload.access_token;
  const refreshToken = payload.refresh_token;
  const expiresAt = payload.expires_at;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' || typeof expiresAt !== 'number') {
    throw new Error('Resposta de autenticacao invalida.');
  }
  return { accessToken, refreshToken, expiresAt, email: typeof user?.email === 'string' ? user.email : null };
}

export function loadPanelSession(): PanelSession | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PanelSession;
    return parsed.expiresAt > Math.floor(Date.now() / 1000) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePanelSession(session: PanelSession | null) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}

export async function signIn(config: SupabasePanelConfig, email: string, password: string): Promise<PanelSession> {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { ...requestHeaders(config), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.msg === 'string' ? body.msg : 'Nao foi possivel iniciar a sessao.');
  return toSession(body);
}

export async function refreshSession(config: SupabasePanelConfig, refreshToken: string): Promise<PanelSession> {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { ...requestHeaders(config), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error('Sessao expirada. Entre novamente.');
  return toSession(body);
}

export async function fetchTelemetry(config: SupabasePanelConfig, session: PanelSession): Promise<TelemetryRecord[]> {
  const params = new URLSearchParams({
    select: 'id,received_at,device_id,virtual_hours,lower_level,upper_level,operation_mode,lead_pump,commanded_pump,manual_pump,alarms,pumps',
    device_id: `eq.${config.deviceId}`,
    order: 'received_at.desc',
    limit: '48',
  });
  const response = await fetch(`${config.url}/rest/v1/telemetry?${params}`, {
    headers: requestHeaders(config, session.accessToken),
  });
  if (response.status === 401 || response.status === 403) throw new Error('Sua sessao nao tem permissao para ler a telemetria.');
  if (!response.ok) throw new Error('Nao foi possivel consultar a telemetria.');
  return response.json() as Promise<TelemetryRecord[]>;
}

export async function enqueueRemoteCommand(
  config: SupabasePanelConfig,
  session: PanelSession,
  action: RemoteCommandAction,
  payload: RemoteCommandPayload,
): Promise<void> {
  const response = await fetch(`${config.url}/rest/v1/remote_commands`, {
    method: 'POST',
    headers: {
      ...requestHeaders(config, session.accessToken),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ device_id: config.deviceId, action, payload }),
  });
  if (response.status === 401 || response.status === 403) throw new Error('Sua sessao nao tem permissao para enviar comandos.');
  if (!response.ok) throw new Error('Nao foi possivel enfileirar o comando.');
}

export async function fetchRemoteCommands(config: SupabasePanelConfig, session: PanelSession): Promise<RemoteCommandRecord[]> {
  const params = new URLSearchParams({
    select: 'id,action,status,requested_at,completed_at,execution_result',
    order: 'requested_at.desc',
    limit: '4',
  });
  const response = await fetch(`${config.url}/rest/v1/remote_commands?${params}`, {
    headers: requestHeaders(config, session.accessToken),
  });
  if (!response.ok) throw new Error('Nao foi possivel consultar o estado dos comandos.');
  return response.json() as Promise<RemoteCommandRecord[]>;
}
