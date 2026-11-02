import { useState } from 'react';

type Props = {
  configured: boolean;
  status: 'not-configured' | 'signed-out' | 'loading' | 'connected' | 'error';
  error: string | null;
  email: string | null;
  deviceId: string;
  lastReceivedAt: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => void;
};

export function CloudConnection({ configured, status, error, email, deviceId, lastReceivedAt, onLogin, onLogout }: Props) {
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    await onLogin(loginEmail, password);
    setSubmitting(false);
  };

  return (
    <section className="panel">
      <div className="mb-3"><p className="eyebrow">Telemetria HTTPS</p><h2>Conexão com ESP32</h2></div>
      <div className="remote-continuity"><b>Continuidade local</b><span>Se a rede ou o Supabase falhar, o painel retorna ao simulador local; a simulação e os cenários continuam disponíveis offline.</span></div>
      {!configured ? <p className="hint">Modo local ativo. Configure <code>.env</code> com a URL e a chave pública do Supabase para conectar este painel.</p> : null}
      {configured && !email ? <form className="space-y-3" onSubmit={submit}>
        <label className="field-label">E-mail<input required type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} /></label>
        <label className="field-label">Senha<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="pause-button" disabled={submitting || status === 'loading'}>{submitting ? 'Entrando…' : 'Entrar no supervisório'}</button>
      </form> : null}
      {configured && email ? <div className="space-y-2 text-xs text-slate-300"><p><b>Operador:</b> {email}</p><p><b>Dispositivo:</b> {deviceId}</p><p><b>Status:</b> {status === 'connected' ? 'Telemetria recebida' : status === 'error' ? 'Falha de conexão — simulador local ativo' : 'Conectando…'}</p>{lastReceivedAt ? <p><b>Última leitura:</b> {new Date(lastReceivedAt).toLocaleString('pt-BR')}</p> : null}{error ? <p className="form-error">{error}</p> : null}<button className="button mt-2" onClick={onLogout}>Sair</button></div> : null}
    </section>
  );
}
