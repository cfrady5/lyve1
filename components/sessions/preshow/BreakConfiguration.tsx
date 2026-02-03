'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Break, BreakStyle, BreakType, BreakBox, ExpenseAllocationMethod, BreakBreakevenResult } from '@/lib/types/sessions';
import {
  BREAK_STYLE_LABELS,
  BREAK_TYPE_LABELS,
  EXPENSE_ALLOCATION_METHOD_LABELS
} from '@/lib/types/sessions';

interface BreakConfigurationProps {
  sessionId: string;
  breaks: Break[];
  sessionFeeRate: number;
  sessionProfitTarget: number;
  totalSessionExpenses: number;
  onBreaksChange: () => void;
}

export function BreakConfiguration({
  sessionId,
  breaks,
  sessionFeeRate,
  sessionProfitTarget,
  totalSessionExpenses,
  onBreaksChange
}: BreakConfigurationProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingBreak, setEditingBreak] = useState<Break | null>(null);

  const handleAddBreak = () => {
    setEditingBreak(null);
    setIsAddDialogOpen(true);
  };

  const handleEditBreak = (breakItem: Break) => {
    setEditingBreak(breakItem);
    setIsAddDialogOpen(true);
  };

  const handleDeleteBreak = async (breakId: string) => {
    if (!confirm('Delete this break? This action cannot be undone.')) return;

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { error } = await supabase
        .from('breaks')
        .delete()
        .eq('id', breakId);

      if (error) {
        console.error('[BRK_DEL_001] Failed to delete break:', error);
        alert(`[BRK_DEL_001] Failed to delete break: ${error.message}`);
        return;
      }

      onBreaksChange();
    } catch (err) {
      console.error('[BRK_DEL_002] Unexpected error deleting break:', err);
      alert('[BRK_DEL_002] Unexpected error occurred while deleting break');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Breaks</h3>
          <p className="text-sm text-muted-foreground">
            Configure box breaks with multi-box support and breakeven calculator
          </p>
        </div>
        <Button onClick={handleAddBreak} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Break
        </Button>
      </div>

      {breaks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No breaks configured yet.</p>
            <p className="text-sm mt-1">Click &quot;Add Break&quot; to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {breaks.map((breakItem) => (
            <BreakCard
              key={breakItem.id}
              breakItem={breakItem}
              sessionFeeRate={sessionFeeRate}
              sessionProfitTarget={sessionProfitTarget}
              totalSessionExpenses={totalSessionExpenses}
              onEdit={() => handleEditBreak(breakItem)}
              onDelete={() => handleDeleteBreak(breakItem.id)}
            />
          ))}
        </div>
      )}

      {isAddDialogOpen && (
        <BreakDialog
          sessionId={sessionId}
          breakItem={editingBreak}
          sessionFeeRate={sessionFeeRate}
          sessionProfitTarget={sessionProfitTarget}
          totalSessionExpenses={totalSessionExpenses}
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSave={() => {
            setIsAddDialogOpen(false);
            setEditingBreak(null);
            onBreaksChange();
          }}
        />
      )}
    </div>
  );
}

// ================================================================
// BREAK CARD (Collapsible with Breakeven)
// ================================================================

interface BreakCardProps {
  breakItem: Break;
  sessionFeeRate: number;
  sessionProfitTarget: number;
  totalSessionExpenses: number;
  onEdit: () => void;
  onDelete: () => void;
}

