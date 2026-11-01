import { useState } from 'react';
import type { PlantState } from '../domain/types';
import type { RemoteCommandAction, RemoteCommandPayload } from '../services/supabaseRest';
import type { RemoteCommandRecord } from '../services/supabaseRest';

type Props = {
  plant: PlantState;
  onCommand: (action: RemoteCommandAction, payload: RemoteCommandPayload) => Promise<void>;
  latestCommand: RemoteCommandRecord | null;
};

export function RemoteControls({ plant, onCommand, latestCommand }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async (action: RemoteCommandAction, payload: RemoteCommandPayload, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await onCommand(action, payload);
      setMessage(`${success} Aguardando confirmação do ESP32.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Falha ao enviar comando.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel controls-panel">
      <div className="mb-5"><p className="eyebrow">Comandos remotos</p><h2>Operação supervisionada</h2></div>
      <div className="mode-switch"><button disabled={busy} className={plant.mode === 'auto' ? 'selected' : ''} onClick={() => void send('set_mode', { mode: 'auto' }, 'Modo automático solicitado.')}>Automático</button><button disabled={busy} className={plant.mode === 'manual' ? 'selected' : ''} onClick={() => void send('set_mode', { mode: 'manual' }, 'Modo manual solicitado.')}>Manual</button></div>
      <div className="mt-5 border-t border-slate-800 pt-4"><p className="section-label">Comando manual</p><div className="grid grid-cols-3 gap-2"><button disabled={busy || plant.mode !== 'manual'} className={plant.manualPump === 1 ? 'button active' : 'button'} onClick={() => void send('set_manual_pump', { pump: 1 }, 'Partida manual B1 solicitada.')}>Ligar B1</button><button disabled={busy || plant.mode !== 'manual'} className={plant.manualPump === 2 ? 'button active' : 'button'} onClick={() => void send('set_manual_pump', { pump: 2 }, 'Partida manual B2 solicitada.')}>Ligar B2</button><button disabled={busy || plant.mode !== 'manual'} className="button" onClick={() => void send('set_manual_pump', { pump: 0 }, 'Parada solicitada.')}>Parar</button></div><p className="hint">O ESP32 rejeita ou bloqueia comandos que violem os intertravamentos.</p></div>
      <div className="mt-5 border-t border-slate-800 pt-4"><p className="section-label">Teste individual</p><div className="grid grid-cols-2 gap-2"><button disabled={busy || plant.mode !== 'auto'} className="button" onClick={() => void send('run_test', { pump: 1 }, 'Teste da B1 solicitado.')}>Testar B1</button><button disabled={busy || plant.mode !== 'auto'} className="button" onClick={() => void send('run_test', { pump: 2 }, 'Teste da B2 solicitado.')}>Testar B2</button></div></div>
      {message ? <p className="command-message">{message}</p> : null}
      {latestCommand ? <p className={`command-message ${latestCommand.status === 'rejected' ? 'is-rejected' : ''}`}>Último comando: {latestCommand.status === 'queued' ? 'na fila' : latestCommand.status === 'executed' ? 'executado' : 'rejeitado'}{latestCommand.execution_result ? ` — ${latestCommand.execution_result}` : ''}</p> : null}
    </section>
  );
}
