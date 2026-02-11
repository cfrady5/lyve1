'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, Upload, Copy, TrendingUp, TrendingDown, ShoppingCart, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardRow {
  id: string;
  cardName: string;
  certNumber: string;
  marketValue: number | '';
  notes: string;
}

const formatUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const roundToQuarter = (value: number): number => {
  return Math.floor(value * 4) / 4;
};

const roundToWholeDollar = (value: number): number => {
  return Math.floor(value);
};

const PLATFORMS = [
  { value: 'whatnot', label: 'Whatnot' },
  { value: 'ebay', label: 'eBay' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'show', label: 'Show/Event' },
  { value: 'other', label: 'Other' },
];

export default function CalculatorPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CardRow[]>([
    { id: crypto.randomUUID(), cardName: '', certNumber: '', marketValue: '', notes: '' },
  ]);
  const [percentToPay, setPercentToPay] = useState<number>(70);
  const [feesPercent, setFeesPercent] = useState<number>(0);
  const [roundToQuarterEnabled, setRoundToQuarterEnabled] = useState<boolean>(false);
  const [roundToWholeDollarEnabled, setRoundToWholeDollarEnabled] = useState<boolean>(false);
  const [pasteDialogOpen, setPasteDialogOpen] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Finalize purchase state
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState<boolean>(false);
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionPlatform, setSessionPlatform] = useState<string>('whatnot');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [finalizeError, setFinalizeError] = useState<string>('');
  const [finalizeSuccess, setFinalizeSuccess] = useState<boolean>(false);

  // Bulk operations state
  const [bulkAddCount, setBulkAddCount] = useState<number>(1);
  const [lotTotal, setLotTotal] = useState<string>('');

  const calculateOffer = useCallback((marketValue: number): number => {
    if (!marketValue || marketValue <= 0) return 0;

    const payMultiplier = percentToPay / 100;
    const feesMultiplier = 1 - (feesPercent / 100);
    let offer = marketValue * payMultiplier * feesMultiplier;

    if (roundToWholeDollarEnabled) {
      offer = roundToWholeDollar(offer);
    } else if (roundToQuarterEnabled) {
      offer = roundToQuarter(offer);
    }

    return offer;
  }, [percentToPay, feesPercent, roundToQuarterEnabled, roundToWholeDollarEnabled]);

  const addRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), cardName: '', certNumber: '', marketValue: '', notes: '' }]);
  };

  const deleteRow = (id: string) => {
    if (rows.length === 1) {
      setRows([{ id: crypto.randomUUID(), cardName: '', certNumber: '', marketValue: '', notes: '' }]);
    } else {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const updateRow = (id: string, field: keyof CardRow, value: string | number) => {
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const clearAll = () => {
    setRows([{ id: crypto.randomUUID(), cardName: '', certNumber: '', marketValue: '', notes: '' }]);
  };

  const handlePasteImport = () => {
    const lines = pasteText.split('\n').filter((line) => line.trim());
    const newRows: CardRow[] = [];

    lines.forEach((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length > 0) {
        const cardName = parts[0] || '';
        const certNumber = parts[1] || '';
        const marketValueStr = parts[2] || '';
        const notes = parts[3] || '';

        const marketValue = marketValueStr ? parseFloat(marketValueStr.replace(/[^0-9.]/g, '')) : '';

        newRows.push({
          id: crypto.randomUUID(),
          cardName,
          certNumber,
          marketValue: isNaN(marketValue as number) ? '' : marketValue,
          notes,
        });
      }
    });

    if (newRows.length > 0) {
      setRows(newRows);
    }
    setPasteText('');
    setPasteDialogOpen(false);
  };

  const handleBulkAdd = () => {
    if (bulkAddCount < 1 || bulkAddCount > 1000) {
      alert('Please enter a number between 1 and 1000');
      return;
    }

    const newRows: CardRow[] = [];
    for (let i = 0; i < bulkAddCount; i++) {
      newRows.push({
        id: crypto.randomUUID(),
        cardName: '',
        certNumber: '',
        marketValue: '',
        notes: '',
      });
    }

    setRows([...rows, ...newRows]);
    setBulkAddCount(1);
  };

  const handleLotTotalDistribute = () => {
    const total = parseFloat(lotTotal);
    if (isNaN(total) || total <= 0) {
      alert('Please enter a valid total amount');
      return;
    }

    if (rows.length === 0) {
      alert('Please add cards first');
      return;
    }

    // Distribute evenly across all current rows
    const valuePerCard = total / rows.length;
    const updatedRows = rows.map((row) => ({
      ...row,
      marketValue: Math.round(valuePerCard * 100) / 100, // Round to 2 decimals
    }));

    setRows(updatedRows);
    setLotTotal('');
  };

  const { totalMarket, totalOffer, cardCount, highestCard, lowestCard, validRows } = useMemo<{
    totalMarket: number;
    totalOffer: number;
    cardCount: number;
    highestCard: { name: string; value: number } | null;
    lowestCard: { name: string; value: number } | null;
    validRows: CardRow[];
  }>(() => {
    let totalMarket = 0;
    let totalOffer = 0;
    let cardCount = 0;
    let highestCard: { name: string; value: number } | null = null;
    let lowestCard: { name: string; value: number } | null = null;
    const validRows: CardRow[] = [];

    rows.forEach((row) => {
      const market = typeof row.marketValue === 'number' ? row.marketValue : 0;
      const hasData = row.cardName.trim() || market > 0;

      if (hasData) {
        validRows.push(row);

        if (market > 0) {
          totalMarket += market;
          totalOffer += calculateOffer(market);
          cardCount++;

          if (!highestCard || market > highestCard.value) {
            highestCard = { name: row.cardName || 'Unnamed', value: market };
          }
          if (!lowestCard || market < lowestCard.value) {
            lowestCard = { name: row.cardName || 'Unnamed', value: market };
          }
        }
      }
    });

    return { totalMarket, totalOffer, cardCount, highestCard, lowestCard, validRows };
  }, [rows, calculateOffer]);

  const canFinalize = validRows.length > 0;

  const handleOpenFinalizeDialog = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    setSessionName(`Purchase - ${today}`);
    setSessionPlatform('whatnot');
    setSessionNotes('');
    setFinalizeError('');
    setFinalizeSuccess(false);
    setFinalizeDialogOpen(true);
  };

  const handleFinalizePurchase = async () => {
    if (!sessionName.trim()) {
      setFinalizeError('Please enter a session name');
      return;
    }

    if (validRows.length === 0) {
      setFinalizeError('Please add at least one card with a name or market value');
      return;
    }

    setFinalizing(true);
    setFinalizeError('');

    try {
      const supabase = createClient();

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to finalize a purchase');
      }

      // 1. Create session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          name: sessionName.trim(),
          title: sessionName.trim(),
          platform: sessionPlatform,
          status: 'DRAFT',
          date: new Date().toISOString(),
          estimated_fee_rate: sessionPlatform === 'whatnot' ? 0.08 : sessionPlatform === 'ebay' ? 0.125 : 0.08,
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        throw new Error(`Failed to create session: ${sessionError.message}`);
      }

      // 2. Create inventory items for each valid row
      const inventoryItems = validRows.map((row) => {
        const market = typeof row.marketValue === 'number' ? row.marketValue : 0;
        const offer = calculateOffer(market);

        return {
          user_id: user.id,
          session_id: session.id,
          name: row.cardName.trim() || 'Unnamed Card',
          cert_number: row.certNumber.trim() || null,
          cost_basis: offer > 0 ? offer : market, // Use offer as cost basis (what they actually paid)
          estimated_value: market > 0 ? market : null, // Store original market value
          notes: row.notes.trim() || null,
          status: 'ACTIVE',
          acquired_at: new Date().toISOString(),
        };
      });

      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .insert(inventoryItems)
        .select();

      if (itemsError) {
        console.error('Items creation error:', itemsError);
        // Try to clean up session
        await supabase.from('sessions').delete().eq('id', session.id);
        throw new Error(`Failed to create items: ${itemsError.message}`);
      }

      // 3. Create session_items join records
      const sessionItems = items.map((item, index) => ({
        session_id: session.id,
        item_id: item.id,
        item_number: index + 1,
      }));

      const { error: joinError } = await supabase
        .from('session_items')
        .insert(sessionItems);

      if (joinError) {
        console.error('Session items join error:', joinError);
        // Items and session already created, just log the error
        console.warn('Items created but failed to link to session. They will still appear in inventory.');
      }

      // Success!
      setFinalizeSuccess(true);
      setFinalizing(false);

      // Wait a moment to show success state
      setTimeout(() => {
        setFinalizeDialogOpen(false);
        // Navigate to the new session
        router.push(`/sessions/${session.id}`);
      }, 1000);

    } catch (error) {
      console.error('Finalize purchase error:', error);
      setFinalizeError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setFinalizing(false);
    }
  };

  const copySummary = async () => {
    const effectivePayPercent = feesPercent > 0
      ? (percentToPay * (1 - feesPercent / 100)).toFixed(2)
      : percentToPay.toString();

    let summary = `Lyve Calculator Summary\n`;
    summary += `========================\n\n`;
    summary += `Pay Percentage: ${percentToPay}%`;
    if (feesPercent > 0) {
      summary += ` (${effectivePayPercent}% after ${feesPercent}% fees)`;
    }
    summary += `\n`;
    summary += `Total Cards: ${cardCount}\n`;
    summary += `Total Market Value: ${formatUSD(totalMarket)}\n`;
    summary += `Total Offer: ${formatUSD(totalOffer)}\n\n`;

    if (cardCount > 0) {
      summary += `Cards:\n`;
      summary += `------\n`;
      rows.forEach((row, index) => {
        const market = typeof row.marketValue === 'number' ? row.marketValue : 0;
        if (market > 0) {
          const offer = calculateOffer(market);
          summary += `${index + 1}. ${row.cardName || 'Unnamed'}`;
          if (row.certNumber) summary += ` (Cert: ${row.certNumber})`;
          summary += `\n   Market: ${formatUSD(market)} | Offer: ${formatUSD(offer)}`;
          if (row.notes) summary += `\n   Notes: ${row.notes}`;
          summary += `\n\n`;
        }
      });
    }

    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Lyve Calculator</h1>
        <p className="text-muted-foreground mt-1">
          Enter cards, market values, and your buy percentage to calculate offers.
        </p>
      </div>

      {/* Controls Card */}
      <Card>
        <CardHeader>
          <CardTitle>Calculation Settings</CardTitle>
          <CardDescription>Configure your buy percentage and rounding preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="percent-to-pay">Percent to Pay (%)</Label>
              <Input
                id="percent-to-pay"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={percentToPay}
                onChange={(e) => setPercentToPay(parseFloat(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees-percent">Fees (%) (Optional)</Label>
              <Input
                id="fees-percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={feesPercent}
                onChange={(e) => setFeesPercent(parseFloat(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="round-quarter">Round to nearest $0.25</Label>
                <p className="text-xs text-muted-foreground">Floor rounding to quarter dollar</p>
              </div>
              <Switch
                id="round-quarter"
                checked={roundToQuarterEnabled}
                onCheckedChange={setRoundToQuarterEnabled}
                disabled={roundToWholeDollarEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="round-whole">Round down to whole dollars</Label>
                <p className="text-xs text-muted-foreground">Overrides quarter rounding</p>
              </div>
              <Switch
                id="round-whole"
                checked={roundToWholeDollarEnabled}
                onCheckedChange={setRoundToWholeDollarEnabled}
              />
            </div>
          </div>

          {/* Bulk Operations */}
          <div className="border-t pt-6 space-y-4">
            <h4 className="text-sm font-medium">Bulk Operations</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bulk Add Cards */}
              <div className="space-y-2">
                <Label htmlFor="bulk-add">Add Multiple Cards</Label>
                <div className="flex gap-2">
                  <Input
                    id="bulk-add"
                    type="number"
                    min="1"
                    max="1000"
                    value={bulkAddCount}
                    onChange={(e) => setBulkAddCount(parseInt(e.target.value) || 1)}
                    placeholder="Number of cards"
                    className="flex-1"
                  />
                  <Button onClick={handleBulkAdd} variant="outline" className="shrink-0">
                    Add {bulkAddCount}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add multiple blank rows at once
                </p>
              </div>

              {/* Lot Total Distribution */}
              <div className="space-y-2">
                <Label htmlFor="lot-total">Lot Total Distribution</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input
                      id="lot-total"
                      type="number"
                      min="0"
                      step="0.01"
                      value={lotTotal}
                      onChange={(e) => setLotTotal(e.target.value)}
                      placeholder="Total amount"
                      className="pl-6"
                    />
                  </div>
                  <Button onClick={handleLotTotalDistribute} variant="outline" className="shrink-0">
                    Distribute
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Split total evenly across all {rows.length} card{rows.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cards</CardTitle>
              <CardDescription>Add and manage your card entries</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Paste Import
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Paste Import</DialogTitle>
                    <DialogDescription>
                      Paste CSV-like data. Format: Card Name, Cert Number, Market Value, Notes (one per line)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      placeholder="2023 Topps Chrome Ohtani, PSA123456, 150.00, Nice card&#10;2022 Prizm Mahomes, BGS987654, 200, Rookie&#10;..."
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setPasteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handlePasteImport}>Import</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear All
              </Button>
              <Button size="sm" onClick={addRow}>
                <Plus className="w-4 h-4 mr-2" />
                Add Card
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_120px_120px_150px_100px_40px] gap-3 pb-3 border-b font-medium text-sm">
                <div>Card Name</div>
                <div>Cert Number</div>
                <div>Market Value</div>
                <div>Notes</div>
                <div>Offer Value</div>
                <div></div>
              </div>

              {/* Table Rows */}
              <div className="space-y-2 mt-2">
                {rows.map((row) => {
                  const market = typeof row.marketValue === 'number' ? row.marketValue : 0;
                  const offer = calculateOffer(market);

                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1fr_120px_120px_150px_100px_40px] gap-3 items-center py-2 border-b border-border/50 hover:bg-accent/5 transition-colors"
                    >
                      <Input
                        placeholder="Card name"
                        value={row.cardName}
                        onChange={(e) => updateRow(row.id, 'cardName', e.target.value)}
                        className="h-9"
                      />
                      <Input
                        placeholder="Cert #"
                        value={row.certNumber}
                        onChange={(e) => updateRow(row.id, 'certNumber', e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={row.marketValue}
                        onChange={(e) =>
                          updateRow(row.id, 'marketValue', e.target.value ? parseFloat(e.target.value) : '')
                        }
                        className="h-9 font-mono text-sm"
                      />
                      <Input
                        placeholder="Optional notes"
                        value={row.notes}
                        onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                        className="h-9 text-sm"
                      />
                      <div className="font-mono text-sm font-medium">
                        {market > 0 ? formatUSD(offer) : '-'}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRow(row.id)}
                        className="h-9 w-9 p-0 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Empty State */}
              {rows.length === 1 && !rows[0].cardName && !rows[0].marketValue && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No cards added yet. Click &ldquo;Add Card&rdquo; or use &ldquo;Paste Import&rdquo; to get started.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Market Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUSD(totalMarket)}</div>
            <p className="text-xs text-muted-foreground mt-1">{cardCount} cards</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardDescription>Total Offer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatUSD(totalOffer)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {feesPercent > 0 ? `${(percentToPay * (1 - feesPercent / 100)).toFixed(1)}% after fees` : `${percentToPay}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Highest Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold flex items-center gap-2">
              {highestCard ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  {formatUSD(highestCard.value)}
                </>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            {highestCard && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{highestCard.name}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Lowest Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold flex items-center gap-2">
              {lowestCard ? (
                <>
                  <TrendingDown className="w-4 h-4 text-blue-500" />
                  {formatUSD(lowestCard.value)}
                </>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            {lowestCard && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{lowestCard.name}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Finalize Purchase Dialog */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalize Purchase</DialogTitle>
            <DialogDescription>
              Create a new session in Lyvefolio with these {validRows.length} card{validRows.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          {finalizeSuccess ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Purchase Finalized!</p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting to session...</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {/* Summary */}
                <Card className="bg-accent/50">
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cards:</span>
                      <span className="font-medium">{validRows.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Market Value:</span>
                      <span className="font-medium">{formatUSD(totalMarket)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Offer (Cost):</span>
                      <span className="font-medium text-primary">{formatUSD(totalOffer)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Session Details */}
                <div className="space-y-2">
                  <Label htmlFor="session-name">Session Name</Label>
                  <Input
                    id="session-name"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Purchase - Dec 15, 2024"
                    disabled={finalizing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-platform">Platform</Label>
                  <Select value={sessionPlatform} onValueChange={setSessionPlatform} disabled={finalizing}>
                    <SelectTrigger id="session-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((platform) => (
                        <SelectItem key={platform.value} value={platform.value}>
                          {platform.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-notes">Notes (Optional)</Label>
                  <Textarea
                    id="session-notes"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Add any notes about this purchase..."
                    rows={3}
                    disabled={finalizing}
                  />
                </div>

                {finalizeError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{finalizeError}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setFinalizeDialogOpen(false)}
                  disabled={finalizing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFinalizePurchase}
                  disabled={finalizing || !sessionName.trim()}
                >
                  {finalizing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Finalize and Import
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Total Offer</p>
                <p className="text-2xl font-bold text-primary">{formatUSD(totalOffer)}</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-muted-foreground">Market Value</p>
                <p className="text-lg font-medium">{formatUSD(totalMarket)}</p>
              </div>
              <div className="hidden md:block">
                <Badge variant="secondary" className="text-sm">
                  {cardCount} cards
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={copySummary}
                variant="outline"
                className={cn(copySuccess && 'bg-green-600 hover:bg-green-700 text-white')}
              >
                <Copy className="w-4 h-4 mr-2" />
                {copySuccess ? 'Copied!' : 'Copy Summary'}
              </Button>
              <Button
                onClick={handleOpenFinalizeDialog}
                disabled={!canFinalize}
                size="lg"
                className="gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Finalize Purchase</span>
                <span className="sm:hidden">Finalize</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
