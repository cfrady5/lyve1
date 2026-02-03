'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign } from 'lucide-react';
import type { Session, Break, SessionExpense } from '@/lib/types/sessions';
import { SHOW_TYPE_LABELS, PLATFORM_LABELS } from '@/lib/types/sessions';

interface BreakevenCalculatorProps {
  session: Session;
  inventoryCost: number;
  breaksCost: number;
  expenses: SessionExpense[];
  itemCount: number;
  breaks: Break[];
  onSessionUpdate?: (updates: Partial<Session>) => void;
}

export function BreakevenCalculator({
  session,
  inventoryCost,
  breaksCost,
  expenses,
  itemCount,
  breaks,
  onSessionUpdate,
}: BreakevenCalculatorProps) {
  const [feeRate, setFeeRate] = useState(session.estimated_fee_rate || 0.12);
  const [profitTargetAmount, setProfitTargetAmount] = useState(session.profit_target_amount || 0);
  const [profitTargetPercent, setProfitTargetPercent] = useState(session.profit_target_percent || 0);
  const [revenueAllocationSingles, setRevenueAllocationSingles] = useState(
    session.revenue_allocation_singles_percent || 50
  );
  const [sellThroughSingles] = useState(
    session.sell_through_singles_percent || 100
  );

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const calculations = useMemo(() => {
    const totalOutlay = inventoryCost + breaksCost + totalExpenses;

    // Determine profit target
    let profitTarget = 0;
    if (profitTargetAmount > 0) {
      profitTarget = profitTargetAmount;
    } else if (profitTargetPercent > 0) {
      profitTarget = totalOutlay * (profitTargetPercent / 100);
    }

    // Breakeven formula: (Total Outlay + Profit Target) / (1 - Fee Rate)
    const breakevenRevenue = (totalOutlay + profitTarget) / (1 - feeRate);

    // Calculate targets based on show type
    let requiredAvgPerCard = 0;
    let requiredAvgPerSoldCard = 0;
    let requiredPerSpot = 0;
    let revenueFromSingles = 0;
    let revenueFromBreaks = 0;
    const breaksDetail: Array<{ break_id: string; title: string; required_per_spot: number; spot_count: number }> = [];

    const totalSpots = breaks.reduce((sum, b) => sum + (b.spot_count || 0), 0);

    if (session.show_type === 'singles_only') {
      // Singles only
      if (itemCount > 0) {
        requiredAvgPerCard = breakevenRevenue / itemCount;
        const soldCount = Math.max(1, Math.round(itemCount * (sellThroughSingles / 100)));
        requiredAvgPerSoldCard = breakevenRevenue / soldCount;
      }
    } else if (session.show_type === 'breaks_only') {
      // Breaks only
      if (totalSpots > 0) {
        requiredPerSpot = breakevenRevenue / totalSpots;
      }

      // Per-break detail
      breaks.forEach((breakItem) => {
        const breakOutlay = breakItem.box_cost;
        const breakBreakeven = breakOutlay / (1 - feeRate);
        const perSpot = breakItem.spot_count > 0 ? breakBreakeven / breakItem.spot_count : 0;
        breaksDetail.push({
          break_id: breakItem.id,
          title: breakItem.title,
          required_per_spot: perSpot,
          spot_count: breakItem.spot_count,
        });
      });
    } else if (session.show_type === 'mixed') {
      // Mixed: allocate revenue
      revenueFromSingles = breakevenRevenue * (revenueAllocationSingles / 100);
      revenueFromBreaks = breakevenRevenue * ((100 - revenueAllocationSingles) / 100);

      if (itemCount > 0) {
        requiredAvgPerCard = revenueFromSingles / itemCount;
        const soldCount = Math.max(1, Math.round(itemCount * (sellThroughSingles / 100)));
        requiredAvgPerSoldCard = revenueFromSingles / soldCount;
      }

      if (totalSpots > 0) {
        requiredPerSpot = revenueFromBreaks / totalSpots;
      }

      // Per-break detail for mixed
      breaks.forEach((breakItem) => {
        const breakShare = (breakItem.spot_count / totalSpots) * revenueFromBreaks;
        const perSpot = breakItem.spot_count > 0 ? breakShare / breakItem.spot_count : 0;
        breaksDetail.push({
          break_id: breakItem.id,
          title: breakItem.title,
          required_per_spot: perSpot,
          spot_count: breakItem.spot_count,
        });
      });
    }

    return {
      totalOutlay,
      profitTarget,
      breakevenRevenue,
      requiredAvgPerCard,
      requiredAvgPerSoldCard,
      requiredPerSpot,
      revenueFromSingles,
      revenueFromBreaks,
      breaksDetail,
    };
  }, [
    inventoryCost,
    breaksCost,
    totalExpenses,
    feeRate,
    profitTargetAmount,
    profitTargetPercent,
    session.show_type,
    revenueAllocationSingles,
    sellThroughSingles,
    itemCount,
    breaks,
  ]);

  const profitTargets = useMemo(() => {
    const base = calculations.breakevenRevenue;
    return {
      ten_percent: base * 1.1,
      twenty_five_percent: base * 1.25,
      fifty_percent: base * 1.5,
    };
  }, [calculations.breakevenRevenue]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Breakeven Calculator</h3>
        <p className="text-sm text-muted-foreground">
          Real-time profitability targets based on your costs
        </p>
      </div>

      {/* Session Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Platform</CardTitle>
              <p className="text-lg font-semibold">{PLATFORM_LABELS[session.platform]}</p>
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Show Type</CardTitle>
              <p className="text-lg font-semibold">{SHOW_TYPE_LABELS[session.show_type]}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Inventory Cost</span>
            <span className="font-mono font-semibold">${inventoryCost.toFixed(2)}</span>
          </div>
          {session.show_type !== 'singles_only' && (
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Break Product Cost</span>
              <span className="font-mono font-semibold">${breaksCost.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Total Expenses</span>
            <span className="font-mono font-semibold">${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t pt-2">
            <span className="text-sm font-semibold">Total Planned Outlay</span>
            <span className="font-mono text-lg font-bold">${calculations.totalOutlay.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Fee Rate & Profit Target */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fee_rate">Platform Fee Rate (%)</Label>
            <Input
              id="fee_rate"
              type="number"
              step="0.01"
              value={(feeRate * 100).toFixed(2)}
              onChange={(e) => {
                const rate = parseFloat(e.target.value) / 100;
                setFeeRate(rate);
                onSessionUpdate?.({ estimated_fee_rate: rate });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Current: {(feeRate * 100).toFixed(1)}% fee
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profit_amount">Profit Target ($)</Label>
              <Input
                id="profit_amount"
                type="number"
                step="0.01"
                value={profitTargetAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setProfitTargetAmount(val);
                  setProfitTargetPercent(0);
                  onSessionUpdate?.({ profit_target_amount: val, profit_target_percent: 0 });
                }}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profit_percent">Profit Target (%)</Label>
              <Input
                id="profit_percent"
                type="number"
                step="1"
                value={profitTargetPercent}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setProfitTargetPercent(val);
                  setProfitTargetAmount(0);
                  onSessionUpdate?.({ profit_target_percent: val, profit_target_amount: 0 });
                }}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Allocation (Mixed Shows Only) */}
      {session.show_type === 'mixed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Allocation</CardTitle>
            <CardDescription>
              Expected revenue split between singles and breaks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Singles vs Breaks</Label>
              <Slider
                value={[revenueAllocationSingles]}
                onValueChange={([val]) => {
                  setRevenueAllocationSingles(val);
                  onSessionUpdate?.({ revenue_allocation_singles_percent: val });
                }}
                min={0}
                max={100}
                step={5}
              />
              <div className="flex justify-between text-sm">
                <span>{revenueAllocationSingles}% Singles</span>
                <span>{100 - revenueAllocationSingles}% Breaks</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Revenue from Singles</p>
                <p className="font-mono font-semibold">${calculations.revenueFromSingles.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue from Breaks</p>
                <p className="font-mono font-semibold">${calculations.revenueFromBreaks.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakeven Revenue */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Breakeven Revenue
          </CardTitle>
          <CardDescription>
            Total revenue needed to break even
            {calculations.profitTarget > 0 && ` (includes $${calculations.profitTarget.toFixed(2)} profit target)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-primary text-primary-foreground rounded-lg">
              <p className="text-3xl font-mono font-bold">
                ${calculations.breakevenRevenue.toFixed(2)}
              </p>
              <p className="text-xs mt-2 opacity-90">
                Formula: ${calculations.totalOutlay.toFixed(2)} ÷ (1 - {(feeRate * 100).toFixed(1)}%)
                {calculations.profitTarget > 0 && ` + $${calculations.profitTarget.toFixed(2)}`}
              </p>
            </div>

            {/* Per-Unit Targets */}
            <div className="space-y-3 pt-2 border-t">
              {(session.show_type === 'singles_only' || session.show_type === 'mixed') && itemCount > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Required Avg Per Card</span>
                    <span className="font-mono font-bold text-lg">
                      ${calculations.requiredAvgPerCard.toFixed(2)}
                    </span>
                  </div>
                  {sellThroughSingles < 100 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        If {sellThroughSingles}% sell-through
                      </span>
                      <span className="font-mono font-bold text-lg">
                        ${calculations.requiredAvgPerSoldCard.toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {(session.show_type === 'breaks_only' || session.show_type === 'mixed') && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Required Per Spot (Overall)</span>
                  <span className="font-mono font-bold text-lg">
                    ${calculations.requiredPerSpot.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Per-Break Detail */}
            {calculations.breaksDetail.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Per-Break Targets</p>
                {calculations.breaksDetail.map((detail) => (
                  <div key={detail.break_id} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {detail.title} ({detail.spot_count} spots)
                    </span>
                    <span className="font-mono font-semibold">
                      ${detail.required_per_spot.toFixed(2)}/spot
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profit Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Profit Targets
          </CardTitle>
          <CardDescription>
            Revenue needed for profit margins above breakeven
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 bg-success-subtle border border-success-subtle rounded-lg">
              <div>
                <p className="text-sm font-medium">+10% Profit</p>
                <p className="text-xs text-muted-foreground">
                  ${(profitTargets.ten_percent - calculations.breakevenRevenue).toFixed(2)} above breakeven
                </p>
              </div>
              <Badge variant="outline" className="bg-white font-mono">
                ${profitTargets.ten_percent.toFixed(2)}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div>
                <p className="text-sm font-medium">+25% Profit</p>
                <p className="text-xs text-muted-foreground">
                  ${(profitTargets.twenty_five_percent - calculations.breakevenRevenue).toFixed(2)} above breakeven
                </p>
              </div>
              <Badge variant="outline" className="bg-white font-mono">
                ${profitTargets.twenty_five_percent.toFixed(2)}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <div>
                <p className="text-sm font-medium">+50% Profit</p>
                <p className="text-xs text-muted-foreground">
                  ${(profitTargets.fifty_percent - calculations.breakevenRevenue).toFixed(2)} above breakeven
                </p>
              </div>
              <Badge variant="outline" className="bg-white font-mono">
                ${profitTargets.fifty_percent.toFixed(2)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
