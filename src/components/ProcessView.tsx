import { getActivePump, getWeeklyLeadPump } from '../domain/simulator';
import type { PlantState, PumpId } from '../domain/types';
import { ReservoirCard } from './ReservoirCard';

function Pump({ id, plant }: { id: PumpId; plant: PlantState }) {
  const pump = plant.pumps[id];
  const active = pump.running;
  const isLead = getWeeklyLeadPump(plant.virtualHours) === id;
  return (
    <div className={`pump-unit ${active ? 'running' : ''}`}>
      <div className="pump-icon"><span>◉</span></div>
      <div><strong>Bomba {id}</strong><p>{isLead ? 'Principal da semana' : 'Reserva da semana'}</p><small>{active ? (pump.noFlow ? 'Ligada sem vazão' : 'Recalque ativo') : !pump.available ? 'Indisponível' : pump.startFailure ? 'Falha de partida' : 'Desligada'}</small><small>Relé B{id}: {active ? 'energizado' : 'desenergizado'} · Contator K{id}: {active ? 'fechado' : 'aberto'}</small></div>
      <div className="ml-auto text-right text-xs text-slate-400"><b className="block text-slate-100">{pump.runHours.toFixed(1)} h</b>{pump.starts} partidas</div>
    </div>
  );
}

export function ProcessView({ plant }: { plant: PlantState }) {
  const active = getActivePump(plant);
  return (
    <section className="process-grid">
      <ReservoirCard title="Reservatório inferior" level={plant.lowerLevel} capacity={plant.settings.lowerCapacity} accent="blue" flowLabel="Captação e reserva" active={!plant.paused} />
      <div className="process-center panel">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Fluxo hidráulico</p><h2>Estação elevatória</h2></div><span className={active ? 'badge online' : 'badge'}>{active ? `Bomba ${active} recalca` : 'Em espera'}</span></div>
        <div className={`pipe pipe-up ${active ? 'flowing' : ''}`}><span>↑</span></div>
        <div className="pumps-stack"><Pump id={1} plant={plant} /><Pump id={2} plant={plant} /></div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs"><div className="metric"><b>{plant.settings.pumpFlow.toLocaleString('pt-BR')} L/h</b><span>Vazão nominal</span></div><div className="metric"><b>{plant.settings.consumptionFlow.toLocaleString('pt-BR')} L/h</b><span>Consumo</span></div><div className="metric"><b>{plant.settings.incomingFlow.toLocaleString('pt-BR')} L/h</b><span>Entrada</span></div></div>
      </div>
      <ReservoirCard title="Reservatório superior" level={plant.upperLevel} capacity={plant.settings.upperCapacity} accent="cyan" flowLabel="Distribuição predial" active={!plant.paused} />
    </section>
  );
}
