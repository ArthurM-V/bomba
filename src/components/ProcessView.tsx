import { getActivePump, getWeeklyLeadPump } from '../domain/simulator';
import type { PlantState, PumpId } from '../domain/types';
import { ReservoirCard } from './ReservoirCard';

type Signal = { label: string; value: string; active: boolean; critical?: boolean };

function Pump({ id, plant, signals }: { id: PumpId; plant: PlantState; signals: Signal[] }) {
  const pump = plant.pumps[id];
  const active = pump.running;
  const isLead = getWeeklyLeadPump(plant.virtualHours) === id;
  const testing = plant.activeTest?.pump === id;
  return (
    <div className={['pump-unit', active ? 'running' : '', testing ? 'testing' : '', isLead ? 'lead' : 'reserve'].filter(Boolean).join(' ')}>
      <div className="pump-icon"><span>◉</span></div>
      <div className="pump-details">
        <strong>Bomba {id}</strong>
        <p className={isLead ? 'pump-role lead' : 'pump-role'}>{isLead ? 'PRINCIPAL DA SEMANA' : 'RESERVA DA SEMANA'}</p>
        <small>{testing ? 'EM TESTE INDIVIDUAL' : active ? (pump.noFlow ? 'Ligada sem vazão' : 'Recalque ativo') : !pump.available ? 'Indisponível' : pump.startFailure ? 'Falha de partida' : 'Desligada'}</small>
        <small>Relé B{id}: {active ? 'energizado' : 'desenergizado'} · Contator K{id}: {active ? 'fechado' : 'aberto'}</small>
        <div className="sensor-signals" aria-label={'Sensores associados à Bomba ' + id}>
          {signals.map((signal) => <span key={signal.label} className={['sensor-signal', signal.active ? 'active' : '', signal.critical ? 'critical' : ''].filter(Boolean).join(' ')}><b>{signal.label}</b>{signal.value}</span>)}
        </div>
      </div>
      <div className="pump-hours"><b>{pump.runHours.toFixed(1)} h</b><small>{pump.continuousRunHours.toFixed(1)} h contínuas</small><span>{pump.starts} partidas</span></div>
    </div>
  );
}

export function ProcessView({ plant }: { plant: PlantState }) {
  const active = getActivePump(plant);
  const testing = plant.activeTest;
  const flowActive = active !== null && !plant.paused;
  const lead = getWeeklyLeadPump(plant.virtualHours);
  const upperLow = plant.upperLevel <= plant.settings.startUpperLevel;
  const upperHigh = plant.upperLevel >= plant.settings.stopUpperLevel;
  const lowerLow = plant.lowerLevel <= plant.settings.lowerRecoveryLevel;
  const lowerBlocked = plant.lowerLevel <= plant.settings.lowerBlockLevel;
  const signals: Signal[] = [
    { label: 'NS superior', value: upperLow ? 'pedido de partida' : upperHigh ? 'parada por nível' : 'normal', active: upperLow || upperHigh },
    { label: 'NI inferior', value: lowerBlocked ? 'bloqueio ativo' : lowerLow ? 'abaixo da recuperação' : 'seguro', active: lowerLow, critical: lowerBlocked },
  ];

  return (
    <section className="process-grid">
      <ReservoirCard title="Reservatório inferior" level={plant.lowerLevel} capacity={plant.settings.lowerCapacity} accent="blue" flowLabel="Captação e reserva" active={!plant.paused} levelStatus={lowerLow ? 'low' : 'normal'} />
      <div className="process-center panel">
        <div className="station-heading">
          <div><p className="eyebrow">Fluxo hidráulico</p><h2>Estação elevatória</h2></div>
          <span className={testing ? 'badge testing' : active ? 'badge online' : 'badge'}>{testing ? 'Bomba ' + testing.pump + ' em teste' : active ? 'Bomba ' + active + ' recalca' : 'Em espera'}</span>
        </div>
        <div className="station-strip" aria-label="Resumo da estação">
          <span className={plant.mode === 'auto' ? 'mode-tag auto' : 'mode-tag manual'}>{plant.mode === 'auto' ? 'AUTOMÁTICO' : 'MANUAL'}</span>
          <span>B{lead} principal</span><span>B{lead === 1 ? 2 : 1} reserva</span>
        </div>
        <div className={['flow-schematic', flowActive ? 'flowing' : ''].filter(Boolean).join(' ')} aria-label={flowActive ? 'Fluxo do reservatório inferior pela Bomba ' + active + ' ao reservatório superior' : 'Tubulação sem fluxo animado'}>
          <span className="flow-terminal">RI</span>
          <span className="flow-line inlet"><i>›››</i></span>
          <span className="flow-pump-branch"><b className={active === 1 ? 'active' : ''}>B1</b><b className={active === 2 ? 'active' : ''}>B2</b></span>
          <span className="flow-line outlet"><i>›››</i></span>
          <span className="flow-terminal upper">RS</span>
        </div>
        <div className="pumps-stack"><Pump id={1} plant={plant} signals={signals} /><Pump id={2} plant={plant} signals={signals} /></div>
        <div className="process-metrics"><div className="metric"><b>{plant.settings.pumpFlow.toLocaleString('pt-BR')} L/h</b><span>Vazão nominal</span></div><div className="metric"><b>{plant.settings.consumptionFlow.toLocaleString('pt-BR')} L/h</b><span>Consumo</span></div><div className="metric"><b>{plant.settings.incomingFlow.toLocaleString('pt-BR')} L/h</b><span>Entrada</span></div></div>
      </div>
      <ReservoirCard title="Reservatório superior" level={plant.upperLevel} capacity={plant.settings.upperCapacity} accent="cyan" flowLabel="Distribuição predial" active={!plant.paused} levelStatus={upperHigh ? 'high' : upperLow ? 'low' : 'normal'} />
    </section>
  );
}
