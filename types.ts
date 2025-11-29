export interface RawProduct {
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
  imageUrl: string;
}

export interface RawGroup {
  groupName: string;
  products: RawProduct[];
}

export interface Product extends RawProduct {
  id: string;
  groupName: string;
  searchString: string; // Lowercase string for easy searching
}

export interface CartItem {
  productId: string;
  productName: string;
  rate: number;
  sets: number; // 0 if 'note' mode is selected, otherwise 1, 2, or 3
  note: string;
  imageUrl: string;
  groupName: string;
}

export interface SyncStats {
  added: number;
  updated: number;
  deleted: number;
  lastSynced: string | null;
}

export interface AppState {
  products: Product[];
  cart: CartItem[];
  lastSync: string | null;
}