'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import type {
  Session,
  SessionExpense,
  Break,
  ExpenseCategory,
  SessionPlatform,
  PreShowStats,
  ReconcilePreview,
  SessionPnL
} from '@/lib/types/sessions';
import * as sessionsService from '@/lib/services/sessions';
import { ManualAddItemDialog } from '@/components/sessions/ManualAddItemDialog';
import { RapidPhotoUpload } from '@/components/sessions/RapidPhotoUpload';
import { ImportPreshowCSV } from '@/components/sessions/ImportPreshowCSV';

interface SessionDetailContentProps {
  sessionId: string;
  userId: string;
}

// Extended session item type with joined inventory data
interface SessionItemWithInventory {
  id: string;
  session_id: string;
  item_id: string;
  item_number: number | null;
  position: number | null;
  item?: {
    id: string;
    name: string | null;
    display_name: string | null;
    cost_basis: number;
    image_url: string | null;
  };
}

// Platform display names
const PLATFORM_LABELS: Record<SessionPlatform, string> = {
  whatnot: 'Whatnot',
  ebay: 'eBay',
  instagram: 'Instagram',
  show: 'In-Person Show',
  other: 'Other'
};

// Expense category labels
const EXPENSE_CATEGORY_LABELS: Partial<Record<ExpenseCategory, string>> = {
  supplies: 'Supplies',
  shipping_materials: 'Shipping Materials',
  promo: 'Promo/Giveaways',
  show_fee: 'Show/Booth Fee',
  travel: 'Travel',
  misc: 'Miscellaneous'
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-warning-subtle text-warning-subtle border-warning-subtle',
  FINALIZED: 'bg-info-subtle text-info-subtle border-info-subtle',
  RECONCILED: 'bg-success-subtle text-success-subtle border-success-subtle'
};

