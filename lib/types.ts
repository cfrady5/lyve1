import { User } from '@supabase/supabase-js';

export interface InventoryItem {
  id: string;
  user_id: string;
  image_url: string;
  cost_basis: number;
  title?: string;
  notes?: string;
  date_acquired: string;
  sold: boolean;
  created_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  inventory_id?: string;
  sale_date: string;
  sale_price: number;
  fees: number;
  net_profit: number;
  platform_order_id?: string;
  created_at: string;
}

export interface ProfitInsight {
  totalRevenue: number;
  totalCosts: number;
  totalFees: number;
  netProfit: number;
  profitMargin: number;
  itemsSold: number;
  itemsInInventory: number;
  averageSalePrice: number;
  averageCostBasis: number;
}

export type { User };
