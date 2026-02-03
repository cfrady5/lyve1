'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Package,
  Target,
  Users,
  AlertCircle,
  FileText,
  Award,
  Clock,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';

interface ReportData {
  sessionId: string;
  reconciled: boolean;
  message?: string;
  session?: {
    id: string;
    title: string;
    date: string;
    platform: string;
    status: string;
  };
  kpis?: {
    grossRevenue: number;
    netProfit: number;
    profitMargin: number;
    totalCOGS: number;
    totalFees: number;
    totalTaxes: number;
    totalShipping: number;
    totalExpenses: number;
    avgRevenuePerCard: number;
    avgProfitPerCard: number;
    itemsRun: number;
    itemsSold: number;
    sellThrough: number;
  };
  breakevenComparison?: {
    plannedBreakeven: number;
    actualRevenue: number;
    overUnder: number;
    overUnderPercent: number;
    plannedProfitTarget: number | null;
    actualProfit: number;
    profitDiff: number | null;
  } | null;
  runOrderPerformance?: {
    segments: Array<{
      label: string;
      startItem: number;
      endItem: number;
      revenue: number;
      profit: number;
      count: number;
    }>;
    bestSegment: {
      label: string;
      startItem: number;
      endItem: number;
      revenue: number;
      profit: number;
      count: number;
    } | null;
    worstSegment: {
      label: string;
      startItem: number;
      endItem: number;
      revenue: number;
      profit: number;
      count: number;
    } | null;
  };
  itemPerformance?: {
    topItems: Array<{
      itemId: string;
      itemNumber: number;
      name: string;
      thumbnail: string | null;
      soldPrice: number;
      costBasis: number;
      fees: number;
      netProfit: number;
      roi: number;
      holdTimeDays: number | null;
    }>;
    bottomItems: Array<{
      itemId: string;
      itemNumber: number;
      name: string;
      thumbnail: string | null;
      soldPrice: number;
      costBasis: number;
      fees: number;
      netProfit: number;
      roi: number;
      holdTimeDays: number | null;
    }>;
    medianProfit: number;
    paretoPercent: number;
    avgHoldTime: number | null;
  };
  costAnalysis?: {
    totalExpenses: number;
    expensesPercent: number;
    suppliesCost: number;
    suppliesCostPerItem: number;
    payrollCost: number;
    payrollCostPerItem: number;
    profitBeforeExpenses: number;
  };
  breakAnalytics?: Array<{
    id: string;
    title: string;
    breakStyle: string;
    breakType: string;
    boxCost: number;
    spotCount: number;
    spotType: string | null;
    revenue: number;
    fees: number;
    taxes: number;
    netProfit: number;
    profitPerSpot: number;
    spotsSold: number;
    spotSellThrough: number;
    avgSpotPrice: number;
  }>;
  buyerSignals?: {
    uniqueBuyerCount: number;
    avgSpendPerBuyer: number;
    topBuyer: string | null;
    topBuyerRevenue: number;
    topBuyerPercent: number;
  };
  comparisonBadges?: string[];
}

interface SessionReportContentProps {
  sessionId: string;
  sessionStatus: string;
}

