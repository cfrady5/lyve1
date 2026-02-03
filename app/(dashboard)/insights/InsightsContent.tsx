'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Download,
} from 'lucide-react';

interface PriceRangeBucket {
  label: string;
  sampleSize: number;
  grossRevenue: number;
  netProfit: number;
  avgProfit: number;
  medianProfit: number;
  avgROI: number;
}

interface PlatformPerformance {
  platform: string;
  sessionCount: number;
  itemsSold: number;
  grossRevenue: number;
  netProfit: number;
  avgSessionProfit: number;
  avgSellThrough: number;
}

interface ShowTypePerformance {
  showType: string;
  sessionCount: number;
  itemsSold: number;
  grossRevenue: number;
  netProfit: number;
  avgSessionProfit: number;
}

interface SessionFeeBurden {
  sessionId: string;
  sessionTitle: string;
  feeBurden: number;
  sessionRevenue: number;
  sessionFees: number;
}

interface SessionExpenseBurden {
  sessionId: string;
  sessionTitle: string;
  expenseBurden: number;
  sessionRevenue: number;
  sessionExpenses: number;
}

interface PlayerStats {
  playerName: string;
  cardsSold: number;
  totalRevenue: number;
  totalProfit: number;
  avgProfit: number;
  medianProfit: number;
}

interface InsightsData {
  sellerProfile: {
    totalSessionsReconciled: number;
    totalItemsRun: number;
    totalItemsSold: number;
    sellThroughRate: number;
    grossRevenue: number;
    netProfit: number;
    profitMargin: number;
    avgRevenuePerSoldItem: number;
    avgProfitPerSoldItem: number;
    medianProfitPerSoldItem: number;
    totalFees: number;
    totalTaxes: number;
    totalShipping: number;
    totalCOGS: number;
    totalSessionExpenses: number;
    avgSessionProfit: number;
    bestSessionProfit: number;
    worstSessionProfit: number;
    avgHoldTimeDays: number;
    medianHoldTimeDays: number;
  };
  breakdowns: {
    priceRanges: {
      all: PriceRangeBucket[];
      top: PriceRangeBucket[];
      bottom: PriceRangeBucket[];
    };
    platforms: PlatformPerformance[];
    showTypes: ShowTypePerformance[];
  };
  profitLeaks: {
    lowestProfitPriceBuckets: PriceRangeBucket[];
    highestFeeBurdenSessions: SessionFeeBurden[];
    highestExpenseBurdenSessions: SessionExpenseBurden[];
  };
  playerLeaderboard: PlayerStats[];
  recommendations: string[];
}

