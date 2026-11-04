import { describe, expect, it } from 'vitest';
import { advancePlantByHours, createDemonstrationScenario, createInitialPlant, getAlarms, stepPlant } from './simulator';
import { getProcessCondition } from './processCondition';

describe('condição do processo', () => {
  it('mostra espera no estado inicial, sem depender de reconhecimento', () => {
    const plant = createInitialPlant();
    expect(getProcessCondition(plant, getAlarms(plant), [], false)).toMatchObject({ level: 'normal', label: 'Em espera', alarmSummary: 'Sem alarmes' });
  });

  it('mantém redundância reduzida após reconhecer uma falha de vazão encerrada', () => {
    const plant = createDemonstrationScenario('lead-no-flow');
    const alarms = getAlarms(plant);
    const before = getProcessCondition(plant, alarms, plant.alarmHistory, false);
    const acknowledged = plant.alarmHistory.map((alarm) => ({ ...alarm, acknowledgedAtVirtualHour: plant.virtualHours }));
    const after = getProcessCondition(plant, alarms, acknowledged, false);

    expect(before).toMatchObject({ level: 'warning', label: 'Redundância reduzida' });
    expect(after).toMatchObject({ level: 'warning', label: 'Redundância reduzida' });
  });

  it('prioriza o alarme crítico mais grave sobre um aviso', () => {
    const plant = createInitialPlant();
    plant.paused = false;
    plant.upperLevel = 20;
    plant.pumps[1].available = false;
    plant.pumps[2].noFlow = true;
    const alarmed = stepPlant(plant, 0.17);

    expect(getProcessCondition(alarmed, getAlarms(alarmed), alarmed.alarmHistory, false)).toMatchObject({ level: 'critical', label: 'Sem vazão na Bomba 2' });
  });

  it('identifica teste em andamento, bloqueio e resumo remoto sem reconhecimento', () => {
    const testing = createDemonstrationScenario('test-1');
    const lowWater = advancePlantByHours(createDemonstrationScenario('low-water'), 0.25);
    const remote = createInitialPlant();
    remote.lowerLevel = 10;

    expect(getProcessCondition(testing, getAlarms(testing), [], false)).toMatchObject({ level: 'normal', label: 'Teste individual da Bomba 1' });
    expect(getProcessCondition(lowWater, getAlarms(lowWater), lowWater.alarmHistory, false)).toMatchObject({ level: 'critical', label: 'Recalque bloqueado' });
    expect(getProcessCondition(remote, getAlarms(remote), [], true).alarmSummary).not.toContain('a reconhecer');
  });
});
