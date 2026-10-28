interface ReservoirCardProps {
  title: string;
  level: number;
  capacity: number;
  accent: 'cyan' | 'blue';
  flowLabel: string;
  active: boolean;
}

export function ReservoirCard({ title, level, capacity, accent, flowLabel, active }: ReservoirCardProps) {
  const liters = Math.round((level / 100) * capacity).toLocaleString('pt-BR');
  return (
    <section className="panel reservoir-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><p className="eyebrow">{flowLabel}</p><h2>{title}</h2></div>
        <span className={`status-dot ${accent} ${active ? 'active' : ''}`} aria-label={active ? 'Processo ativo' : 'Processo pausado'} />
      </div>
      <div className="tank-shell" aria-label={`${title}: ${level.toFixed(1)} por cento`}>
        <div className={`water-fill ${accent}`} style={{ height: `${level}%` }} />
        <div className="tank-reading"><strong>{level.toFixed(1)}%</strong><span>{liters} L</span></div>
      </div>
      <div className="mt-4 flex justify-between text-xs text-slate-400"><span>0%</span><span>Capacidade {capacity.toLocaleString('pt-BR')} L</span><span>100%</span></div>
    </section>
  );
}
