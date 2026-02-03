import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse filters from query params
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const platform = searchParams.get('platform');
    const showType = searchParams.get('showType');
    const includeExpenses = searchParams.get('includeExpenses') !== 'false';
    const minSampleSize = parseInt(searchParams.get('minSampleSize') || '5');

    // Build date filter (default to last 30 days)
    const defaultDateFrom = new Date();
    defaultDateFrom.setDate(defaultDateFrom.getDate() - 30);
    defaultDateFrom.setHours(0, 0, 0, 0); // Start of day

    const defaultDateTo = new Date();
    defaultDateTo.setHours(23, 59, 59, 999); // End of day

    const effectiveDateFrom = dateFrom
      ? new Date(dateFrom + 'T00:00:00.000Z').toISOString()
      : defaultDateFrom.toISOString();
    const effectiveDateTo = dateTo
      ? new Date(dateTo + 'T23:59:59.999Z').toISOString()
      : defaultDateTo.toISOString();

    console.log('[INSIGHTS_API] Date filter:', { effectiveDateFrom, effectiveDateTo, dateFrom, dateTo });

    // First, let's see ALL reconciled sessions for this user (for debugging)
    const { data: allReconciledSessions } = await supabase
      .from('sessions')
      .select('id, name, status, reconciled_at')
      .eq('user_id', user.id)
      .eq('status', 'RECONCILED');

    console.log('[INSIGHTS_API] All reconciled sessions:', allReconciledSessions);

    // Fetch reconciled sessions with filters
    // Use reconciled_at for date filtering since we want to see when sessions were reconciled
    let sessionsQuery = supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'RECONCILED')
      .gte('reconciled_at', effectiveDateFrom)
      .lte('reconciled_at', effectiveDateTo);

    if (platform && platform !== 'all') {
      sessionsQuery = sessionsQuery.eq('platform', platform);
    }

    if (showType && showType !== 'all') {
      sessionsQuery = sessionsQuery.eq('show_type', showType);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error('[INSIGHTS_API] Session query error:', sessionsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      console.log('[INSIGHTS_API] No sessions found for filters:', {
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
        platform,
        showType,
        status: 'RECONCILED',
      });
      return NextResponse.json({
        sellerProfile: getEmptySellerProfile(),
        breakdowns: getEmptyBreakdowns(),
        playerLeaderboard: [],
        recommendations: [],
      });
    }

    console.log('[INSIGHTS_API] Found sessions:', sessions.length);
    console.log('[INSIGHTS_API] Session IDs:', sessions.map(s => ({ id: s.id, name: s.name, status: s.status, reconciled_at: s.reconciled_at })));

    const sessionIds = sessions.map(s => s.id);

    // Fetch sales for all sessions
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        session_id,
        item_id,
        sold_price,
        fees,
        taxes_collected,
        shipping_cost,
        sold_at,
        buyer_username,
        inventory_items(
          id,
          cost_basis,
          acquired_at,
          player,
          name
        )
      `)
      .in('session_id', sessionIds);

    if (salesError) {
      console.error('[INSIGHTS_API] Sales query error:', salesError);
    }
    const sales = salesData || [];
    console.log('[INSIGHTS_API] Found sales:', sales.length);

    // Fetch session items
    const { data: sessionItemsData, error: sessionItemsError } = await supabase
      .from('session_items')
      .select('session_id, item_id, item_number')
      .in('session_id', sessionIds);

    if (sessionItemsError) {
      console.error('[INSIGHTS_API] Session items query error:', sessionItemsError);
    }
    const sessionItems = sessionItemsData || [];
    console.log('[INSIGHTS_API] Found session items:', sessionItems.length);

    // Fetch expenses if included
    let expenses: unknown[] = [];
    if (includeExpenses) {
      const { data: expensesData } = await supabase
        .from('session_expenses')
        .select('*')
        .in('session_id', sessionIds);
      expenses = expensesData || [];
    }

    // =====================
    // COMPUTE SELLER PROFILE
    // =====================

    const totalSessionsReconciled = sessions.length;
    const totalItemsRun = sessionItems.length;
    const totalItemsSold = sales.length;
    const sellThroughRate = totalItemsRun > 0 ? (totalItemsSold / totalItemsRun) * 100 : 0;

    // Calculate totals using same formula as lyve report
    const grossRevenue = sales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
    const totalFees = sales.reduce((sum, s) => sum + (s.fees || 0), 0);
    const totalTaxes = sales.reduce((sum, s) => sum + (s.taxes_collected || 0), 0);
    const totalShipping = sales.reduce((sum, s) => sum + (s.shipping_cost || 0), 0);

    const totalCOGS = sales.reduce((sum, s) => {
      const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
      return sum + (item?.cost_basis || 0);
    }, 0);

    const totalSessionExpenses = (expenses as Array<{ amount?: number }>).reduce((sum, e) => sum + (e.amount || 0), 0);

    // Net profit calculation matching lyve report formula
    const netProfit = grossRevenue - totalFees - totalTaxes - totalShipping - totalCOGS - totalSessionExpenses;

    // For per-item calculations, still compute individual item profits
    const itemProfits = sales.map(s => {
      const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
      return (s.sold_price || 0) - (s.fees || 0) - (s.taxes_collected || 0) -
             (s.shipping_cost || 0) - (item?.cost_basis || 0);
    });

    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const avgRevenuePerSoldItem = totalItemsSold > 0 ? grossRevenue / totalItemsSold : 0;
    const avgProfitPerSoldItem = totalItemsSold > 0 ? netProfit / totalItemsSold : 0;

    const sortedProfits = [...itemProfits].sort((a, b) => a - b);
    const medianProfitPerSoldItem = sortedProfits.length > 0
      ? sortedProfits[Math.floor(sortedProfits.length / 2)]
      : 0;

    // Compute session-level profits
    const sessionProfits = sessions.map(session => {
      const sessionSales = sales.filter(s => s.session_id === session.id);
      const sessionExpenseTotal = (expenses as Array<{ session_id?: string; amount?: number }>)
        .filter(e => e.session_id === session.id)
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const sessionItemProfit = sessionSales.reduce((sum, s) => {
        const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
        return sum + ((s.sold_price || 0) - (s.fees || 0) - (s.taxes_collected || 0) -
                      (s.shipping_cost || 0) - (item?.cost_basis || 0));
      }, 0);

      return sessionItemProfit - sessionExpenseTotal;
    });

    const avgSessionProfit = sessionProfits.length > 0
      ? sessionProfits.reduce((sum, p) => sum + p, 0) / sessionProfits.length
      : 0;
    const bestSessionProfit = sessionProfits.length > 0 ? Math.max(...sessionProfits) : 0;
    const worstSessionProfit = sessionProfits.length > 0 ? Math.min(...sessionProfits) : 0;

    // Hold time analysis
    const itemsWithHoldTime = sales.filter(s => {
      const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
      return item?.acquired_at && s.sold_at;
    }).map(s => {
      const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
      const acquiredDate = new Date(item!.acquired_at!);
      const soldDate = new Date(s.sold_at);
      return Math.floor((soldDate.getTime() - acquiredDate.getTime()) / (1000 * 60 * 60 * 24));
    });

    const avgHoldTimeDays = itemsWithHoldTime.length > 0
      ? itemsWithHoldTime.reduce((sum, d) => sum + d, 0) / itemsWithHoldTime.length
      : null;

    const sortedHoldTimes = [...itemsWithHoldTime].sort((a, b) => a - b);
    const medianHoldTimeDays = sortedHoldTimes.length > 0
      ? sortedHoldTimes[Math.floor(sortedHoldTimes.length / 2)]
      : null;

    const sellerProfile = {
      totalSessionsReconciled,
      totalItemsRun,
      totalItemsSold,
      sellThroughRate,
      grossRevenue,
      netProfit,
      profitMargin,
      avgRevenuePerSoldItem,
      avgProfitPerSoldItem,
      medianProfitPerSoldItem,
      totalFees,
      totalTaxes,
      totalShipping,
      totalCOGS,
      totalSessionExpenses,
      avgSessionProfit,
      bestSessionProfit,
      worstSessionProfit,
      avgHoldTimeDays,
      medianHoldTimeDays,
    };

    // =====================
    // DIMENSIONAL BREAKDOWNS
    // =====================

    // 1. Sold Price Ranges
    const priceRanges = [
      { min: 0, max: 5, label: '$0-$5' },
      { min: 5, max: 10, label: '$5-$10' },
      { min: 10, max: 20, label: '$10-$20' },
      { min: 20, max: 50, label: '$20-$50' },
      { min: 50, max: 100, label: '$50-$100' },
      { min: 100, max: 250, label: '$100-$250' },
      { min: 250, max: Infinity, label: '$250+' },
    ];

    const priceRangeBreakdown = priceRanges.map(range => {
      const rangeSales = sales.filter(s =>
        s.sold_price >= range.min && s.sold_price < range.max
      );

      const rangeRevenue = rangeSales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
      const rangeProfit = rangeSales.reduce((sum, s) => {
        const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
        return sum + ((s.sold_price || 0) - (s.fees || 0) - (s.taxes_collected || 0) -
                      (s.shipping_cost || 0) - (item?.cost_basis || 0));
      }, 0);

      const avgProfit = rangeSales.length > 0 ? rangeProfit / rangeSales.length : 0;

      const profits = rangeSales.map(s => {
        const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
        return (s.sold_price || 0) - (s.fees || 0) - (s.taxes_collected || 0) -
               (s.shipping_cost || 0) - (item?.cost_basis || 0);
      }).sort((a, b) => a - b);

      const medianProfit = profits.length > 0 ? profits[Math.floor(profits.length / 2)] : 0;

      const avgROI = rangeSales.length > 0
        ? rangeSales.reduce((sum, s) => {
            const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
            const costBasis = item?.cost_basis || 0;
            if (costBasis === 0) return sum;
            const profit = (s.sold_price || 0) - (s.fees || 0) - (s.taxes_collected || 0) -
                          (s.shipping_cost || 0) - costBasis;
            return sum + (profit / costBasis) * 100;
          }, 0) / rangeSales.length
        : 0;

      return {
        label: range.label,
        sampleSize: rangeSales.length,
        grossRevenue: rangeRevenue,
        netProfit: rangeProfit,
        avgProfit,
        medianProfit,
        avgROI,
      };
    }).filter(r => r.sampleSize >= minSampleSize);

    // Sort by net profit for top/bottom
    const sortedByProfit = [...priceRangeBreakdown].sort((a, b) => b.netProfit - a.netProfit);
    const topPriceRanges = sortedByProfit.slice(0, 5);
    const bottomPriceRanges = sortedByProfit.slice(-5).reverse();

    // 2. Platform Breakdown
    interface PlatformData {
      sessions: { id: string }[];
      sales: unknown[];
      expenses: unknown[];
    }

    const platformBreakdown = sessions.reduce((acc, session) => {
      const platform = session.platform;
      if (!acc[platform]) {
        acc[platform] = {
          sessions: [],
          sales: [],
          expenses: [],
        };
      }
      acc[platform].sessions.push(session);
      return acc;
    }, {} as Record<string, PlatformData>);

    const platformMetrics = Object.entries(platformBreakdown).map(([platform, data]) => {
      const platformData = data as PlatformData;
      const sessionIds = platformData.sessions.map(s => s.id);
      const platformSales = sales.filter(s => sessionIds.includes(s.session_id));
      const platformExpenses = (expenses as Array<{ session_id?: string; amount?: number }>).filter(e => sessionIds.includes(e.session_id || ''));

      const revenue = platformSales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
      const profit = platformSales.reduce((sum, s) => {
        const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
        return sum + ((s.sold_price || 0) - (s.fees || 0) - (s.taxes_collected || 0) -
                      (s.shipping_cost || 0) - (item?.cost_basis || 0));
      }, 0) - platformExpenses.reduce((sum, e: { amount?: number }) => sum + (e.amount || 0), 0);

      const avgSessionProfit = platformData.sessions.length > 0 ? profit / platformData.sessions.length : 0;
      const avgSellThrough = platformData.sessions.reduce((sum: number, s: { id: string }) => {
        const sItems = sessionItems.filter(si => si.session_id === s.id);
        const sSales = platformSales.filter(ps => ps.session_id === s.id);
        return sum + (sItems.length > 0 ? (sSales.length / sItems.length) * 100 : 0);
      }, 0) / (platformData.sessions.length || 1);

      return {
        platform,
        sessionCount: platformData.sessions.length,
        itemsSold: platformSales.length,
        grossRevenue: revenue,
        netProfit: profit,
        avgSessionProfit,
        avgSellThrough,
      };
    }).filter(m => m.sessionCount >= Math.min(minSampleSize, 3));

    // 3. Show Type Breakdown
    interface ShowTypeData {
      sessions: { id: string }[];
    }

    const showTypeBreakdown = sessions.reduce((acc, session) => {
      const showType = session.show_type || 'singles_only';
      if (!acc[showType]) {
        acc[showType] = {
          sessions: [],
        };
      }
      acc[showType].sessions.push(session);
      return acc;
    }, {} as Record<string, ShowTypeData>);

    const showTypeMetrics = Object.entries(showTypeBreakdown).map(([showType, data]) => {
      const showTypeData = data as ShowTypeData;
      const sessionIds = showTypeData.sessions.map(s => s.id);
      const showTypeSales = sales.filter(s => sessionIds.includes(s.session_id));
      const showTypeExpenses = (expenses as Array<{ session_id?: string; amount?: number }>).filter(e => sessionIds.includes(e.session_id || ''));

      const revenue = showTypeSales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
      const profit = showTypeSales.reduce((sum, s) => {
        const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
        return sum + ((s.sold_price || 0) - (s.fees || 0) - (s.taxes_collected || 0) -
                      (s.shipping_cost || 0) - (item?.cost_basis || 0));
      }, 0) - showTypeExpenses.reduce((sum, e: { amount?: number }) => sum + (e.amount || 0), 0);

      const avgSessionProfit = showTypeData.sessions.length > 0 ? profit / showTypeData.sessions.length : 0;

      return {
        showType,
        sessionCount: showTypeData.sessions.length,
        itemsSold: showTypeSales.length,
        grossRevenue: revenue,
        netProfit: profit,
        avgSessionProfit,
      };
    }).filter(m => m.sessionCount >= Math.min(minSampleSize, 3));

    // =====================
    // PROFIT LEAKS
    // =====================

    // Lowest profit price buckets
    const lowestProfitPriceBuckets = bottomPriceRanges.filter(r => r.medianProfit < 0);

    // Highest fee burden sessions
    const sessionsWithFeeBurden = sessions.map(session => {
      const sessionSales = sales.filter(s => s.session_id === session.id);
      const sessionRevenue = sessionSales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
      const sessionFees = sessionSales.reduce((sum, s) => sum + (s.fees || 0) + (s.taxes_collected || 0), 0);
      const feeBurden = sessionRevenue > 0 ? (sessionFees / sessionRevenue) * 100 : 0;

      return {
        sessionId: session.id,
        sessionTitle: session.title || session.name,
        feeBurden,
        sessionRevenue,
        sessionFees,
      };
    }).sort((a, b) => b.feeBurden - a.feeBurden).slice(0, 5);

    // Highest expense burden sessions
    const sessionsWithExpenseBurden = sessions.map(session => {
      const sessionSales = sales.filter(s => s.session_id === session.id);
      const sessionRevenue = sessionSales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
      const sessionExpenseTotal = (expenses as Array<{ session_id?: string; amount?: number }>)
        .filter(e => e.session_id === session.id)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const expenseBurden = sessionRevenue > 0 ? (sessionExpenseTotal / sessionRevenue) * 100 : 0;

      return {
        sessionId: session.id,
        sessionTitle: session.title || session.name,
        expenseBurden,
        sessionRevenue,
        sessionExpenses: sessionExpenseTotal,
      };
    }).sort((a, b) => b.expenseBurden - a.expenseBurden).slice(0, 5);

    // =====================
    // RECOMMENDATIONS
    // =====================

    const recommendations: string[] = [];

    // Best price range
    if (topPriceRanges.length > 0) {
      const best = topPriceRanges[0];
      recommendations.push(
        `Focus on ${best.label} singles. Highest avg profit ($${best.avgProfit.toFixed(2)}) with ${best.sampleSize} items sold.`
      );
    }

    // Avoid low-profit ranges
    if (lowestProfitPriceBuckets.length > 0 && lowestProfitPriceBuckets[0].medianProfit < 0) {
      const worst = lowestProfitPriceBuckets[0];
      recommendations.push(
        `Avoid ${worst.label} singles unless used as add-ons. Negative median profit ($${worst.medianProfit.toFixed(2)}) after fees.`
      );
    }

    // Best show type
    if (showTypeMetrics.length > 1) {
      const bestShowType = showTypeMetrics.sort((a, b) => b.avgSessionProfit - a.avgSessionProfit)[0];
      recommendations.push(
        `${bestShowType.showType.replace('_', ' ')} sessions perform best with $${bestShowType.avgSessionProfit.toFixed(2)} avg profit per session.`
      );
    }

    // Sell-through rate
    if (sellThroughRate < 70) {
      recommendations.push(
        `Your sell-through rate is ${sellThroughRate.toFixed(1)}%. Consider reducing inventory or adjusting pricing.`
      );
    }

    // Expense burden
    if (totalSessionExpenses > 0 && (totalSessionExpenses / grossRevenue) > 0.15) {
      const expensePercent = (totalSessionExpenses / grossRevenue) * 100;
      recommendations.push(
        `Expenses are ${expensePercent.toFixed(1)}% of revenue. Review logistics and supplies costs.`
      );
    }

    // =====================
    // PLAYER LEADERBOARD
    // =====================

    // Group sales by player name
    interface PlayerStats {
      playerName: string;
      cardsSold: number;
      totalRevenue: number;
      totalProfit: number;
      avgProfit: number;
      medianProfit: number;
    }

    const playerStats = sales.reduce((acc, sale) => {
      const item = Array.isArray(sale.inventory_items) ? sale.inventory_items[0] : sale.inventory_items;
      const playerName = item?.player || item?.name || 'Unknown';

      // Calculate profit for this sale
      const profit = (sale.sold_price || 0) - (sale.fees || 0) - (sale.taxes_collected || 0) -
                    (sale.shipping_cost || 0) - (item?.cost_basis || 0);
      const revenue = sale.sold_price || 0;

      if (!acc[playerName]) {
        acc[playerName] = {
          playerName,
          cardsSold: 0,
          totalRevenue: 0,
          totalProfit: 0,
          profits: [],
        };
      }

      acc[playerName].cardsSold++;
      acc[playerName].totalRevenue += revenue;
      acc[playerName].totalProfit += profit;
      acc[playerName].profits.push(profit);

      return acc;
    }, {} as Record<string, {
      playerName: string;
      cardsSold: number;
      totalRevenue: number;
      totalProfit: number;
      profits: number[];
    }>);

    const playerLeaderboard: PlayerStats[] = Object.values(playerStats)
      .map(player => {
        const sortedProfits = [...player.profits].sort((a, b) => a - b);
        const medianProfit = sortedProfits.length > 0
          ? sortedProfits[Math.floor(sortedProfits.length / 2)]
          : 0;
        const avgProfit = player.cardsSold > 0 ? player.totalProfit / player.cardsSold : 0;

        return {
          playerName: player.playerName,
          cardsSold: player.cardsSold,
          totalRevenue: player.totalRevenue,
          totalProfit: player.totalProfit,
          avgProfit,
          medianProfit,
        };
      })
      .filter(p => p.cardsSold >= Math.min(minSampleSize, 3) && p.playerName !== 'Unknown')
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 10); // Top 10 players

    // Return aggregated data
    return NextResponse.json({
      sellerProfile,
      breakdowns: {
        priceRanges: {
          all: priceRangeBreakdown,
          top: topPriceRanges,
          bottom: bottomPriceRanges,
        },
        platforms: platformMetrics.sort((a, b) => b.netProfit - a.netProfit),
        showTypes: showTypeMetrics.sort((a, b) => b.avgSessionProfit - a.avgSessionProfit),
      },
      profitLeaks: {
        lowestProfitPriceBuckets,
        highestFeeBurdenSessions: sessionsWithFeeBurden,
        highestExpenseBurdenSessions: sessionsWithExpenseBurden,
      },
      playerLeaderboard,
      recommendations,
    });
  } catch (error) {
    console.error('[INSIGHTS_API] Error generating insights:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}

function getEmptySellerProfile() {
  return {
    totalSessionsReconciled: 0,
    totalItemsRun: 0,
    totalItemsSold: 0,
    sellThroughRate: 0,
    grossRevenue: 0,
    netProfit: 0,
    profitMargin: 0,
    avgRevenuePerSoldItem: 0,
    avgProfitPerSoldItem: 0,
    medianProfitPerSoldItem: 0,
    totalFees: 0,
    totalTaxes: 0,
    totalShipping: 0,
    totalCOGS: 0,
    totalSessionExpenses: 0,
    avgSessionProfit: 0,
    bestSessionProfit: 0,
    worstSessionProfit: 0,
    avgHoldTimeDays: null,
    medianHoldTimeDays: null,
  };
}

function getEmptyBreakdowns() {
  return {
    priceRanges: { all: [], top: [], bottom: [] },
    platforms: [],
    showTypes: [],
  };
}