export function SessionReportContent({ sessionId }: SessionReportContentProps) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/report`);
        if (!response.ok) {
          throw new Error('Failed to fetch report');
        }
        const data = await response.json();
        setReportData(data);
      } catch (err) {
        console.error('Error fetching report:', err);
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [sessionId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="container max-w-4xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error || 'Failed to load report'}</p>
            <Button asChild className="mt-4">
              <Link href={`/sessions/${sessionId}`}>Back to Session</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not reconciled, show empty state
  if (!reportData.reconciled) {
    return (
      <div className="container max-w-4xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Report Not Available
            </CardTitle>
            <CardDescription>
              {reportData.message || 'This session must be reconciled before generating a report'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Complete the post-show reconciliation process to generate analytics.
            </p>
            <Button asChild>
              <Link href={`/sessions/${sessionId}`}>Go to Session</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { session, kpis, breakevenComparison, runOrderPerformance, itemPerformance, costAnalysis, breakAnalytics, buyerSignals, comparisonBadges } = reportData;

  return (
    <div className="container max-w-[1600px] mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/sessions/${sessionId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{session?.title}</h1>
              <Badge className="bg-success-subtle text-success-subtle">Reconciled</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {session?.date && formatDate(session.date)} • {session?.platform}
            </p>
            {comparisonBadges && comparisonBadges.length > 0 && (
              <div className="flex gap-2 mt-2">
                {comparisonBadges.map((badge, idx) => (
                  <Badge key={idx} variant="outline" className="border-success-subtle text-success-subtle">
                    <Award className="h-3 w-3 mr-1" />
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Quick Stats Chips */}
      {kpis && (
        <div className="flex flex-wrap gap-4">
          <Badge variant="outline" className="px-4 py-2 text-base">
            <Package className="h-4 w-4 mr-2" />
            {kpis.itemsRun} Items Run
          </Badge>
          <Badge variant="outline" className="px-4 py-2 text-base">
            <Target className="h-4 w-4 mr-2" />
            {kpis.itemsSold} Sold
          </Badge>
          <Badge variant="outline" className="px-4 py-2 text-base">
            <TrendingUp className="h-4 w-4 mr-2" />
            {formatPercent(kpis.sellThrough)} Sell-through
          </Badge>
        </div>
      )}

      {/* Core KPIs */}
      {kpis && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gross Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpis.grossRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(kpis.avgRevenuePerCard)} avg per card
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(kpis.netProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(kpis.avgProfitPerCard)} avg per card
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profit Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpis.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(kpis.profitMargin)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.profitMargin > 20 ? 'Excellent' : kpis.profitMargin > 10 ? 'Good' : 'Fair'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(kpis.totalCOGS + kpis.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                COGS: {formatCurrency(kpis.totalCOGS)} • Expenses: {formatCurrency(kpis.totalExpenses)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pre-show vs Actual */}
      {breakevenComparison && (
        <Card>
          <CardHeader>
            <CardTitle>Pre-show vs Actual</CardTitle>
            <CardDescription>Breakeven accuracy and profit target performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Planned Breakeven</p>
                <p className="text-lg font-semibold">{formatCurrency(breakevenComparison.plannedBreakeven)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actual Revenue</p>
                <p className="text-lg font-semibold">{formatCurrency(breakevenComparison.actualRevenue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Over/Under</p>
                <p className={`text-lg font-semibold ${breakevenComparison.overUnder >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {breakevenComparison.overUnder >= 0 ? '+' : ''}{formatCurrency(breakevenComparison.overUnder)}
                  {' '}({formatPercent(breakevenComparison.overUnderPercent)})
                </p>
              </div>
            </div>
            {breakevenComparison.plannedProfitTarget !== null && (
              <div className="grid gap-4 md:grid-cols-2 mt-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Planned Profit Target</p>
                  <p className="text-lg font-semibold">{formatCurrency(breakevenComparison.plannedProfitTarget)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Actual Profit</p>
                  <p className={`text-lg font-semibold ${breakevenComparison.actualProfit >= breakevenComparison.plannedProfitTarget ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatCurrency(breakevenComparison.actualProfit)}
                    {breakevenComparison.profitDiff !== null && (
                      <span className="text-sm ml-2">
                        ({breakevenComparison.profitDiff >= 0 ? '+' : ''}{formatCurrency(breakevenComparison.profitDiff)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Run Order Performance */}
      {runOrderPerformance && runOrderPerformance.segments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Run Order Performance</CardTitle>
            <CardDescription>Revenue and profit by position segment</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Items Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Avg Profit/Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runOrderPerformance.segments.map((segment, idx) => {
                  const avgProfit = segment.count > 0 ? segment.profit / segment.count : 0;
                  const isBest = runOrderPerformance.bestSegment?.label === segment.label;
                  const isWorst = runOrderPerformance.worstSegment?.label === segment.label;

                  return (
                    <TableRow key={idx} className={isBest ? 'bg-success-subtle' : isWorst ? 'bg-danger-subtle' : ''}>
                      <TableCell className="font-medium">
                        {segment.label}
                        {isBest && <Badge variant="outline" className="ml-2 border-success-subtle text-success-subtle">Best</Badge>}
                        {isWorst && <Badge variant="outline" className="ml-2 border-danger-subtle text-danger-subtle">Worst</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{segment.count}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(segment.revenue)}</TableCell>
                      <TableCell className={`text-right font-medium ${segment.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(segment.profit)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(avgProfit)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Item Performance */}
      {itemPerformance && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Top 5 Items by Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {itemPerformance.topItems.map((item, idx) => (
                  <div key={item.itemId} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold text-muted-foreground w-6">#{idx + 1}</div>
                    {item.thumbnail && (
                      <div className="relative h-12 w-12 rounded overflow-hidden bg-muted">
                        <Image
                          src={item.thumbnail}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        #{item.itemNumber} {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sold: {formatCurrency(item.soldPrice)} • Cost: {formatCurrency(item.costBasis)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(item.netProfit)}</p>
                      <p className="text-xs text-muted-foreground">{formatPercent(item.roi)} ROI</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Median Profit per Item</span>
                  <span className="font-medium">{formatCurrency(itemPerformance.medianProfit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Top 20% Contributed</span>
                  <span className="font-medium">{formatPercent(itemPerformance.paretoPercent)} of profit</span>
                </div>
                {itemPerformance.avgHoldTime !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Avg Hold Time
                    </span>
                    <span className="font-medium">{Math.round(itemPerformance.avgHoldTime)} days</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bottom Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Bottom 5 Items by Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {itemPerformance.bottomItems.map((item, idx) => (
                  <div key={item.itemId} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold text-muted-foreground w-6">#{idx + 1}</div>
                    {item.thumbnail && (
                      <div className="relative h-12 w-12 rounded overflow-hidden bg-muted">
                        <Image
                          src={item.thumbnail}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        #{item.itemNumber} {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sold: {formatCurrency(item.soldPrice)} • Cost: {formatCurrency(item.costBasis)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${item.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.netProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatPercent(item.roi)} ROI</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cost & Leakage */}
      {costAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Analysis & Expense Impact</CardTitle>
            <CardDescription>How expenses affected profitability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Expenses as % of Revenue</p>
                <p className="text-lg font-semibold">{formatPercent(costAnalysis.expensesPercent)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supplies Cost per Item</p>
                <p className="text-lg font-semibold">{formatCurrency(costAnalysis.suppliesCostPerItem)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payroll Cost per Item</p>
                <p className="text-lg font-semibold">{formatCurrency(costAnalysis.payrollCostPerItem)}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Profit Before Expenses</span>
                <span className="font-semibold">{formatCurrency(costAnalysis.profitBeforeExpenses)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-muted-foreground">Total Expenses</span>
                <span className="font-semibold text-red-600">-{formatCurrency(costAnalysis.totalExpenses)}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t">
                <span className="text-sm font-medium">Net Profit After Expenses</span>
                <span className={`font-bold ${kpis && kpis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis && formatCurrency(kpis.netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Break Analytics */}
      {breakAnalytics && breakAnalytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Break Performance</CardTitle>
            <CardDescription>Revenue and profit by break</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Break</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead className="text-right">Box Cost</TableHead>
                  <TableHead className="text-right">Spots Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                  <TableHead className="text-right">Profit/Spot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakAnalytics.map((br) => (
                  <TableRow key={br.id}>
                    <TableCell className="font-medium">{br.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{br.breakStyle.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(br.boxCost)}</TableCell>
                    <TableCell className="text-right">
                      {br.spotsSold}/{br.spotCount}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({formatPercent(br.spotSellThrough)})
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(br.revenue)}</TableCell>
                    <TableCell className={`text-right font-medium ${br.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(br.netProfit)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(br.profitPerSpot)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Buyer Signals */}
      {buyerSignals && buyerSignals.uniqueBuyerCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Buyer Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Unique Buyers</p>
                <p className="text-lg font-semibold">{buyerSignals.uniqueBuyerCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Spend per Buyer</p>
                <p className="text-lg font-semibold">{formatCurrency(buyerSignals.avgSpendPerBuyer)}</p>
              </div>
              {buyerSignals.topBuyer && (
                <div>
                  <p className="text-sm text-muted-foreground">Top Buyer</p>
                  <p className="text-lg font-semibold">{buyerSignals.topBuyer}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(buyerSignals.topBuyerRevenue)} ({formatPercent(buyerSignals.topBuyerPercent)} of revenue)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
