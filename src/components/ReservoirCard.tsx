type LevelStatus = 'low' | 'normal' | 'high';

interface ReservoirCardProps {
  title: string;
  level: number;
  capacity: number;
  accent: 'cyan' | 'blue';
  flowLabel: string;
  active: boolean;
  levelStatus: LevelStatus;
}

const statusLabel: Record<LevelStatus, string> = { low: 'BAIXO', normal: 'NORMAL', high: 'ALTO' };

export function ReservoirCard({ title, level, capacity, accent, flowLabel, active, levelStatus }: ReservoirCardProps) {
  const liters = Math.round((level / 100) * capacity).toLocaleString('pt-BR');
  return (
    <section className={`panel reservoir-card level-${levelStatus}`}>
      <div className="reservoir-heading">
        <div><p className="eyebrow">{flowLabel}</p><h2>{title}</h2></div>
        <span className={`level-status ${levelStatus}`}>{statusLabel[levelStatus]}</span>
      </div>
      <div className="tank-shell" aria-label={`${title}: ${level.toFixed(1)} por cento, nível ${statusLabel[levelStatus].toLowerCase()}`}>
        <div className={`water-fill ${accent}`} style={{ height: `${level}%` }} />
        <div className="tank-reading"><strong>{level.toFixed(1)}%</strong><span>{liters} L</span></div>
      </div>
      <div className="reservoir-footer"><span>Capacidade {capacity.toLocaleString('pt-BR')} L</span><span className={`status-dot ${accent} ${active ? 'active' : ''}`} aria-label={active ? 'Processo ativo' : 'Processo pausado'} /></div>
    </section>
  );
}
