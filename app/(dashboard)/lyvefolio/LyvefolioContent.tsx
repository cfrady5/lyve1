"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, DollarSign, Package, TrendingUp, Sparkles, RefreshCw } from "lucide-react";
import { ActiveItemsTab } from "./tabs/ActiveItemsTab";
import { SoldItemsTab } from "./tabs/SoldItemsTab";
import { AddItemModal } from "./modals/AddItemModal";
import { MarkSoldModal } from "./modals/MarkSoldModal";
import type { LyvefolioStats } from "./page";

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

interface LyvefolioContentProps {
  userId: string;
  initialStats: LyvefolioStats;
  sessions: Session[];
  platforms: Platform[];
}

export function LyvefolioContent({ 
  userId, 
  initialStats, 
  sessions, 
  platforms 
}: LyvefolioContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("active");
  const [stats, setStats] = useState(initialStats);
  const [searchQuery, setSearchQuery] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [markSoldOpen, setMarkSoldOpen] = useState(false);
  const [selectedItemForSale, setSelectedItemForSale] = useState<string | null>(null);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);

  const refreshStats = useCallback(async () => {
    const supabase = createClient();
    
    const [activeResult, salesResult] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id, cost_basis, estimated_value, lyve_value, status, lifecycle_status')
        .eq('user_id', userId),
      supabase
        .from('sales')
        .select('id, sold_price, fees, taxes, shipping, item_id')
        .eq('user_id', userId),
    ]);

    const allItems = activeResult.data || [];
    const salesData = salesResult.data || [];
    const soldItemIds = new Set(salesData.map(s => s.item_id));
    
    const activeItems = allItems.filter(item => {
      const isSold = soldItemIds.has(item.id) || 
                     item.status === 'SOLD' || 
                     item.lifecycle_status === 'sold';
      const isArchived = item.status === 'ARCHIVED' || item.lifecycle_status === 'archived';
      return !isSold && !isArchived;
    });

    const soldItemsWithCost = salesData.map(sale => {
      const item = allItems.find(i => i.id === sale.item_id);
      return { ...sale, cost_basis: item?.cost_basis || 0 };
    });

    setStats({
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
      total_estimated_value: activeItems.reduce((sum, i) => sum + (i.lyve_value || i.estimated_value || 0), 0),
    });

    router.refresh();
  }, [userId, router]);

  const handleAddItemSuccess = () => {
    setAddItemOpen(false);
    refreshStats();
  };

  const handleMarkSoldSuccess = () => {
    setMarkSoldOpen(false);
    setSelectedItemForSale(null);
    refreshStats();
  };

  const handleMarkSoldClick = (itemId?: string) => {
    setSelectedItemForSale(itemId || null);
    setMarkSoldOpen(true);
  };

  const handleBulkRefreshComps = async () => {
    setBulkRefreshing(true);
    try {
      const response = await fetch('/api/items/comps/bulk-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updated_before_days: 7,
          limit: 20,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh comps');
      }

      alert(`Successfully refreshed ${data.processed} item(s)${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
      refreshStats();
      router.refresh();
    } catch (err) {
      console.error('Error bulk refreshing comps:', err);
      alert(err instanceof Error ? err.message : 'Failed to refresh comps');
    } finally {
      setBulkRefreshing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">lyvefolio</h1>
          <p className="text-muted-foreground mt-1">
            Your complete inventory database — every card, every cost, every sale
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkRefreshComps}
            disabled={bulkRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${bulkRefreshing ? 'animate-spin' : ''}`} />
            Refresh Comps
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleMarkSoldClick()}>
            <DollarSign className="mr-2 h-4 w-4" />
            Mark Sold
          </Button>
          <Button onClick={() => setAddItemOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Cards</span>
            </div>
            <div className="text-2xl font-bold">{stats.total_active_items.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Spent</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_spent)}</div>
          </CardContent>
        </Card>
        
        {activeTab === "sold" ? (
          <>
            <Card className="bg-success-subtle border border-success-subtle">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-success-subtle mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Total Profit</span>
                </div>
                <div className={`text-2xl font-bold ${stats.total_profit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                  {formatCurrency(stats.total_profit)}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Avg ROI</span>
                </div>
                <div className={`text-2xl font-bold ${(stats.avg_roi || 0) >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                  {stats.avg_roi !== null ? `${stats.avg_roi}%` : '—'}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-medium tracking-wide">lyve value</span>
                </div>
                <div className="text-lg font-medium text-muted-foreground">
                  {stats.total_estimated_value > 0 ? formatCurrency(stats.total_estimated_value) : 'Coming soon'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Avg Cost</span>
                </div>
                <div className="text-2xl font-bold">
                  {stats.total_active_items > 0 
                    ? formatCurrency(stats.total_spent / stats.total_active_items)
                    : '—'}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search items by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-11">
          <TabsTrigger value="active" className="text-sm font-medium">
            <span className="flex items-center gap-2">
              Active
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-background">
                {stats.total_active_items}
              </Badge>
            </span>
          </TabsTrigger>
          <TabsTrigger value="sold" className="text-sm font-medium">
            <span className="flex items-center gap-2">
              Sold
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-success-subtle text-success-subtle">
                {stats.total_sold_items}
              </Badge>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <ActiveItemsTab 
            userId={userId}
            searchQuery={searchQuery}
            sessions={sessions}
            onMarkSold={handleMarkSoldClick}
            onRefresh={refreshStats}
          />
        </TabsContent>

        <TabsContent value="sold" className="mt-6">
          <SoldItemsTab 
            userId={userId}
            searchQuery={searchQuery}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddItemModal
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        userId={userId}
        onSuccess={handleAddItemSuccess}
      />

      <MarkSoldModal
        open={markSoldOpen}
        onOpenChange={setMarkSoldOpen}
        userId={userId}
        platforms={platforms}
        sessions={sessions}
        preselectedItemId={selectedItemForSale}
        onSuccess={handleMarkSoldSuccess}
      />
    </div>
  );
}
