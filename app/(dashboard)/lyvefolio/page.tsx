import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LyvefolioContent } from "./LyvefolioContent";

export const dynamic = 'force-dynamic';

interface Platform {
  id: string;
  platform_key: string;
  display_name: string;
  fee_percent_default: number;
  payment_processing_percent_default: number;
  payment_processing_fixed_default: number;
}

interface Session {
  id: string;
  name: string;
  created_at: string;
}

export interface LyvefolioStats {
  total_active_items: number;
  total_spent: number;
  total_sold_items: number;
  total_revenue: number;
  total_profit: number;
  avg_roi: number | null;
  total_estimated_value: number;
}

export default async function LyvefolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all data in parallel
  const [activeResult, salesResult, sessionsResult, platformsResult] = await Promise.all([
    // Active items with cost basis
    supabase
      .from('inventory_items')
      .select('id, cost_basis, estimated_value, status, lifecycle_status')
      .eq('user_id', user.id),
    
    // Sales with item data for profit calculations
    supabase
      .from('sales')
      .select('id, sold_price, fees, taxes, shipping, item_id')
      .eq('user_id', user.id),
    
    // Sessions for dropdown
    supabase
      .from('sessions')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    
    // Platforms for fee calculations
    supabase
      .from('platforms')
      .select('id, platform_key, display_name, fee_percent_default, payment_processing_percent_default, payment_processing_fixed_default')
      .eq('is_active', true)
      .order('display_name'),
  ]);

  const allItems = activeResult.data || [];
  const salesData = salesResult.data || [];
  const soldItemIds = new Set(salesData.map(s => s.item_id));
  
  // Active items = items not in sales AND not marked as sold/archived
  const activeItems = allItems.filter(item => {
    const isSold = soldItemIds.has(item.id) || 
                   item.status === 'SOLD' || 
                   item.lifecycle_status === 'sold';
    const isArchived = item.status === 'ARCHIVED' || item.lifecycle_status === 'archived';
    return !isSold && !isArchived;
  });

  // Get cost basis for sold items
  const soldItemsWithCost = salesData.map(sale => {
    const item = allItems.find(i => i.id === sale.item_id);
    return {
      ...sale,
      cost_basis: item?.cost_basis || 0,
    };
  });

  // Calculate stats
  const stats: LyvefolioStats = {
    total_active_items: activeItems.length,
    total_spent: activeItems.reduce((sum, i) => sum + (i.cost_basis || 0), 0),
    total_sold_items: salesData.length,
    total_revenue: salesData.reduce((sum, s) => sum + (s.sold_price || 0), 0),
    total_profit: soldItemsWithCost.reduce((sum, s) => {
      const netPayout = (s.sold_price || 0) - (s.fees || 0) - (s.taxes || 0) - (s.shipping || 0);
      return sum + (netPayout - s.cost_basis);
    }, 0),
    avg_roi: (() => {
      const roiItems = soldItemsWithCost.filter(s => s.cost_basis > 0);
      if (roiItems.length === 0) return null;
      const totalRoi = roiItems.reduce((sum, s) => {
        const netPayout = (s.sold_price || 0) - (s.fees || 0) - (s.taxes || 0) - (s.shipping || 0);
        return sum + ((netPayout - s.cost_basis) / s.cost_basis * 100);
      }, 0);
      return Math.round(totalRoi / roiItems.length * 10) / 10;
    })(),
    total_estimated_value: activeItems.reduce((sum, i) => sum + (i.estimated_value || 0), 0),
  };

  const sessions: Session[] = sessionsResult.data || [];
  const platforms: Platform[] = platformsResult.data || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4">
      <LyvefolioContent 
        userId={user.id}
        initialStats={stats}
        sessions={sessions}
        platforms={platforms}
      />
    </div>
  );
}
