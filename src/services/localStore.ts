import type { PlantState } from '../domain/types';

const DB_NAME = 'scada-abastecimento';
const STORE = 'simulator';
const KEY = 'current-plant';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadPlant(): Promise<PlantState | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result as PlantState | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function savePlant(plant: PlantState): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(plant, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
