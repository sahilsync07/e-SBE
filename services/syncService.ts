import { Product, RawGroup, SyncStats } from '../types';
import { normalizeData, loadProductsFromStorage, saveProductsToStorage, saveLastSync } from '../utils';

const DATA_URL = 'https://raw.githubusercontent.com/sahilsync07/sbe/main/frontend/src/assets/stock-data.json';

export const performSync = async (): Promise<{ products: Product[], stats: SyncStats }> => {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const rawData: RawGroup[] = await response.json();
    const newProducts = normalizeData(rawData);
    const currentProducts = loadProductsFromStorage();
    
    // Calculate Deltas (Simple comparison based on ID and content hash simulation)
    const currentMap = new Map(currentProducts.map(p => [p.id, p]));
    const newMap = new Map(newProducts.map(p => [p.id, p]));
    
    let added = 0;
    let updated = 0;
    let deleted = 0;
    
    // Check for added and updated
    newProducts.forEach(np => {
      const existing = currentMap.get(np.id);
      if (!existing) {
        added++;
      } else {
        // Basic check if data changed
        if (JSON.stringify(existing) !== JSON.stringify(np)) {
          updated++;
        }
      }
    });

    // Check for deleted
    currentProducts.forEach(cp => {
      if (!newMap.has(cp.id)) {
        deleted++;
      }
    });

    // In a real app with incremental sync, we would merge carefully. 
    // Here, since the JSON is the source of truth, we replace local cache with new fetch.
    saveProductsToStorage(newProducts);
    const now = new Date().toLocaleString();
    saveLastSync(now);

    return {
      products: newProducts,
      stats: {
        added,
        updated,
        deleted,
        lastSynced: now
      }
    };
  } catch (error) {
    console.error("Sync failed:", error);
    throw error;
  }
};
