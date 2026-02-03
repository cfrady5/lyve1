'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, DollarSign, Percent, Trophy, LogOut, Loader2 } from 'lucide-react';

interface AccountContentProps {
  userId: string;
  userEmail: string;
}

interface PlayerStats {
  playerName: string;
  profit: number;
  revenue: number;
  roi: number;
  soldCount: number;
}

interface OverallStats {
  totalRevenue: number;
  totalProfit: number;
  overallROI: number;
  totalSold: number;
}

export function AccountContent({ userId, userEmail }: AccountContentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [topPlayers, setTopPlayers] = useState<PlayerStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalRevenue: 0,
    totalProfit: 0,
    overallROI: 0,
    totalSold: 0,
  });

  useEffect(() => {
    fetchAccountData();
  }, [userId]);

  const fetchAccountData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Fetch sales data with inventory items
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sold_price,
          fees,
          taxes_collected,
          shipping_cost,
          inventory_items(
            id,
            cost_basis,
            player,
            name
          )
        `)
        .eq('user_id', userId);

      if (salesError) {
        console.error('[ACCOUNT] Error fetching sales:', salesError);
        return;
      }

      const sales = salesData || [];

      // Calculate overall stats
      let totalRevenue = 0;
      let totalCostBasis = 0;
      let totalProfit = 0;

      const playerMap = new Map<string, {
        profit: number;
        revenue: number;
        costBasis: number;
        count: number;
      }>();

      sales.forEach(sale => {
        const item = Array.isArray(sale.inventory_items)
          ? sale.inventory_items[0]
          : sale.inventory_items;

        const revenue = sale.sold_price || 0;
        const costBasis = item?.cost_basis || 0;
        const fees = sale.fees || 0;
        const taxes = sale.taxes_collected || 0;
        const shipping = sale.shipping_cost || 0;

        const profit = revenue - fees - taxes - shipping - costBasis;

        totalRevenue += revenue;
        totalCostBasis += costBasis + fees + taxes + shipping;
        totalProfit += profit;

        // Determine player name
        let playerName = 'Unknown';
        if (item?.player) {
          playerName = item.player;
        } else if (item?.name) {
          // Parse player from item name
          const name = item.name;
          // Try to extract before " base" or " ("
          if (name.includes(' base')) {
            playerName = name.split(' base')[0].trim();
          } else if (name.includes(' (')) {
            playerName = name.split(' (')[0].trim();
          } else {
            // Take first two words
            const words = name.split(' ');
            playerName = words.slice(0, 2).join(' ');
          }
        }

        // Aggregate by player
        if (!playerMap.has(playerName)) {
          playerMap.set(playerName, {
            profit: 0,
            revenue: 0,
            costBasis: 0,
            count: 0,
          });
        }

        const playerStats = playerMap.get(playerName)!;
        playerStats.profit += profit;
        playerStats.revenue += revenue;
        playerStats.costBasis += costBasis + fees + taxes + shipping;
        playerStats.count += 1;
      });

      // Calculate overall ROI
      const overallROI = totalCostBasis > 0 ? (totalProfit / totalCostBasis) * 100 : 0;

      setOverallStats({
        totalRevenue,
        totalProfit,
        overallROI,
        totalSold: sales.length,
      });

      // Build top players leaderboard
      const playersArray: PlayerStats[] = Array.from(playerMap.entries())
        .map(([playerName, stats]) => ({
          playerName,
          profit: stats.profit,
          revenue: stats.revenue,
          roi: stats.costBasis > 0 ? (stats.profit / stats.costBasis) * 100 : 0,
          soldCount: stats.count,
        }))
        .filter(p => p.playerName !== 'Unknown')
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);

      setTopPlayers(playersArray);
    } catch (err) {
      console.error('[ACCOUNT] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading account data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-[1400px] mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">account</h1>
          <p className="text-muted-foreground mt-1">{userEmail}</p>
        </div>
        <Button variant="destructive" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Overall Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(overallStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallStats.totalSold} {overallStats.totalSold === 1 ? 'sale' : 'sales'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overall Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${overallStats.totalProfit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
              {formatCurrency(overallStats.totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              After fees and costs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Overall ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${overallStats.overallROI >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
              {overallStats.overallROI > 0 ? formatPercent(overallStats.overallROI) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Return on investment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Players Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top 5 Most Profitable Players
          </CardTitle>
          <CardDescription>
            Players generating the highest total profit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topPlayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No player data available yet. Start selling items to see your top performers!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPlayers.map((player, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-bold">
                      {idx === 0 && <span className="text-yellow-500">🥇</span>}
                      {idx === 1 && <span className="text-gray-400">🥈</span>}
                      {idx === 2 && <span className="text-warning-subtle">🥉</span>}
                      {idx > 2 && `#${idx + 1}`}
                    </TableCell>
                    <TableCell className="font-medium">{player.playerName}</TableCell>
                    <TableCell className="text-right text-success-subtle font-medium">
                      {formatCurrency(player.profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {player.roi > 0 ? formatPercent(player.roi) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(player.revenue)}</TableCell>
                    <TableCell className="text-right">{player.soldCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