function BreakCard({ breakItem, onEdit, onDelete }: BreakCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [boxes, setBoxes] = useState<BreakBox[]>([]);
  const [breakeven, setBreakeven] = useState<BreakBreakevenResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBreakData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakItem.id]);

  const loadBreakData = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();

      // Load boxes if mixer
      if (breakItem.break_type === 'mixer') {
        const { data } = await supabase
          .from('break_boxes')
          .select('*')
          .eq('break_id', breakItem.id)
          .order('position');

        setBoxes(data || []);
      }

      // Calculate breakeven using database function
      const { data: breakevenData } = await supabase
        .rpc('calculate_break_breakeven', {
          p_break_id: breakItem.id,
          p_include_profit_target: true,
        });

      if (breakevenData && breakevenData.length > 0) {
        setBreakeven(breakevenData[0]);
      }
    } catch (err) {
      console.error('[BRK_CARD_001] Error loading break data:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalBoxCost = breakItem.break_type === 'mixer'
    ? boxes.reduce((sum, box) => sum + (box.quantity * box.price_paid_per_box), 0)
    : breakItem.box_cost;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{breakItem.title}</CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CardDescription>
                {BREAK_STYLE_LABELS[breakItem.break_style]} • {BREAK_TYPE_LABELS[breakItem.break_type]}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Box Cost</p>
              <p className="font-mono font-semibold">{formatCurrency(totalBoxCost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Spots</p>
              <p className="font-semibold">{breakItem.spot_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Breakeven/Spot</p>
              {loading ? (
                <p className="text-xs text-muted-foreground">Calculating...</p>
              ) : breakeven ? (
                <p className="font-mono font-semibold text-primary">{formatCurrency(breakeven.required_per_spot)}</p>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>

          <CollapsibleContent className="space-y-4">
            {/* Box Details (for mixers) */}
            {breakItem.break_type === 'mixer' && boxes.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Boxes in this Break</p>
                <div className="space-y-1">
                  {boxes.map((box, idx) => (
                    <div key={box.id} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                      <span>
                        {box.quantity}x {box.product_name || box.box_name || `Box ${idx + 1}`}
                      </span>
                      <span className="font-mono">
                        {formatCurrency(box.price_paid_per_box)} ea = {formatCurrency(box.quantity * box.price_paid_per_box)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Breakeven Breakdown */}
            {!loading && breakeven && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Breakeven Breakdown</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Box Cost</span>
                    <span className="font-mono">{formatCurrency(breakeven.box_cost)}</span>
                  </div>
                  {breakeven.allocated_expenses > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Allocated Expenses</span>
                      <span className="font-mono">{formatCurrency(breakeven.allocated_expenses)}</span>
                    </div>
                  )}
                  {breakeven.profit_target > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Profit Target</span>
                      <span className="font-mono">{formatCurrency(breakeven.profit_target)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Fee Rate</span>
                    <span>{(breakeven.fee_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Required Total Revenue</span>
                    <span className="font-mono">{formatCurrency(breakeven.required_revenue)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>Required Per Spot</span>
                    <span className="font-mono">{formatCurrency(breakeven.required_per_spot)}</span>
                  </div>
                </div>
              </div>
            )}

            {breakItem.notes && (
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">{breakItem.notes}</p>
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

// ================================================================
// BREAK DIALOG (ADD/EDIT) - Continued in next message due to length
// ================================================================

interface BreakDialogProps {
  sessionId: string;
  breakItem: Break | null;
  sessionFeeRate: number;
  sessionProfitTarget: number;
  totalSessionExpenses: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

function BreakDialog({
  sessionId,
  breakItem,
  sessionFeeRate,
  sessionProfitTarget,
  totalSessionExpenses,
  open,
  onOpenChange,
  onSave
}: BreakDialogProps) {
  const [title, setTitle] = useState(breakItem?.title || '');
  const [breakStyle, setBreakStyle] = useState<BreakStyle>(breakItem?.break_style || 'pyt');
  const [breakType, setBreakType] = useState<BreakType>(breakItem?.break_type || 'single_product');

  // Single product fields
  const [singleBoxCost, setSingleBoxCost] = useState(breakItem?.box_cost.toString() || '');

  // Multi-box fields
  const [boxes, setBoxes] = useState<Array<{ product_name: string; quantity: string; price_paid_per_box: string }>>([
    { product_name: '', quantity: '1', price_paid_per_box: '' },
  ]);

  // Spot configuration
  const [teamsCount, setTeamsCount] = useState(breakItem?.teams_count?.toString() || '30');
  const [playersCount, setPlayersCount] = useState(breakItem?.players_count?.toString() || '');
  const [customSpotCount, setCustomSpotCount] = useState('');
  const [spotConfigType, setSpotConfigType] = useState<'TEAM_30' | 'THREE_TEAM_10' | 'CUSTOM'>(
    breakItem?.spot_config_type || 'TEAM_30'
  );

  // Expense allocation
  const [includeExpenses, setIncludeExpenses] = useState(breakItem?.include_expenses_allocation ?? true);
  const [allocationMethod, setAllocationMethod] = useState<ExpenseAllocationMethod>(
    breakItem?.expenses_allocation_method || 'pro_rata_cost'
  );
  const [manualExpense, setManualExpense] = useState(breakItem?.manual_allocated_expense?.toString() || '');

  // Profit target and fee rate
  const [useCustomFeeRate, setUseCustomFeeRate] = useState(!!breakItem?.estimated_fee_rate);
  const [customFeeRate, setCustomFeeRate] = useState(
    breakItem?.estimated_fee_rate ? (breakItem.estimated_fee_rate * 100).toString() : ''
  );
  const [useCustomProfitTarget, setUseCustomProfitTarget] = useState(!!breakItem?.profit_target_amount);
  const [customProfitTarget, setCustomProfitTarget] = useState(breakItem?.profit_target_amount?.toString() || '');

  const [notes, setNotes] = useState(breakItem?.notes || '');
  const [loading, setLoading] = useState(false);

  // Load existing boxes if editing mixer
  useEffect(() => {
    if (breakItem && breakItem.break_type === 'mixer') {
      loadExistingBoxes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakItem]);

  const loadExistingBoxes = async () => {
    if (!breakItem) return;

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data } = await supabase
        .from('break_boxes')
        .select('*')
        .eq('break_id', breakItem.id)
        .order('position');

      if (data && data.length > 0) {
        setBoxes(
          data.map(box => ({
            product_name: box.product_name || box.box_name || '',
            quantity: box.quantity.toString(),
            price_paid_per_box: box.price_paid_per_box.toString(),
          }))
        );
      }
    } catch (err) {
      console.error('[BRK_DLG_001] Error loading boxes:', err);
    }
  };

  const handleBreakStyleChange = (style: BreakStyle) => {
    setBreakStyle(style);
    if (style === 'pyt') {
      setTeamsCount('30');
    } else if (style === 'pyp') {
      setPlayersCount('');
    } else if (style === 'random_drafted') {
      setSpotConfigType('TEAM_30');
      setTeamsCount('30');
    }
  };

  const handleSpotConfigChange = (config: 'TEAM_30' | 'THREE_TEAM_10' | 'CUSTOM') => {
    setSpotConfigType(config);
    if (config === 'TEAM_30') {
      setTeamsCount('30');
      setCustomSpotCount('');
    } else if (config === 'THREE_TEAM_10') {
      setCustomSpotCount('10');
    } else {
      setCustomSpotCount('');
    }
  };

  const addBox = () => {
    setBoxes([...boxes, { product_name: '', quantity: '1', price_paid_per_box: '' }]);
  };

  const removeBox = (index: number) => {
    if (boxes.length > 1) {
      setBoxes(boxes.filter((_, i) => i !== index));
    }
  };

  const updateBox = (index: number, field: keyof typeof boxes[0], value: string) => {
    const newBoxes = [...boxes];
    newBoxes[index][field] = value;
    setBoxes(newBoxes);
  };

  const calculateSpotCount = (): number => {
    if (breakStyle === 'pyt') {
      return parseInt(teamsCount) || 30;
    } else if (breakStyle === 'pyp') {
      return parseInt(playersCount) || 0;
    } else if (breakStyle === 'random_drafted') {
      if (spotConfigType === 'TEAM_30') return parseInt(teamsCount) || 30;
      if (spotConfigType === 'THREE_TEAM_10') return 10;
      return parseInt(customSpotCount) || 0;
    }
    return 0;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();

      const spotCount = calculateSpotCount();

      const breakData = {
        session_id: sessionId,
        title,
        break_style: breakStyle,
        break_type: breakType,
        box_cost: breakType === 'single_product' ? parseFloat(singleBoxCost) || 0 : 0,
        spot_count: spotCount,
        spot_config_type: breakStyle === 'random_drafted' ? spotConfigType : null,
        teams_count: breakStyle === 'pyt' || (breakStyle === 'random_drafted' && spotConfigType === 'TEAM_30')
          ? parseInt(teamsCount) || null
          : null,
        players_count: breakStyle === 'pyp' ? parseInt(playersCount) || null : null,
        estimated_fee_rate: useCustomFeeRate && customFeeRate ? parseFloat(customFeeRate) / 100 : null,
        profit_target_amount: useCustomProfitTarget && customProfitTarget ? parseFloat(customProfitTarget) : null,
        include_expenses_allocation: includeExpenses,
        expenses_allocation_method: includeExpenses ? allocationMethod : null,
        manual_allocated_expense: includeExpenses && allocationMethod === 'manual' && manualExpense
          ? parseFloat(manualExpense)
          : null,
        notes: notes || null,
      };

      let breakId: string;

      if (breakItem) {
        // Update existing break
        const { error } = await supabase
          .from('breaks')
          .update(breakData)
          .eq('id', breakItem.id);

        if (error) {
          console.error('[BRK_UPD_001] Failed to update break:', error);
          alert(`Failed to update break: ${error.message}`);
          return;
        }

        breakId = breakItem.id;
      } else {
        // Create new break
        const { data, error } = await supabase
          .from('breaks')
          .insert(breakData)
          .select('id')
          .single();

        if (error || !data) {
          console.error('[BRK_ADD_001] Failed to create break:', error);
          alert(`Failed to create break: ${error?.message || 'Unknown error'}`);
          return;
        }

        breakId = data.id;
      }

      // Handle boxes for mixer
      if (breakType === 'mixer') {
        // Delete existing boxes if updating
        if (breakItem) {
          await supabase
            .from('break_boxes')
            .delete()
            .eq('break_id', breakId);
        }

        // Insert new boxes
        const validBoxes = boxes.filter(b =>
          b.price_paid_per_box &&
          parseFloat(b.price_paid_per_box) > 0 &&
          parseInt(b.quantity) > 0
        );

        if (validBoxes.length > 0) {
          const boxData = validBoxes.map((box, idx) => ({
            break_id: breakId,
            product_name: box.product_name || null,
            quantity: parseInt(box.quantity),
            price_paid_per_box: parseFloat(box.price_paid_per_box),
            position: idx,
          }));

          const { error: boxError } = await supabase
            .from('break_boxes')
            .insert(boxData);

          if (boxError) {
            console.error('[BRK_BOX_001] Failed to save break boxes:', boxError);
            alert(`Failed to save break boxes: ${boxError.message}`);
            return;
          }
        }
      }

      onSave();
    } catch (error) {
      console.error('[BRK_SAV_002] Unexpected error saving break:', error);
      alert('Unexpected error occurred while saving break');
    } finally {
      setLoading(false);
    }
  };

  const totalBoxCost = breakType === 'mixer'
    ? boxes.reduce((sum, box) => {
        const qty = parseInt(box.quantity) || 0;
        const price = parseFloat(box.price_paid_per_box) || 0;
        return sum + (qty * price);
      }, 0)
    : parseFloat(singleBoxCost) || 0;

  const isValid = title &&
    (breakType === 'mixer' ? boxes.some(b => b.price_paid_per_box && parseFloat(b.price_paid_per_box) > 0) : singleBoxCost) &&
    calculateSpotCount() > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{breakItem ? 'Edit Break' : 'Add Break'}</DialogTitle>
          <DialogDescription>
            Configure a break with multi-box support and breakeven calculation
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 py-4">
          {/* Left Column: Break Configuration */}
          <div className="col-span-2 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="break_title">Break Title</Label>
              <Input
                id="break_title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 2024 Prizm Football"
              />
            </div>

            {/* Break Style */}
            <div className="space-y-2">
              <Label htmlFor="break_style">Break Style</Label>
              <Select value={breakStyle} onValueChange={(v) => handleBreakStyleChange(v as BreakStyle)}>
                <SelectTrigger id="break_style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pyt">{BREAK_STYLE_LABELS.pyt}</SelectItem>
                  <SelectItem value="pyp">{BREAK_STYLE_LABELS.pyp}</SelectItem>
                  <SelectItem value="random_drafted">{BREAK_STYLE_LABELS.random_drafted}</SelectItem>
                </SelectContent>
              </Select>
              {breakStyle === 'pyp' && (
                <p className="text-xs text-warning-subtle">
                  PYP breaks are recommended for experienced breakers
                </p>
              )}
            </div>

            {/* Break Type */}
            <div className="space-y-2">
              <Label htmlFor="break_type">Break Type</Label>
              <Select value={breakType} onValueChange={(v) => setBreakType(v as BreakType)}>
                <SelectTrigger id="break_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_product">{BREAK_TYPE_LABELS.single_product}</SelectItem>
                  <SelectItem value="mixer">{BREAK_TYPE_LABELS.mixer}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Box Configuration */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <Label className="text-base font-semibold">Box Configuration</Label>

              {breakType === 'single_product' ? (
                <div className="space-y-2">
                  <Label htmlFor="single_box_cost">Box Cost</Label>
                  <Input
                    id="single_box_cost"
                    type="number"
                    step="0.01"
                    value={singleBoxCost}
                    onChange={(e) => setSingleBoxCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Boxes in this break</p>
                    <Button type="button" variant="outline" size="sm" onClick={addBox}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Box
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {boxes.map((box, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Label className="text-xs">Product</Label>
                          <Input
                            placeholder="e.g., Prizm Hobby"
                            value={box.product_name}
                            onChange={(e) => updateBox(index, 'product_name', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={box.quantity}
                            onChange={(e) => updateBox(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Price/Box</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={box.price_paid_per_box}
                            onChange={(e) => updateBox(index, 'price_paid_per_box', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          {boxes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBox(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t text-sm font-semibold flex justify-between">
                    <span>Total Box Cost:</span>
                    <span className="font-mono">${totalBoxCost.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Spot Configuration */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <Label className="text-base font-semibold">Spot Configuration</Label>

              {breakStyle === 'pyt' && (
                <div className="space-y-2">
                  <Label htmlFor="teams_count">Number of Teams</Label>
                  <Input
                    id="teams_count"
                    type="number"
                    value={teamsCount}
                    onChange={(e) => setTeamsCount(e.target.value)}
                    placeholder="30"
                  />
                  <p className="text-xs text-muted-foreground">Spots = {teamsCount || 30} teams</p>
                </div>
              )}

              {breakStyle === 'pyp' && (
                <div className="space-y-2">
                  <Label htmlFor="players_count">Number of Player Spots</Label>
                  <Input
                    id="players_count"
                    type="number"
                    value={playersCount}
                    onChange={(e) => setPlayersCount(e.target.value)}
                    placeholder="Enter number of players"
                  />
                </div>
              )}

              {breakStyle === 'random_drafted' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Spot Configuration</Label>
                    <Select value={spotConfigType} onValueChange={(v) => handleSpotConfigChange(v as 'TEAM_30' | 'THREE_TEAM_10' | 'CUSTOM')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEAM_30">Team Spots (30)</SelectItem>
                        <SelectItem value="THREE_TEAM_10">3-Team Spots (10)</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {spotConfigType === 'TEAM_30' && (
                    <div className="space-y-2">
                      <Label htmlFor="teams_custom">Number of Teams</Label>
                      <Input
                        id="teams_custom"
                        type="number"
                        value={teamsCount}
                        onChange={(e) => setTeamsCount(e.target.value)}
                        placeholder="30"
                      />
                    </div>
                  )}

                  {spotConfigType === 'CUSTOM' && (
                    <div className="space-y-2">
                      <Label htmlFor="custom_spots">Number of Spots</Label>
                      <Input
                        id="custom_spots"
                        type="number"
                        value={customSpotCount}
                        onChange={(e) => setCustomSpotCount(e.target.value)}
                        placeholder="Enter number of spots"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="break_notes">Notes (Optional)</Label>
              <Textarea
                id="break_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this break..."
                rows={2}
              />
            </div>
          </div>

          {/* Right Column: Advanced Settings */}
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <Label className="text-base font-semibold">Advanced Settings</Label>

              {/* Fee Rate Override */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use_custom_fee"
                    checked={useCustomFeeRate}
                    onCheckedChange={setUseCustomFeeRate}
                  />
                  <Label htmlFor="use_custom_fee" className="text-sm">Custom Fee Rate</Label>
                </div>
                {useCustomFeeRate && (
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={customFeeRate}
                      onChange={(e) => setCustomFeeRate(e.target.value)}
                      placeholder={(sessionFeeRate * 100).toFixed(1)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Default: {(sessionFeeRate * 100).toFixed(1)}%
                </p>
              </div>

              {/* Profit Target Override */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use_custom_profit"
                    checked={useCustomProfitTarget}
                    onCheckedChange={setUseCustomProfitTarget}
                  />
                  <Label htmlFor="use_custom_profit" className="text-sm">Custom Profit Target</Label>
                </div>
                {useCustomProfitTarget && (
                  <Input
                    type="number"
                    step="0.01"
                    value={customProfitTarget}
                    onChange={(e) => setCustomProfitTarget(e.target.value)}
                    placeholder="0.00"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Session target: ${sessionProfitTarget.toFixed(2)}
                </p>
              </div>

              {/* Expense Allocation */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include_expenses"
                    checked={includeExpenses}
                    onCheckedChange={setIncludeExpenses}
                  />
                  <Label htmlFor="include_expenses" className="text-sm">Include Expenses</Label>
                </div>

                {includeExpenses && (
                  <div className="space-y-2 pl-6">
                    <Label className="text-xs">Allocation Method</Label>
                    <Select value={allocationMethod} onValueChange={(v) => setAllocationMethod(v as ExpenseAllocationMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pro_rata_cost">{EXPENSE_ALLOCATION_METHOD_LABELS.pro_rata_cost}</SelectItem>
                        <SelectItem value="equal_per_break">{EXPENSE_ALLOCATION_METHOD_LABELS.equal_per_break}</SelectItem>
                        <SelectItem value="manual">{EXPENSE_ALLOCATION_METHOD_LABELS.manual}</SelectItem>
                      </SelectContent>
                    </Select>

                    {allocationMethod === 'manual' && (
                      <Input
                        type="number"
                        step="0.01"
                        value={manualExpense}
                        onChange={(e) => setManualExpense(e.target.value)}
                        placeholder="0.00"
                      />
                    )}

                    <p className="text-xs text-muted-foreground">
                      Session expenses: ${totalSessionExpenses.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || loading}>
            {loading ? 'Saving...' : breakItem ? 'Save Changes' : 'Add Break'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
