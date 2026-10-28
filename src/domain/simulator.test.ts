import { describe, expect, it } from 'vitest';
import { createInitialPlant, getActivePump, getWeeklyLeadPump, stepPlant } from './simulator';

describe('simulador hidráulico', () => {
  it('aciona a bomba principal quando o nível superior atinge o limite de partida', () => {
    const plant = createInitialPlant();
    plant.upperLevel = 25;
    const next = stepPlant(plant, 1);
    expect(getActivePump(next)).toBe(1);
  });

  it('bloqueia o recalque se o nível inferior estiver em condição crítica', () => {
    const plant = createInitialPlant();
    plant.upperLevel = 20;
    plant.lowerLevel = 10;
    expect(getActivePump(stepPlant(plant, 1))).toBeNull();
  });

  it('aciona a reserva quando a principal apresenta falha de partida', () => {
    const plant = createInitialPlant();
    plant.upperLevel = 20;
    plant.pumps[1].startFailure = true;
    expect(getActivePump(stepPlant(plant, 1))).toBe(2);
  });

  it('alterna a bomba principal após sete dias simulados', () => {
    expect(getWeeklyLeadPump(0)).toBe(1);
    expect(getWeeklyLeadPump(168)).toBe(2);
  });
});
