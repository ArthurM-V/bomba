import { formatSimulationTime } from '../domain/simulator';
import type { HistoryPoint } from '../domain/types';

type Props = { history: HistoryPoint[] };

const WIDTH = 720;
const HEIGHT = 230;
const PAD = { top: 20, right: 24, bottom: 34, left: 38 };

function linePath(points: HistoryPoint[], field: 'lowerLevel' | 'upperLevel') {
  const graphWidth = WIDTH - PAD.left - PAD.right;
  const graphHeight = HEIGHT - PAD.top - PAD.bottom;
  return points.map((point, index) => {
    const x = PAD.left + (points.length === 1 ? graphWidth / 2 : (index / (points.length - 1)) * graphWidth);
    const y = PAD.top + ((100 - point[field]) / 100) * graphHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export function HistoryChart({ history }: Props) {
  const points = history.slice(-48);
  if (points.length === 0) return <div className="empty-state">Ainda não há dados suficientes para o gráfico.</div>;

  const graphWidth = WIDTH - PAD.left - PAD.right;
  const graphHeight = HEIGHT - PAD.top - PAD.bottom;
  const labels = [0, 25, 50, 75, 100];
  const last = points.length - 1;
  const middle = Math.floor(last / 2);
  const xLabel = (index: number) => PAD.left + (points.length === 1 ? graphWidth / 2 : (index / last) * graphWidth);

  return (
    <div className="chart-wrap" role="img" aria-label="Tendência dos níveis dos reservatórios">
      <div className="chart-legend"><span><i className="lower" />Reservatório inferior</span><span><i className="upper" />Reservatório superior</span></div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="history-chart">
        {labels.map((value) => {
          const y = PAD.top + ((100 - value) / 100) * graphHeight;
          return <g key={value}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="chart-grid" /><text x={PAD.left - 8} y={y + 4} textAnchor="end" className="chart-label">{value}%</text></g>;
        })}
        <path d={linePath(points, 'lowerLevel')} className="chart-line lower" />
        <path d={linePath(points, 'upperLevel')} className="chart-line upper" />
        {[0, middle, last].filter((value, index, list) => list.indexOf(value) === index).map((index) => <text key={index} x={xLabel(index)} y={HEIGHT - 9} textAnchor="middle" className="chart-label">{formatSimulationTime(points[index].virtualHour)}</text>)}
      </svg>
    </div>
  );
}
