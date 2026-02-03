"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, ImageIcon } from "lucide-react";

interface SoldItem {
  id: string;
  item_id: string;
  name: string | null;
  image: string | null;
  cost_basis: number | null;
  sold_price: number;
  fees: number;
  taxes: number;
  shipping: number;
  net_payout: number;
  net_profit: number;
  roi_percent: number | null;
  sold_at: string;
  channel: string;
  session_id: string | null;
  session_name: string | null;
}

interface SoldItemsTabProps {
  userId: string;
  searchQuery: string;
}

export function SoldItemsTab({ userId, searchQuery }: SoldItemsTabProps) {
  const [items, setItems] = useState<SoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Get sales with item data
      let query = supabase
        .from('sales')
        .select(`
          id,
          item_id,
          sold_price,
          fees,
          taxes,
          shipping,
          sold_at,
          channel,
          session_id,
          session:sessions(name),
          item:inventory_items!inner(
            name,
            display_name,
            cost_basis,
            image_url,
            photo_url
          )
        `)
        .eq('user_id', userId);

      // Apply channel filter
      if (channelFilter && channelFilter !== "all") {
        query = query.eq('channel', channelFilter);
      }

      // Apply sort
      const sortField = sortBy === 'profit' ? 'sold_price' : // Will sort client-side for profit
                        sortBy === 'cost' ? 'sold_price' :
                        sortBy === 'roi' ? 'sold_price' : // Will sort client-side for ROI
                        'sold_at';
      query = query.order(sortField, { ascending: sortDir === 'asc' });

      const { data, error: fetchError } = await query.limit(200);

      if (fetchError) throw fetchError;

      // Transform data
      const transformed: SoldItem[] = (data || []).map(sale => {
        const itemData = Array.isArray(sale.item) ? sale.item[0] : sale.item;
        const sessionData = Array.isArray(sale.session) ? sale.session[0] : sale.session;
        
        const costBasis = itemData?.cost_basis || 0;
        const netPayout = sale.sold_price - (sale.fees || 0) - (sale.taxes || 0) - (sale.shipping || 0);
        const netProfit = netPayout - costBasis;
        const roiPercent = costBasis > 0 ? (netProfit / costBasis) * 100 : null;

        return {
          id: sale.id,
          item_id: sale.item_id,
          name: itemData?.name || itemData?.display_name || 'Item',
          image: itemData?.image_url || itemData?.photo_url || null,
          cost_basis: costBasis,
          sold_price: sale.sold_price,
          fees: sale.fees || 0,
          taxes: sale.taxes || 0,
          shipping: sale.shipping || 0,
          net_payout: netPayout,
          net_profit: netProfit,
          roi_percent: roiPercent !== null ? Math.round(roiPercent * 10) / 10 : null,
          sold_at: sale.sold_at,
          channel: sale.channel || 'other',
          session_id: sale.session_id,
          session_name: sessionData?.name || null,
        };
      });

      // Apply search filter
      let filtered = transformed;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
          item.name?.toLowerCase().includes(query)
        );
      }

      // Client-side sort for profit and ROI
      if (sortBy === 'profit') {
        filtered.sort((a, b) => {
          const comparison = a.net_profit - b.net_profit;
          return sortDir === 'asc' ? comparison : -comparison;
        });
      } else if (sortBy === 'roi') {
        filtered.sort((a, b) => {
          const aRoi = a.roi_percent || 0;
          const bRoi = b.roi_percent || 0;
          const comparison = aRoi - bRoi;
          return sortDir === 'asc' ? comparison : -comparison;
        });
      }

      setItems(filtered);
    } catch (err) {
      console.error('Error loading sold items:', err);
      setError('Failed to load sold items');
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, sortBy, sortDir, channelFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const channelLabels: Record<string, string> = {
    whatnot: 'Whatnot',
    ebay: 'eBay',
    instagram: 'Instagram',
    in_person: 'In Person',
    other: 'Other',
  };

  // Calculate summary stats
  const totalRevenue = items.reduce((sum, i) => sum + i.sold_price, 0);
  const totalProfit = items.reduce((sum, i) => sum + i.net_profit, 0);
  const avgRoi = items.filter(i => i.roi_percent !== null).length > 0
    ? items.filter(i => i.roi_percent !== null).reduce((sum, i) => sum + (i.roi_percent || 0), 0) / items.filter(i => i.roi_percent !== null).length
    : null;

  if (loading) {
    return <LoadingState message="Loading sales..." />;
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
        icon={<DollarSign className="w-8 h-8 text-muted-foreground" />}
        title="No sold items yet"
        description={searchQuery || channelFilter !== "all"
          ? "No sales match your filters" 
          : "Items you sell will appear here with profit calculations"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Total Revenue
            </div>
            <div className="text-xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className={totalProfit >= 0 ? "bg-success-subtle" : "bg-danger-subtle"}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Total Profit
            </div>
            <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
              {formatCurrency(totalProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Avg ROI
            </div>
            <div className={`text-xl font-bold ${(avgRoi || 0) >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
              {avgRoi !== null ? `${avgRoi.toFixed(1)}%` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="whatnot">Whatnot</SelectItem>
            <SelectItem value="ebay">eBay</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="in_person">In Person</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sold Date</SelectItem>
            <SelectItem value="profit">Profit</SelectItem>
            <SelectItem value="roi">ROI %</SelectItem>
            <SelectItem value="cost">Sale Price</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortDir(prev => prev === "asc" ? "desc" : "asc")}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </Button>
      </div>

      {/* Item Count */}
      <p className="text-sm text-muted-foreground">
        {items.length} {items.length === 1 ? 'sale' : 'sales'}
      </p>

      {/* Sales Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12"></TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Fees/Tax</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Channel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt="" 
                        className="w-full h-full object-cover opacity-75"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  {item.session_name && (
                    <div className="text-xs text-muted-foreground">Session: {item.session_name}</div>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(item.cost_basis)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.sold_price)}
                </TableCell>
                <TableCell className="text-right text-danger-subtle text-sm">
                  -{formatCurrency(item.fees + item.taxes + item.shipping)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-semibold ${item.net_profit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                    {item.net_profit >= 0 ? '+' : ''}{formatCurrency(item.net_profit)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {item.roi_percent !== null ? (
                    <span className={`flex items-center justify-end gap-1 ${item.roi_percent >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                      {item.roi_percent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {item.roi_percent.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(item.sold_at)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {channelLabels[item.channel] || item.channel}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