export function InsightsContent() {
  const [loading, setLoading] = useState(true);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [platform, setPlatform] = useState('all');
  const [showType, setShowType] = useState('all');
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [minSampleSize, setMinSampleSize] = useState(5);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        platform,
        showType,
        includeExpenses: includeExpenses.toString(),
        minSampleSize: minSampleSize.toString(),
      });

      console.log('[INSIGHTS] Fetching with params:', Object.fromEntries(params));
      const response = await fetch(`/api/insights?${params}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[INSIGHTS] API error:', response.status, errorText);
        throw new Error('Failed to fetch insights');
      }

      const data = await response.json();
      console.log('[INSIGHTS] Received data:', data);
      setInsightsData(data);
    } catch (error) {
      console.error('[INSIGHTS] Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, platform, showType, includeExpenses, minSampleSize]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

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
          <p className="mt-4 text-muted-foreground">Loading insights...</p>
        </div>
      </div>
    );
  }

  if (!insightsData) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Failed to load insights data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { sellerProfile, breakdowns, profitLeaks, playerLeaderboard, recommendations } = insightsData;

  // Check if there are no reconciled sessions
  if (sellerProfile.totalSessionsReconciled === 0) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>No Reconciled Sessions Found</CardTitle>
            <CardDescription>
              No reconciled sessions match your current filters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              To see insights, you need at least one session with status RECONCILED in your selected date range.
            </p>
            <div className="space-y-2 text-sm">
              <p><strong>Current filters:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Date range: {dateFrom} to {dateTo}</li>
                <li>Platform: {platform === 'all' ? 'All platforms' : platform}</li>
                <li>Show type: {showType === 'all' ? 'All types' : showType}</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const date = new Date();
                  date.setFullYear(date.getFullYear() - 1);
                  setDateFrom(date.toISOString().split('T')[0]);
                  setDateTo(new Date().toISOString().split('T')[0]);
                  setPlatform('all');
                  setShowType('all');
                }}
              >
                Expand to Last Year
              </Button>
              <Button variant="outline" asChild>
                <a href="/sessions">Go to Sessions</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-[1800px] mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Insights</h1>
          <p className="text-muted-foreground">
            Profitability analysis across {sellerProfile.totalSessionsReconciled} reconciled sessions
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Reconciled From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Reconciled To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="whatnot">Whatnot</SelectItem>
                  <SelectItem value="ebay">eBay</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="show">Show/Event</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="showType">Session Type</Label>
              <Select value={showType} onValueChange={setShowType}>
                <SelectTrigger id="showType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="singles_only">Singles Only</SelectItem>
                  <SelectItem value="breaks_only">Breaks Only</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="includeExpenses"
                checked={includeExpenses}
                onCheckedChange={setIncludeExpenses}
              />
              <Label htmlFor="includeExpenses">Include Expenses</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minSampleSize">Min Sample Size</Label>
              <Input
                id="minSampleSize"
                type="number"
                min="1"
                value={minSampleSize}
                onChange={(e) => setMinSampleSize(parseInt(e.target.value) || 5)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seller Profile KPIs */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Seller Profile</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sellerProfile.totalSessionsReconciled}</div>
              <p className="text-xs text-muted-foreground mt-1">Reconciled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gross Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(sellerProfile.grossRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(sellerProfile.avgRevenuePerSoldItem)} avg per item
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
              <div className={`text-2xl font-bold ${sellerProfile.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(sellerProfile.netProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatPercent(sellerProfile.profitMargin)} margin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sell-Through Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercent(sellerProfile.sellThroughRate)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {sellerProfile.totalItemsSold} of {sellerProfile.totalItemsRun} items
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Profit per Item
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(sellerProfile.avgProfitPerSoldItem)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Median: {formatCurrency(sellerProfile.medianProfitPerSoldItem)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Session Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(sellerProfile.avgSessionProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Best: {formatCurrency(sellerProfile.bestSessionProfit)}
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
                {formatCurrency(sellerProfile.totalCOGS + sellerProfile.totalSessionExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                COGS: {formatCurrency(sellerProfile.totalCOGS)} • Expenses: {formatCurrency(sellerProfile.totalSessionExpenses)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Fees & Taxes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(sellerProfile.totalFees + sellerProfile.totalTaxes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatPercent((sellerProfile.totalFees + sellerProfile.totalTaxes) / sellerProfile.grossRevenue * 100)} of revenue
              </p>
            </CardContent>
          </Card>
        </div>

        {sellerProfile.avgHoldTimeDays !== null && (
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Hold Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(sellerProfile.avgHoldTimeDays)} days
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Median: {sellerProfile.medianHoldTimeDays} days
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Profit Drivers */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Profit Drivers
        </h2>

        {/* Top Price Ranges */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Top Performing Price Ranges</CardTitle>
            <CardDescription>Most profitable price buckets by net profit</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Price Range</TableHead>
                  <TableHead className="text-right">Sample Size</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                  <TableHead className="text-right">Avg Profit</TableHead>
                  <TableHead className="text-right">Median Profit</TableHead>
                  <TableHead className="text-right">Avg ROI%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdowns.priceRanges.top.map((range: PriceRangeBucket, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{range.label}</TableCell>
                    <TableCell className="text-right">{range.sampleSize}</TableCell>
                    <TableCell className="text-right">{formatCurrency(range.grossRevenue)}</TableCell>
                    <TableCell className="text-right text-success-subtle font-medium">
                      {formatCurrency(range.netProfit)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(range.avgProfit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(range.medianProfit)}</TableCell>
                    <TableCell className="text-right">{formatPercent(range.avgROI)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Platform & Show Type Performance */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Platform Performance</CardTitle>
              <CardDescription>Profitability by platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Avg/Session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdowns.platforms.map((platform: PlatformPerformance, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium capitalize">{platform.platform}</TableCell>
                      <TableCell className="text-right">{platform.sessionCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(platform.netProfit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(platform.avgSessionProfit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Show Type Performance</CardTitle>
              <CardDescription>Profitability by stream format</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Avg/Session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdowns.showTypes.map((showType: ShowTypePerformance, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium capitalize">
                        {showType.showType.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="text-right">{showType.sessionCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(showType.netProfit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(showType.avgSessionProfit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Player Leaderboard */}
      {playerLeaderboard && playerLeaderboard.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Top Players by Profit
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Most Profitable Players</CardTitle>
              <CardDescription>Players generating the most total profit across all sales</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Cards Sold</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Total Profit</TableHead>
                    <TableHead className="text-right">Avg Profit</TableHead>
                    <TableHead className="text-right">Median Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playerLeaderboard.map((player: PlayerStats, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-bold">#{idx + 1}</TableCell>
                      <TableCell className="font-medium">{player.playerName}</TableCell>
                      <TableCell className="text-right">{player.cardsSold}</TableCell>
                      <TableCell className="text-right">{formatCurrency(player.totalRevenue)}</TableCell>
                      <TableCell className="text-right text-success-subtle font-medium">
                        {formatCurrency(player.totalProfit)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(player.avgProfit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(player.medianProfit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profit Leaks */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-warning-subtle" />
          Profit Leaks
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Lowest Profit Price Ranges */}
          {profitLeaks.lowestProfitPriceBuckets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unprofitable Price Ranges</CardTitle>
                <CardDescription>Negative median profit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profitLeaks.lowestProfitPriceBuckets.map((range: PriceRangeBucket, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-danger-subtle rounded">
                      <span className="font-medium">{range.label}</span>
                      <span className="text-sm text-danger-subtle">
                        {formatCurrency(range.medianProfit)} median
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Highest Fee Burden */}
          {profitLeaks.highestFeeBurdenSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Highest Fee Burden</CardTitle>
                <CardDescription>Top 5 sessions by fee %</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profitLeaks.highestFeeBurdenSessions.slice(0, 5).map((session: SessionFeeBurden, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="truncate max-w-[150px]">{session.sessionTitle}</span>
                      <Badge variant="outline" className="border-warning-subtle text-warning-subtle">
                        {formatPercent(session.feeBurden)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Highest Expense Burden */}
          {profitLeaks.highestExpenseBurdenSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Highest Expense Burden</CardTitle>
                <CardDescription>Top 5 sessions by expense %</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profitLeaks.highestExpenseBurdenSessions.slice(0, 5).map((session: SessionExpenseBurden, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="truncate max-w-[150px]">{session.sessionTitle}</span>
                      <Badge variant="outline" className="border-warning-subtle text-warning-subtle">
                        {formatPercent(session.expenseBurden)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bottom Price Ranges */}
        {breakdowns.priceRanges.bottom.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Lowest Performing Price Ranges</CardTitle>
              <CardDescription>Least profitable price buckets</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Price Range</TableHead>
                    <TableHead className="text-right">Sample Size</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Avg Profit</TableHead>
                    <TableHead className="text-right">Median Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdowns.priceRanges.bottom.map((range: PriceRangeBucket, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{range.label}</TableCell>
                      <TableCell className="text-right">{range.sampleSize}</TableCell>
                      <TableCell className="text-right text-danger-subtle">
                        {formatCurrency(range.netProfit)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(range.avgProfit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(range.medianProfit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Recommendations
            </CardTitle>
            <CardDescription>Data-driven insights to improve profitability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-info-subtle rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
