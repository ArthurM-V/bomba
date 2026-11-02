import { formatSimulationTime } from '../domain/simulator';
import type { TestResult } from '../domain/types';

export function TestResultCard({ result }: { result: TestResult | undefined }) {
  if (!result) return null;
  const label = result.status === 'approved' ? 'APROVADO' : result.status === 'failed' ? 'REPROVADO' : 'INTERROMPIDO';
  return (
    <section className={['panel', 'test-result-card', result.status].join(' ')}>
      <div><p className="eyebrow">Último teste individual</p><h2>Bomba {result.pump} · {label}</h2><p>{result.reason}</p></div>
      <div className="test-result-metrics"><span>{formatSimulationTime(result.endedAt)}</span><b>RS +{result.upperLevelGain.toFixed(2)}%</b><span>RI −{result.lowerLevelDrop.toFixed(2)}% · {result.durationHours.toFixed(2)} h</span></div>
    </section>
  );
}