export function SessionDetailContent({ sessionId, userId }: SessionDetailContentProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<SessionItemWithInventory[]>([]);
  const [expenses, setExpenses] = useState<SessionExpense[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [preShowStats, setPreShowStats] = useState<PreShowStats | null>(null);
  const [plSummary, setPLSummary] = useState<SessionPnL | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit session dialog
  const [editSessionOpen, setEditSessionOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    date: '',
    platform: 'whatnot' as SessionPlatform,
    estimated_fee_rate: 0,
    tax_rate_default: 0
  });
  
  // Add expense dialog
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'supplies' as ExpenseCategory,
    amount: 0,
    notes: ''
  });
  
  // Add break dialog
  const [addBreakOpen, setAddBreakOpen] = useState(false);
  const [breakForm, setBreakForm] = useState({
    title: '',
    box_cost: 0,
    slots_count: 10,
    estimated_fee_rate: 0.12
  });
  
  // CSV import state
  const [reconcilePreview, setReconcilePreview] = useState<ReconcilePreview | null>(null);
  const [reconcileMode, setReconcileMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  
  // Finalize dialog
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  // Add item dialogs
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const supabase = createClient();

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await sessionsService.getSession(supabase, sessionId);
      if (sessionError || !sessionData) {
        setError('Session not found');
        return;
      }
      setSession(sessionData);
      
      // Use defaults for fields that may not exist until migration is applied
      setEditForm({
        title: sessionData.title || sessionData.name,
        date: sessionData.date ? sessionData.date.split('T')[0] : new Date().toISOString().split('T')[0],
        platform: sessionData.platform || 'whatnot',
        estimated_fee_rate: sessionData.estimated_fee_rate ?? 0.12,
        tax_rate_default: sessionData.tax_rate_default ?? 0
      });
      
      // Load session items - try join table first, fallback to old schema
      let loadedItems: Array<{ cost_basis: number | null }> = [];
      try {
        // Try new schema (session_items join table)
        const { data: sessionItemsData, error: joinError } = await supabase
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
              photo_url
            )
          `)
          .eq('session_id', sessionId)
          .order('position', { ascending: true });

        if (!joinError && sessionItemsData) {
          // New schema worked
          loadedItems = (sessionItemsData || []).map(si => {
            const item = Array.isArray(si.inventory_items) ? si.inventory_items[0] : si.inventory_items;
            return { cost_basis: item?.cost_basis || 0 };
          });

          setItems((sessionItemsData || []).map(si => {
            const item = Array.isArray(si.inventory_items) ? si.inventory_items[0] : si.inventory_items;
            return {
              id: si.id,
              session_id: sessionId,
              item_id: item?.id || '',
              item_number: si.item_number || 0,
              position: si.position || 0,
              item: {
                id: item?.id || '',
                name: item?.name || item?.display_name || '',
                display_name: item?.display_name || item?.name || '',
                cost_basis: item?.cost_basis || 0,
                image_url: item?.image_url || item?.photo_url || null
              }
            };
          }));
        } else {
          // Fallback to old schema (direct session_id on inventory_items)
          console.log('Using fallback to old schema');
          const { data: itemsData } = await supabase
            .from('inventory_items')
            .select('id, name, display_name, cost_basis, image_url, photo_url')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

          loadedItems = (itemsData || []).map(item => ({ cost_basis: item.cost_basis || 0 }));

          setItems((itemsData || []).map((item, idx) => ({
            id: item.id,
            session_id: sessionId,
            item_id: item.id,
            item_number: idx + 1,
            position: idx,
            item: {
              id: item.id,
              name: item.name || item.display_name || '',
              display_name: item.display_name || item.name || '',
              cost_basis: item.cost_basis || 0,
              image_url: item.image_url || item.photo_url || null
            }
          })));
        }
      } catch (err) {
        console.error('Error loading session items:', err);
        setItems([]);
      }

      // Load expenses
      let loadedExpenses: SessionExpense[] = [];
      try {
        const { data: expensesData } = await supabase
          .from('session_expenses')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false });
        loadedExpenses = expensesData || [];
        setExpenses(loadedExpenses);
      } catch {
        setExpenses([]);
      }

      // Load breaks
      let loadedBreaks: Break[] = [];
      try {
        const { data: breaksData } = await supabase
          .from('breaks')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false });
        loadedBreaks = breaksData || [];
        setBreaks(loadedBreaks);
      } catch {
        setBreaks([]);
      }

      // Calculate pre-show stats
      try {
        const totalInventoryCost = loadedItems.reduce((sum, item) => sum + (item.cost_basis || 0), 0);
        const totalExpenses = loadedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalBreakCosts = loadedBreaks.reduce((sum, b) => sum + (b.box_cost || 0), 0);
        const totalPlannedOutlay = totalInventoryCost + totalExpenses + totalBreakCosts;
        const estimatedFeeRate = sessionData.estimated_fee_rate || 0.12;
        const breakevenRevenue = estimatedFeeRate < 1 ? totalPlannedOutlay / (1 - estimatedFeeRate) : totalPlannedOutlay;
        const breakevenAvgPerCard = loadedItems.length > 0 ? breakevenRevenue / loadedItems.length : 0;

        setPreShowStats({
          total_items: loadedItems.length,
          total_inventory_cost: totalInventoryCost,
          totalInventoryCost: totalInventoryCost,
          total_expenses: totalExpenses,
          totalExpenses: totalExpenses,
          total_breaks_cost: 0,
          totalBreaksCost: 0,
          total_planned_outlay: totalPlannedOutlay,
          estimated_fee_rate: estimatedFeeRate,
          breakeven_revenue: breakevenRevenue,
          breakevenRevenue: breakevenRevenue,
          breakeven_avg_per_card: breakevenAvgPerCard,
          breaks: []
        });
      } catch {
        setPreShowStats(null);
      }

      setPLSummary(null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSaveSession = async () => {
    if (!session) return;
    
    await sessionsService.updateSession(supabase, sessionId, {
      title: editForm.title,
      date: editForm.date,
      platform: editForm.platform,
      estimated_fee_rate: editForm.estimated_fee_rate,
      tax_rate_default: editForm.tax_rate_default
    });
    
    setEditSessionOpen(false);
    loadSession();
  };

  const handleAddExpense = async () => {
    await sessionsService.addSessionExpense(supabase, sessionId, {
      category: expenseForm.category,
      amount: expenseForm.amount,
      notes: expenseForm.notes || undefined
    });
    
    setAddExpenseOpen(false);
    setExpenseForm({ category: 'supplies', amount: 0, notes: '' });
    loadSession();
  };

  const handleDeleteExpense = async (expenseId: string) => {
    await sessionsService.deleteSessionExpense(supabase, expenseId);
    loadSession();
  };

  const handleAddBreak = async () => {
    await sessionsService.addBreak(supabase, sessionId, {
      title: breakForm.title,
      boxCost: breakForm.box_cost,
      slotsCount: breakForm.slots_count,
      estimatedFeeRate: breakForm.estimated_fee_rate
    });
    
    setAddBreakOpen(false);
    setBreakForm({ title: '', box_cost: 0, slots_count: 10, estimated_fee_rate: 0.12 });
    loadSession();
  };

  const handleDeleteBreak = async (breakId: string) => {
    await sessionsService.deleteBreak(supabase, breakId);
    loadSession();
  };

  const handleFinalize = async () => {
    try {
      await sessionsService.finalizeSession(supabase, sessionId);
      setFinalizeOpen(false);
      loadSession();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to finalize session');
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    const parsed = sessionsService.parseResultsCSV(text);
    
    if (parsed.errors.length > 0) {
      alert(`CSV parsing warnings:\n${parsed.errors.join('\n')}`);
    }
    
    // Build reconcile preview
    const preview = await sessionsService.createReconcilePreview(supabase, sessionId, parsed.rows);
    setReconcilePreview(preview);
    
    // Select all matched rows by default
    const matchedIndices = new Set<number>();
    preview.rows.forEach((row, idx) => {
      if (row.status === 'matched') {
        matchedIndices.add(idx);
      }
    });
    setSelectedRows(matchedIndices);
    setReconcileMode(true);
  };

  const handleApplyReconciliation = async () => {
    if (!reconcilePreview) return;
    
    const rowsToApply = reconcilePreview.rows.filter((_, idx) => selectedRows.has(idx));
    if (rowsToApply.length === 0) {
      alert('No rows selected for reconciliation');
      return;
    }
    
    try {
      const result = await sessionsService.applyReconciliation(supabase, userId, sessionId, rowsToApply, {
        defaultChannel: session?.platform || 'whatnot',
        defaultFeeRate: session?.estimated_fee_rate || 0.12
      });
      
      if (result.errors.length > 0) {
        alert(`Reconciliation completed with errors:\n${result.errors.join('\n')}`);
      }
      
      setReconcileMode(false);
      setReconcilePreview(null);
      setSelectedRows(new Set());
      loadSession();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to apply reconciliation');
    }
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleManualAddItem = async (item: {
    name: string;
    costBasis: number;
    imageUrl?: string;
    notes?: string;
  }) => {
    await sessionsService.addItemToSession(supabase, userId, sessionId, {
      newItem: {
        name: item.name,
        costBasis: item.costBasis,
        imageUrl: item.imageUrl,
        notes: item.notes
      },
      addedVia: 'manual'
    });
    loadSession();
  };

  const handlePhotoUpload = async (items: Array<{
    name: string;
    costBasis: number;
    file: File;
  }>) => {
    // For now, we'll skip actual file upload to storage and just create items
    // In production, this would upload to Supabase Storage first
    await sessionsService.batchAddItemsToSession(
      supabase,
      userId,
      sessionId,
      items.map(item => ({
        name: item.name,
        costBasis: item.costBasis,
        // TODO: Upload file to storage and use URL
        imageUrl: undefined,
        notes: undefined
      })),
      undefined,
      'photo'
    );
    loadSession();
  };

  const handleCSVImport = async (rows: Array<{
    name: string;
    costBasis: number;
    itemNumber?: number;
    notes?: string;
  }>) => {
    try {
      const result = await sessionsService.batchAddItemsToSession(
        supabase,
        userId,
        sessionId,
        rows.map(r => ({
          name: r.name,
          costBasis: r.costBasis,
          notes: r.notes
        })),
        rows[0]?.itemNumber,
        'preshow_csv'
      );

      if (result.error) {
        throw new Error(result.error.message);
      }

      console.log('CSV import successful, created items:', result.data);
      await loadSession();
    } catch (error) {
      console.error('CSV import error:', error);
      alert('Failed to import items: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error || 'Session not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sessions">
              <Button variant="outline">Back to Sessions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default to DRAFT status if status column doesn't exist yet (migration not applied)
  const sessionStatus = session.status || 'DRAFT';
  const isPreShow = sessionStatus === 'DRAFT';
  const isFinalized = sessionStatus === 'FINALIZED';
  const isReconciled = sessionStatus === 'RECONCILED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b">
        <div className="max-w-[1280px] mx-auto">
          <Link
            href="/sessions"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sessions
          </Link>

          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {session.title || session.name}
                </h1>
                <Badge className={STATUS_COLORS[session.status || 'DRAFT'] || STATUS_COLORS.DRAFT}>
                  {session.status || 'DRAFT'}
                </Badge>
                {session.platform && (
                  <Badge variant="outline">
                    {PLATFORM_LABELS[session.platform] || session.platform}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {session.date 
                    ? new Date(session.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'No date set'
                  }
                </span>
                <span>•</span>
                <span>{items.length} items in run list</span>
                {expenses.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{expenses.length} expenses</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isPreShow && (
                <>
                  <Button variant="outline" onClick={() => setEditSessionOpen(true)}>
                    Edit Details
                  </Button>
                  <Button onClick={() => setFinalizeOpen(true)}>
                    Finalize Session
                  </Button>
                </>
              )}
              {isFinalized && !reconcileMode && (
                <div>
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <Button asChild>
                      <span>Import Results CSV</span>
                    </Button>
                  </Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCSVUpload}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1280px] mx-auto">
        {/* Reconciliation Mode */}
        {reconcileMode && reconcilePreview && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Reconcile Sales</CardTitle>
              <CardDescription>
                Review matched sales from your CSV. Select matches to apply.
                {reconcilePreview.warnings && reconcilePreview.warnings.length > 0 && (
                  <span className="block mt-1 text-warning-subtle">
                    Warnings: {reconcilePreview.warnings.join(', ')}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Apply</TableHead>
                    <TableHead>Item #</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-right">Sold Price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconcilePreview.rows.map((row, index) => (
                    <TableRow 
                      key={index} 
                      className={selectedRows.has(index) ? '' : 'opacity-50'}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(index)}
                          onCheckedChange={() => toggleRowSelection(index)}
                          disabled={row.status === 'conflict'}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{row.itemNumber || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.itemName}</TableCell>
                      <TableCell>
                        <Badge variant={
                          row.matchConfidence === 'high' ? 'default' :
                          row.matchConfidence === 'medium' ? 'secondary' : 'outline'
                        }>
                          {row.status === 'matched' ? row.matchMethod : row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.soldPrice !== null && row.soldPrice !== undefined ? `$${row.soldPrice.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${row.costBasis?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${
                        row.netProfit !== null && row.netProfit !== undefined && row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {row.netProfit !== null && row.netProfit !== undefined ? `$${row.netProfit.toFixed(2)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedRows.size} of {reconcilePreview.rows.length} items selected
                  {' • '}
                  {reconcilePreview.totalMatched} matched, {reconcilePreview.totalUnsold} unsold
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => {
                    setReconcileMode(false);
                    setReconcilePreview(null);
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleApplyReconciliation}>
                    Apply & Create Sales
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pre-Show Mode */}
        {isPreShow && !reconcileMode && (
          <Tabs defaultValue="runlist" className="space-y-6">
            <TabsList>
              <TabsTrigger value="runlist">Run List</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="breaks">Breaks</TabsTrigger>
              <TabsTrigger value="stats">Breakeven Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="runlist" className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-xl font-semibold">Run List ({items.length} items)</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPhotoUploadOpen(true)}>
                    Upload Photos
                  </Button>
                  <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
                    Import CSV
                  </Button>
                  <Button onClick={() => setManualAddOpen(true)}>
                    Add Item
                  </Button>
                </div>
              </div>
              
              {items.length > 0 ? (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Order</TableHead>
                        <TableHead className="w-[80px]">Item #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="text-right">Cost Basis</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{index + 1}</TableCell>
                          <TableCell className="font-mono font-semibold">{item.item_number}</TableCell>
                          <TableCell>{item.item?.name || item.item?.display_name || 'Untitled'}</TableCell>
                          <TableCell className="text-right font-mono">
                            ${(item.item?.cost_basis || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">No items in run list yet</p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setPhotoUploadOpen(true)}>
                        Upload Photos
                      </Button>
                      <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
                        Import CSV
                      </Button>
                      <Button onClick={() => setManualAddOpen(true)}>
                        Add Item
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Session Expenses</h2>
                <Button onClick={() => setAddExpenseOpen(true)}>Add Expense</Button>
              </div>
              
              {expenses.length > 0 ? (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map(expense => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{expense.notes || expense.description || '—'}</TableCell>
                          <TableCell className="text-right font-mono">${expense.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={2} className="font-semibold">Total Expenses</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">No expenses recorded</p>
                    <Button onClick={() => setAddExpenseOpen(true)}>Add Expense</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="breaks" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Breaks</h2>
                <Button onClick={() => setAddBreakOpen(true)}>Add Break</Button>
              </div>
              
              {breaks.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {breaks.map(brk => (
                    <Card key={brk.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{brk.title || 'Unnamed Break'}</CardTitle>
                            <CardDescription>
                              {brk.spot_count} slots
                            </CardDescription>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteBreak(brk.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Box Cost:</span>
                            <span className="ml-2 font-mono">${brk.box_cost.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Breakeven/Slot:</span>
                            <span className="ml-2 font-mono">
                              ${brk.spot_count > 0 ? (brk.box_cost / brk.spot_count).toFixed(2) : '—'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">No breaks planned</p>
                    <Button onClick={() => setAddBreakOpen(true)}>Add Break</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="stats" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Pre-Show Financial Summary</h2>
                <p className="text-sm text-muted-foreground">
                  Calculate your breakeven point and target revenue based on your platform fees
                </p>
              </div>

              {preShowStats ? (
                <>
                  {/* Cost Breakdown */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{preShowStats.total_items}</p>
                        <p className="text-xs text-muted-foreground mt-1">in run list</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Inventory Cost</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold font-mono">
                          ${preShowStats.total_inventory_cost.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">cost basis</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Expenses</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold font-mono">
                          ${preShowStats.total_expenses.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">session costs</p>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-warning-subtle bg-warning-subtle">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-warning-subtle font-semibold">Total Spent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold font-mono text-warning-subtle">
                          ${preShowStats.total_planned_outlay.toFixed(2)}
                        </p>
                        <p className="text-xs text-warning-subtle mt-1">total outlay</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Breakeven Calculator */}
                  <Card className="border-2 border-primary">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Breakeven Calculator</CardTitle>
                          <CardDescription className="mt-1">
                            Revenue needed to cover all costs after platform fees
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {PLATFORM_LABELS[session.platform || 'whatnot']}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Fee Rate Display */}
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">Platform Fee Rate</p>
                          <p className="text-2xl font-bold">
                            {((session.estimated_fee_rate || 0.12) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Platform</p>
                          <p className="text-lg font-semibold">
                            {PLATFORM_LABELS[session.platform || 'whatnot']}
                          </p>
                        </div>
                      </div>

                      {/* Breakeven Calculation */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="bg-primary text-primary-foreground">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Breakeven Revenue</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold font-mono">
                              ${preShowStats.breakeven_revenue.toFixed(2)}
                            </p>
                            <p className="text-xs opacity-90 mt-2">
                              Formula: ${preShowStats.total_planned_outlay.toFixed(2)} ÷ (1 - {((session.estimated_fee_rate || 0.12) * 100).toFixed(1)}%)
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="bg-info-subtle border border-info-subtle">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-info-subtle">Avg Per Item</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold font-mono text-info-subtle">
                              ${preShowStats.breakeven_avg_per_card?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-info-subtle mt-2">
                              To break even across {preShowStats.total_items} items
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Profit Targets */}
                      <div className="border-t pt-4">
                        <p className="text-sm font-semibold mb-3">Target Revenue for Profit</p>
                        <div className="grid grid-cols-3 gap-3">
                          {[10, 25, 50].map(profitPercent => {
                            const targetRevenue = preShowStats.breakeven_revenue * (1 + profitPercent / 100);
                            return (
                              <div key={profitPercent} className="text-center p-3 bg-success-subtle border border-success-subtle rounded">
                                <p className="text-xs text-success-subtle font-medium mb-1">+{profitPercent}% Profit</p>
                                <p className="text-lg font-bold font-mono text-success-subtle">
                                  ${targetRevenue.toFixed(0)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">Add items and expenses to see breakeven calculations</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Post-Show (Finalized) Mode */}
        {isFinalized && !reconcileMode && (
          <Card>
            <CardHeader>
              <CardTitle>Session Finalized</CardTitle>
              <CardDescription>
                This session is ready for post-show reconciliation. Import your sales results CSV to match sales to items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground mb-4">
                  Upload your Whatnot, eBay, or other platform sales export CSV
                </p>
                <Label htmlFor="csv-upload-main" className="cursor-pointer">
                  <Button asChild>
                    <span>Import Results CSV</span>
                  </Button>
                </Label>
                <Input
                  id="csv-upload-main"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVUpload}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reconciled Mode - Show P&L Summary */}
        {isReconciled && plSummary && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Session P&L Summary</h2>
            
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Gross Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-mono">${plSummary.gross_revenue.toFixed(2)}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total COGS</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-mono">${plSummary.total_cogs.toFixed(2)}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total Fees</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-mono">${plSummary.total_fees.toFixed(2)}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-mono">${plSummary.total_expenses.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Card className={plSummary.net_profit >= 0 ? 'border border-success-subtle' : 'border border-danger-subtle'}>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Net Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold font-mono ${plSummary.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${plSummary.net_profit.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Profit Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${plSummary.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {plSummary.profit_margin.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Items Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{plSummary.sold_count}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Items Unsold</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{plSummary.total_items - plSummary.sold_count}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Sell-Through Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{plSummary.sell_through_rate.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Session Dialog */}
      <Dialog open={editSessionOpen} onOpenChange={setEditSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session Details</DialogTitle>
            <DialogDescription>Update session information before finalizing</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={editForm.platform}
                onValueChange={(val) => setEditForm({ ...editForm, platform: val as SessionPlatform })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fee_rate">Est. Fee Rate (%)</Label>
                <Input
                  id="fee_rate"
                  type="number"
                  step="0.1"
                  value={(editForm.estimated_fee_rate * 100).toFixed(1)}
                  onChange={(e) => setEditForm({ ...editForm, estimated_fee_rate: parseFloat(e.target.value) / 100 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  step="0.1"
                  value={(editForm.tax_rate_default * 100).toFixed(1)}
                  onChange={(e) => setEditForm({ ...editForm, tax_rate_default: parseFloat(e.target.value) / 100 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSessionOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSession}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a session expense</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expense_category">Category</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(val) => setExpenseForm({ ...expenseForm, category: val as ExpenseCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_amount">Amount</Label>
              <Input
                id="expense_amount"
                type="number"
                step="0.01"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_notes">Notes (optional)</Label>
              <Input
                id="expense_notes"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)}>Cancel</Button>
            <Button onClick={handleAddExpense}>Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Break Dialog */}
      <Dialog open={addBreakOpen} onOpenChange={setAddBreakOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Break</DialogTitle>
            <DialogDescription>Add a break/box to the session</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="break_title">Title</Label>
              <Input
                id="break_title"
                value={breakForm.title}
                onChange={(e) => setBreakForm({ ...breakForm, title: e.target.value })}
                placeholder="e.g., Hobby Box Break #1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="box_cost">Box Cost</Label>
              <Input
                id="box_cost"
                type="number"
                step="0.01"
                value={breakForm.box_cost}
                onChange={(e) => setBreakForm({ ...breakForm, box_cost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slots_count">Number of Slots</Label>
                <Input
                  id="slots_count"
                  type="number"
                  value={breakForm.slots_count}
                  onChange={(e) => setBreakForm({ ...breakForm, slots_count: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="break_fee_rate">Fee Rate (%)</Label>
                <Input
                  id="break_fee_rate"
                  type="number"
                  step="0.1"
                  value={(breakForm.estimated_fee_rate * 100).toFixed(1)}
                  onChange={(e) => setBreakForm({ ...breakForm, estimated_fee_rate: parseFloat(e.target.value) / 100 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBreakOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBreak}>Add Break</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Confirmation Dialog */}
      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Session?</DialogTitle>
            <DialogDescription>
              Once finalized, you cannot add or remove items from the run list.
              You will be able to import your post-show results CSV for reconciliation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Session: <strong>{session.title || session.name}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Items in run list: <strong>{items.length}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Total expenses: <strong>${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeOpen(false)}>Cancel</Button>
            <Button onClick={handleFinalize}>Finalize Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add Item Dialog */}
      <ManualAddItemDialog
        open={manualAddOpen}
        onOpenChange={setManualAddOpen}
        onAdd={handleManualAddItem}
      />

      {/* Rapid Photo Upload Dialog */}
      <RapidPhotoUpload
        open={photoUploadOpen}
        onOpenChange={setPhotoUploadOpen}
        onUpload={handlePhotoUpload}
      />

      {/* Import Pre-show CSV Dialog */}
      <ImportPreshowCSV
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onImport={handleCSVImport}
      />
    </div>
  );
}
