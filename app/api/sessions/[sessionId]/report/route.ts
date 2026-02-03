import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // If not reconciled, return early with status
    if (session.status !== 'RECONCILED') {
      return NextResponse.json({
        sessionId,
        status: session.status,
        reconciled: false,
        message: 'Session must be reconciled to generate report',
      });
    }

    // Fetch session items with inventory details
    const { data: sessionItems } = await supabase
      .from('session_items')
      .select(`
        id,
        item_number,
        position,
        inventory_items!inner(
          id,
          name,
          display_name,
          cost_basis,
          image_url,
          photo_url,
          acquired_at
        )
      `)
      .eq('session_id', sessionId)
      .order('position');

    // Fetch sales for this session
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id,
        item_id,
        sold_price,
        fees,
        taxes_collected,
        shipping_cost,
        buyer_username,
        sold_at,
        inventory_items!inner(
          id,
          cost_basis,
          name,
          display_name,
          image_url,
          photo_url,
          acquired_at
        )
      `)
      .eq('session_id', sessionId);

    // Fetch expenses
    const { data: expensesData } = await supabase
      .from('session_expenses')
      .select('*')
      .eq('session_id', sessionId);

    // Fetch breaks and break slot sales
    const { data: breaksData } = await supabase
      .from('breaks')
      .select(`
        id,
        title,
        break_style,
        break_type,
        box_cost,
        spot_count,
        spot_type
      `)
      .eq('session_id', sessionId);

    const { data: breakSlotSalesData } = await supabase
      .from('break_slot_sales')
      .select('*')
      .in('break_id', breaksData?.map(b => b.id) || []);

    // =====================
    // COMPUTE METRICS
    // =====================

    const sales = salesData || [];
    const sessionItemsList = sessionItems || [];
    const expenses = expensesData || [];
    const breaks = breaksData || [];
    const breakSlotSales = breakSlotSalesData || [];

    // A) Core KPIs
    const grossRevenue = sales.reduce((sum, s) => sum + (s.sold_price || 0), 0);
    const totalFees = sales.reduce((sum, s) => sum + (s.fees || 0), 0);
    const totalTaxes = sales.reduce((sum, s) => sum + (s.taxes_collected || 0), 0);
    const totalShipping = sales.reduce((sum, s) => sum + (s.shipping_cost || 0), 0);

    const totalCOGS = sales.reduce((sum, s) => {
      const item = Array.isArray(s.inventory_items) ? s.inventory_items[0] : s.inventory_items;
      return sum + (item?.cost_basis || 0);
    }, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const netProfit = grossRevenue - totalFees - totalTaxes - totalShipping - totalCOGS - totalExpenses;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    const itemsRun = sessionItemsList.length;
    const itemsSold = sales.length;
    const sellThrough = itemsRun > 0 ? (itemsSold / itemsRun) * 100 : 0;

    const avgRevenuePerCard = itemsSold > 0 ? grossRevenue / itemsSold : 0;
    const avgProfitPerCard = itemsSold > 0 ? netProfit / itemsSold : 0;

    // B) Pre-show vs Actual
    const plannedBreakevenRevenue = session.metadata?.planned_breakeven_revenue || null;
    const plannedProfitTarget = session.metadata?.planned_profit_target || null;

    let breakevenComparison = null;
    if (plannedBreakevenRevenue !== null) {
      const overUnder = grossRevenue - plannedBreakevenRevenue;
      const overUnderPercent = plannedBreakevenRevenue > 0
        ? (overUnder / plannedBreakevenRevenue) * 100
        : 0;

      breakevenComparison = {
        plannedBreakeven: plannedBreakevenRevenue,
        actualRevenue: grossRevenue,
        overUnder,
        overUnderPercent,
        plannedProfitTarget,
        actualProfit: netProfit,
        profitDiff: plannedProfitTarget !== null ? netProfit - plannedProfitTarget : null,
      };
    }

    // C) Run Order Performance (segment-based)
    const bucketSize = 10;
    const segmentMap = new Map<number, { revenue: number; profit: number; count: number }>();

    // Map sales to item numbers via session_items
    const itemNumberToSales = new Map<number, typeof sales>();
    sales.forEach(sale => {
      const sessionItem = sessionItemsList.find(si => {
        const item = Array.isArray(si.inventory_items) ? si.inventory_items[0] : si.inventory_items;
        return item?.id === sale.item_id;
      });

      if (sessionItem) {
        const existing = itemNumberToSales.get(sessionItem.item_number) || [];
        existing.push(sale);
        itemNumberToSales.set(sessionItem.item_number, existing);
      }
    });

    itemNumberToSales.forEach((itemSales, itemNumber) => {
      const bucketIndex = Math.floor((itemNumber - 1) / bucketSize);
      const existing = segmentMap.get(bucketIndex) || { revenue: 0, profit: 0, count: 0 };

      itemSales.forEach(sale => {
        const item = Array.isArray(sale.inventory_items) ? sale.inventory_items[0] : sale.inventory_items;
        const itemProfit = (sale.sold_price || 0) - (sale.fees || 0) - (sale.taxes_collected || 0) -
                          (sale.shipping_cost || 0) - (item?.cost_basis || 0);

        existing.revenue += sale.sold_price || 0;
        existing.profit += itemProfit;
        existing.count += 1;
      });

      segmentMap.set(bucketIndex, existing);
    });

    const segments = Array.from(segmentMap.entries()).map(([bucketIndex, data]) => {
      const startItem = bucketIndex * bucketSize + 1;
      const endItem = (bucketIndex + 1) * bucketSize;
      return {
        label: `Items ${startItem}-${endItem}`,
        startItem,
        endItem,
        revenue: data.revenue,
        profit: data.profit,
        count: data.count,
      };
    }).sort((a, b) => a.startItem - b.startItem);

    const bestSegment = segments.length > 0
      ? segments.reduce((max, s) => s.profit > max.profit ? s : max)
      : null;

    const worstSegment = segments.length > 0
      ? segments.reduce((min, s) => s.profit < min.profit ? s : min)
      : null;

    // D) Item Performance (top/bottom)
    const itemPerformance = sales.map(sale => {
      const item = Array.isArray(sale.inventory_items) ? sale.inventory_items[0] : sale.inventory_items;
      const costBasis = item?.cost_basis || 0;
      const itemProfit = (sale.sold_price || 0) - (sale.fees || 0) - (sale.taxes_collected || 0) -
                        (sale.shipping_cost || 0) - costBasis;
      const roi = costBasis > 0 ? (itemProfit / costBasis) * 100 : 0;

      // Find session item for item_number
      const sessionItem = sessionItemsList.find(si => {
        const invItem = Array.isArray(si.inventory_items) ? si.inventory_items[0] : si.inventory_items;
        return invItem?.id === sale.item_id;
      });

      // Calculate hold time
      let holdTimeDays = null;
      if (item?.acquired_at && sale.sold_at) {
        const acquiredDate = new Date(item.acquired_at);
        const soldDate = new Date(sale.sold_at);
        holdTimeDays = Math.floor((soldDate.getTime() - acquiredDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        itemId: sale.item_id,
        itemNumber: sessionItem?.item_number || 0,
        name: item?.display_name || item?.name || 'Unknown',
        thumbnail: item?.photo_url || item?.image_url || null,
        soldPrice: sale.sold_price || 0,
        costBasis,
        fees: sale.fees || 0,
        netProfit: itemProfit,
        roi,
        holdTimeDays,
      };
    }).sort((a, b) => b.netProfit - a.netProfit);

    const topItems = itemPerformance.slice(0, 5);
    const bottomItems = itemPerformance.slice(-5).reverse();

    const medianProfit = itemPerformance.length > 0
      ? itemPerformance[Math.floor(itemPerformance.length / 2)].netProfit
      : 0;

    // Pareto (80/20): % of profit from top 20% items
    const top20Count = Math.ceil(itemPerformance.length * 0.2);
    const top20Profit = itemPerformance.slice(0, top20Count).reduce((sum, i) => sum + i.netProfit, 0);
    const paretoPercent = netProfit > 0 ? (top20Profit / netProfit) * 100 : 0;

    // Average hold time
    const itemsWithHoldTime = itemPerformance.filter(i => i.holdTimeDays !== null);
    const avgHoldTime = itemsWithHoldTime.length > 0
      ? itemsWithHoldTime.reduce((sum, i) => sum + (i.holdTimeDays || 0), 0) / itemsWithHoldTime.length
      : null;

    // E) Cost & Leakage
    const expensesPercent = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;
    const suppliesCost = expenses
      .filter(e => ['logistics_supplies', 'shipping_materials', 'promo'].includes(e.category))
      .reduce((sum, e) => sum + e.amount, 0);
    const suppliesCostPerItem = itemsSold > 0 ? suppliesCost / itemsSold : 0;

    const payrollExpenses = expenses.filter(e => e.category === 'payroll');
    const payrollCost = payrollExpenses.reduce((sum, e) => sum + e.amount, 0);
    const payrollCostPerItem = itemsSold > 0 ? payrollCost / itemsSold : 0;

    const profitBeforeExpenses = grossRevenue - totalFees - totalTaxes - totalShipping - totalCOGS;

    // F) Break Analytics
    const breakAnalytics = breaks.map(br => {
      const slotSales = breakSlotSales.filter(bs => bs.break_id === br.id);
      const breakRevenue = slotSales.reduce((sum, bs) => sum + (bs.sold_price || 0), 0);
      const breakFees = slotSales.reduce((sum, bs) => sum + (bs.fees || 0), 0);
      const breakTaxes = slotSales.reduce((sum, bs) => sum + (bs.taxes || 0), 0);
      const breakProfit = breakRevenue - breakFees - breakTaxes - br.box_cost;
      const profitPerSpot = br.spot_count > 0 ? breakProfit / br.spot_count : 0;
      const spotsSold = slotSales.length;
      const spotSellThrough = br.spot_count > 0 ? (spotsSold / br.spot_count) * 100 : 0;
      const avgSpotPrice = spotsSold > 0 ? breakRevenue / spotsSold : 0;

      return {
        id: br.id,
        title: br.title,
        breakStyle: br.break_style,
        breakType: br.break_type,
        boxCost: br.box_cost,
        spotCount: br.spot_count,
        spotType: br.spot_type,
        revenue: breakRevenue,
        fees: breakFees,
        taxes: breakTaxes,
        netProfit: breakProfit,
        profitPerSpot,
        spotsSold,
        spotSellThrough,
        avgSpotPrice,
      };
    });

    // G) Buyer Signals
    const uniqueBuyers = new Set(sales.map(s => s.buyer_username).filter(Boolean));
    const buyerCount = uniqueBuyers.size;
    const avgSpendPerBuyer = buyerCount > 0 ? grossRevenue / buyerCount : 0;

    // Find top buyer
    const buyerRevenueMap = new Map<string, number>();
    sales.forEach(s => {
      if (s.buyer_username) {
        const existing = buyerRevenueMap.get(s.buyer_username) || 0;
        buyerRevenueMap.set(s.buyer_username, existing + (s.sold_price || 0));
      }
    });

    let topBuyer = null;
    let topBuyerRevenue = 0;
    buyerRevenueMap.forEach((revenue, username) => {
      if (revenue > topBuyerRevenue) {
        topBuyerRevenue = revenue;
        topBuyer = username;
      }
    });

    const topBuyerPercent = grossRevenue > 0 ? (topBuyerRevenue / grossRevenue) * 100 : 0;

    // H) Session comparison (basic)
    // For v1, we'll just return placeholders or skip complex queries
    const comparisonBadges: string[] = [];

    // Check if this is in top profit margin
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'RECONCILED')
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (recentSessions && recentSessions.length > 0) {
      // Simple check: if profit > 0, add badge
      if (profitMargin > 20) {
        comparisonBadges.push('High Profit Margin');
      }
      if (netProfit > 0 && itemsSold > 10) {
        comparisonBadges.push('Solid Performance');
      }
    }

    // =====================
    // RETURN RESPONSE
    // =====================

    return NextResponse.json({
      sessionId,
      reconciled: true,
      session: {
        id: session.id,
        title: session.title || session.name,
        date: session.date,
        platform: session.platform,
        status: session.status,
      },
      kpis: {
        grossRevenue,
        netProfit,
        profitMargin,
        totalCOGS,
        totalFees,
        totalTaxes,
        totalShipping,
        totalExpenses,
        avgRevenuePerCard,
        avgProfitPerCard,
        itemsRun,
        itemsSold,
        sellThrough,
      },
      breakevenComparison,
      runOrderPerformance: {
        segments,
        bestSegment,
        worstSegment,
      },
      itemPerformance: {
        topItems,
        bottomItems,
        medianProfit,
        paretoPercent,
        avgHoldTime,
      },
      costAnalysis: {
        totalExpenses,
        expensesPercent,
        suppliesCost,
        suppliesCostPerItem,
        payrollCost,
        payrollCostPerItem,
        profitBeforeExpenses,
      },
      breakAnalytics,
      buyerSignals: {
        uniqueBuyerCount: buyerCount,
        avgSpendPerBuyer,
        topBuyer,
        topBuyerRevenue,
        topBuyerPercent,
      },
      comparisonBadges,
    });
  } catch (error) {
    console.error('[REPORT_API] Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
