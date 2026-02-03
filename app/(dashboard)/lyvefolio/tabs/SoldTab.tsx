"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import type { LyvefolioFilters } from "@/lib/types/lyvefolio";
import { TrendingUp, DollarSign, Package, ImageIcon } from "lucide-react";

interface SoldTabProps {
  filters: LyvefolioFilters;
  userId: string;
}

interface SoldItem {
  id: string;
  name: string;
  cost_basis: number | null;
  image_url: string | null;
  created_at: string;
  sold_date: string | null;
  sold_price: number | null;
  platform_name: string | null;
  session_name: string | null;
  days_held: number;
  gross_profit: number;
  net_profit: number;
  roi_percent: number;
  fees: number;
}

interface SoldMetrics {
  total_sales: number;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  total_fees: number;
  total_net_profit: number;
  avg_roi: number;
  avg_days_to_sell: number;
}

export function SoldTab({ filters, userId }: SoldTabProps) {
  const [items, setItems] = useState<SoldItem[]>([]);
  const [metrics, setMetrics] = useState<SoldMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Get items with lifecycle_status = 'sold' or items linked via sale_items
      const { data: soldItems, error: fetchError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          cost_basis,
          image_url,
          created_at,
          lifecycle_status,
          sale_items(
            id,
            sold_price,
            created_at,
            platform_id,
            platforms:platform_id(name)
          ),
          session_items(
            session:sessions(id, name)
          )
        `)
        .eq('user_id', userId)
        .or('lifecycle_status.eq.sold');

      if (fetchError) throw fetchError;

      // Also get items that have sale_items but might not have lifecycle_status set
      const { data: legacySold, error: legacyError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          cost_basis,
          image_url,
          created_at,
          lifecycle_status,
          sale_items!inner(
            id,
            sold_price,
            created_at,
            platform_id,
            platforms:platform_id(name)
          ),
          session_items(
            session:sessions(id, name)
          )
        `)
        .eq('user_id', userId);

      if (legacyError) throw legacyError;

      // Merge and dedupe
      const allSoldMap = new Map<string, typeof soldItems[0]>();
      [...(soldItems || []), ...(legacySold || [])].forEach(item => {
        if (!allSoldMap.has(item.id)) {
          allSoldMap.set(item.id, item);
        }
      });

      // Transform the data
      const transformed: SoldItem[] = Array.from(allSoldMap.values()).map(item => {
        const saleItem = Array.isArray(item.sale_items) 
          ? item.sale_items[0] 
          : item.sale_items;
        
        const soldPrice = saleItem?.sold_price || 0;
        const costBasis = item.cost_basis || 0;
        const soldDate = saleItem?.created_at || null;
        
        // Extract platform name
        let platformName = null;
        if (saleItem?.platforms) {
          const platform = Array.isArray(saleItem.platforms) 
            ? saleItem.platforms[0] 
            : saleItem.platforms;
          platformName = platform?.name || null;
        }

        // Extract session info
        let sessionName = null;
        if (item.session_items && Array.isArray(item.session_items) && item.session_items.length > 0) {
          const sessionItem = item.session_items[0];
          if (sessionItem.session) {
            const session = Array.isArray(sessionItem.session) 
              ? sessionItem.session[0] 
              : sessionItem.session;
            sessionName = session?.name || null;
          }
        }

        // Calculate days held
        const created = new Date(item.created_at);
        const sold = soldDate ? new Date(soldDate) : new Date();
        const daysHeld = Math.floor((sold.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate profits
        // Assume platform fee of 10% for now (will be configurable)
        const fees = soldPrice * 0.10;
        const grossProfit = soldPrice - costBasis;
        const netProfit = grossProfit - fees;
        const roiPercent = costBasis > 0 ? (netProfit / costBasis) * 100 : 0;

        return {
          id: item.id,
          name: item.name,
          cost_basis: item.cost_basis,
          image_url: item.image_url,
          created_at: item.created_at,
          sold_date: soldDate,
          sold_price: soldPrice,
          platform_name: platformName,
          session_name: sessionName,
          days_held: Math.max(0, daysHeld),
          gross_profit: grossProfit,
          net_profit: netProfit,
          roi_percent: roiPercent,
          fees,
        };
      });

      // Apply search filter
      let filtered = transformed;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(item => 
          item.name.toLowerCase().includes(searchLower)
        );
      }

      // Apply session filter
      if (filters.session_id) {
        filtered = filtered.filter(item => 
          item.session_name // This is simplified; in production would filter by session_id
        );
      }

      // Sort
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (filters.sort_by) {
          case 'profit':
            comparison = a.net_profit - b.net_profit;
            break;
          case 'roi':
            comparison = a.roi_percent - b.roi_percent;
            break;
          case 'cost':
            comparison = (a.cost_basis || 0) - (b.cost_basis || 0);
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'days_held':
            comparison = a.days_held - b.days_held;
            break;
          default:
            comparison = new Date(a.sold_date || a.created_at).getTime() - 
                        new Date(b.sold_date || b.created_at).getTime();
        }
        return filters.sort_direction === 'asc' ? comparison : -comparison;
      });

      setItems(filtered);

      // Calculate metrics
      const calcMetrics: SoldMetrics = {
        total_sales: filtered.length,
        total_revenue: filtered.reduce((sum, i) => sum + (i.sold_price || 0), 0),
        total_cost: filtered.reduce((sum, i) => sum + (i.cost_basis || 0), 0),
        total_gross_profit: filtered.reduce((sum, i) => sum + i.gross_profit, 0),
        total_fees: filtered.reduce((sum, i) => sum + i.fees, 0),
        total_net_profit: filtered.reduce((sum, i) => sum + i.net_profit, 0),
        avg_roi: filtered.length > 0 
          ? filtered.reduce((sum, i) => sum + i.roi_percent, 0) / filtered.length 
          : 0,
        avg_days_to_sell: filtered.length > 0 
          ? filtered.reduce((sum, i) => sum + i.days_held, 0) / filtered.length 
          : 0,
      };
      setMetrics(calcMetrics);

    } catch (err) {
      console.error('Error loading sold items:', err);
      setError('Failed to load sold items');
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (loading) {
    return <LoadingState message="Loading sold items..." />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">{error}</p>
          <Button onClick={loadItems} variant="outline" className="mt-4 mx-auto block">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<DollarSign className="w-6 h-6 text-muted-foreground" />}
        title="No sold items yet"
        description={filters.search || filters.session_id 
          ? "No sold items match your current filters" 
          : "Items you sell will appear here with profit calculations"
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Card className="bg-success-subtle border border-success-subtle">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success-subtle" />
                <span className="text-xs text-muted-foreground">Net Profit</span>
              </div>
              <div className={`text-2xl font-bold ${metrics.total_net_profit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                ${metrics.total_net_profit.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Revenue</span>
              </div>
              <div className="text-2xl font-bold">
                ${metrics.total_revenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Items Sold</span>
              </div>
              <div className="text-2xl font-bold">
                {metrics.total_sales}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Avg ROI</span>
              </div>
              <div className={`text-2xl font-bold ${metrics.avg_roi >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                {metrics.avg_roi.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Avg Days to Sell</span>
              </div>
              <div className="text-2xl font-bold">
                {Math.round(metrics.avg_days_to_sell)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sold Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map(item => (
          <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
            {/* Image Area */}
            <div className="aspect-square bg-muted relative">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={item.name} 
                  className="w-full h-full object-cover opacity-75"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
              
              {/* SOLD Badge */}
              <Badge 
                className="absolute top-2 left-2 bg-green-600 text-white"
              >
                SOLD
              </Badge>

              {/* Profit Badge */}
              <Badge 
                variant={item.net_profit >= 0 ? "default" : "destructive"}
                className={`absolute bottom-2 right-2 ${item.net_profit >= 0 ? 'bg-green-600' : 'bg-red-600'}`}
              >
                {item.net_profit >= 0 ? '+' : ''}${item.net_profit.toFixed(2)}
              </Badge>
            </div>

            {/* Card Content */}
            <CardContent className="p-4 space-y-2">
              <h3 className="font-medium truncate" title={item.name}>
                {item.name}
              </h3>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-muted-foreground">Cost:</div>
                <div className="text-right">${item.cost_basis?.toFixed(2) || '0.00'}</div>
                
                <div className="text-muted-foreground">Sold:</div>
                <div className="text-right">${item.sold_price?.toFixed(2) || '0.00'}</div>
                
                <div className="text-muted-foreground">Fees:</div>
                <div className="text-right text-danger-subtle">-${item.fees.toFixed(2)}</div>
                
                <div className="text-muted-foreground">ROI:</div>
                <div className={`text-right font-medium ${item.roi_percent >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                  {item.roi_percent.toFixed(1)}%
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>{item.days_held} days</span>
                {item.platform_name && (
                  <Badge variant="outline" className="text-xs">
                    {item.platform_name}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
