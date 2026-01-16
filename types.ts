export enum Platform {
  EBAY = 'eBay',
  DEPOP = 'Depop',
  VINTED = 'Vinted',
  FACEBOOK = 'Facebook Marketplace',
  GUMTREE = 'Gumtree',
  SHPOCK = 'Shpock'
}

export enum ItemStatus {
  DRAFT = 'Draft',
  LISTED = 'Listed',
  SOLD = 'Sold',
  SHIPPED = 'Shipped'
}

export interface InventoryItem {
  id: string;
  title: string;
  description: string;
  price: number;
  costPrice: number;
  platform: Platform;
  status: ItemStatus;
  imageUrl: string;
  dateAdded: string;
  views: number;
}

export interface Alert {
  id: string;
  keywords: string;
  minPrice: number;
  maxPrice: number;
  platforms: Platform[];
  isActive: boolean;
  matchesFound: number;
  lastChecked: string;
}

export type ViewState = 'dashboard' | 'dashboard-new' | 'inventory' | 'alerts' | 'results' | 'settings' | 'analytics' | 'research' | 'admin' | 'crosslisting' | 'arbitrage' | 'deals';
