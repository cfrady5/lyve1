'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Upload, DollarSign, FileText, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Session, SessionItem } from '@/lib/types/sessions';

interface PostShowReconciliationProps {
  session: Session;
  items: SessionItem[];
  inventoryCost: number;
  breaksCost: number;
  totalExpenses: number;
  onReconciled: () => void;
}

interface ColumnMapping {
  itemNumber: number | null;
  name: number | null;
  soldPrice: number | null;
  fees: number | null;
  taxes: number | null;
  shipping: number | null;
  buyer: number | null;
  channel: number | null;
}

interface ParsedSaleRow {
  rowNumber: number;
  values: string[];
  mapped: {
    itemNumber?: number;
    name?: string;
    soldPrice?: number;
    fees?: number;
    taxes?: number;
    shipping?: number;
    buyer?: string;
    channel?: string;
  };
  matched: boolean;
  matchedItem?: SessionItem;
  errors: string[];
}

export function PostShowReconciliation({
  session,
  items,
  breaksCost,
  totalExpenses,
  onReconciled,
}: PostShowReconciliationProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'completed'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    itemNumber: null,
    name: null,
    soldPrice: null,
    fees: null,
    taxes: null,
    shipping: null,
    buyer: null,
    channel: null,
  });
  const [parsedRows, setParsedRows] = useState<ParsedSaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pnl, setPnl] = useState<{
    totalRevenue: number;
    totalFees: number;
    totalTaxes: number;
    totalShipping: number;
    totalCOGS: number;
    netProfit: number;
    profitMargin: number;
    soldCount: number;
    unsoldCount: number;
    sellThroughRate: number;
  } | null>(null);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('[CSV_PARSE_001] CSV must have at least a header row and one data row');
        return;
      }

      // Parse headers
      const parsedHeaders = parseCSVLine(lines[0]);
      setHeaders(parsedHeaders);

      // Parse data rows
      const dataRows = lines.slice(1).map(line => parseCSVLine(line));
      setRawRows(dataRows);

      // Auto-detect column mappings
      const autoMapping: ColumnMapping = {
        itemNumber: null,
        name: null,
        soldPrice: null,
        fees: null,
        taxes: null,
        shipping: null,
        buyer: null,
        channel: null,
      };

      parsedHeaders.forEach((header, idx) => {
        const h = header.toLowerCase();

        if ((h.includes('item') && (h.includes('number') || h.includes('#') || h.includes('num'))) || h === 'item#') {
          autoMapping.itemNumber = idx;
        } else if (h.includes('name') || h.includes('title') || h.includes('description')) {
          autoMapping.name = idx;
        } else if (h.includes('price') || h.includes('sold') || h.includes('amount') || h.includes('total')) {
          autoMapping.soldPrice = idx;
        } else if (h.includes('fee')) {
          autoMapping.fees = idx;
        } else if (h.includes('tax')) {
          autoMapping.taxes = idx;
        } else if (h.includes('ship')) {
          autoMapping.shipping = idx;
        } else if (h.includes('buyer') || h.includes('customer')) {
          autoMapping.buyer = idx;
        } else if (h.includes('channel') || h.includes('platform')) {
          autoMapping.channel = idx;
        }
      });

      setColumnMapping(autoMapping);
      setStep('map');
    } catch (err) {
      console.error('[CSV_PARSE_002] Error parsing CSV:', err);
      alert('[CSV_PARSE_002] Failed to parse CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleColumnMappingChange = (field: keyof ColumnMapping, value: string) => {
    const idx = value === 'none' ? null : parseInt(value);
    setColumnMapping(prev => ({ ...prev, [field]: idx }));
  };

  const handlePreview = () => {
    const rows: ParsedSaleRow[] = rawRows.map((values, idx) => {
      const errors: string[] = [];

      // Extract mapped values
      const itemNumberStr = columnMapping.itemNumber !== null ? values[columnMapping.itemNumber] : undefined;
      const name = columnMapping.name !== null ? values[columnMapping.name] : undefined;
      const soldPriceStr = columnMapping.soldPrice !== null ? values[columnMapping.soldPrice] : undefined;
      const feesStr = columnMapping.fees !== null ? values[columnMapping.fees] : undefined;
      const taxesStr = columnMapping.taxes !== null ? values[columnMapping.taxes] : undefined;
      const shippingStr = columnMapping.shipping !== null ? values[columnMapping.shipping] : undefined;
      const buyer = columnMapping.buyer !== null ? values[columnMapping.buyer] : undefined;
      const channel = columnMapping.channel !== null ? values[columnMapping.channel] : undefined;

      // Parse numbers
      const itemNumber = itemNumberStr ? parseInt(itemNumberStr) : undefined;
      const soldPrice = soldPriceStr ? parseFloat(soldPriceStr.replace(/[$,]/g, '')) : undefined;
      const fees = feesStr ? parseFloat(feesStr.replace(/[$,]/g, '')) : 0;
      const taxes = taxesStr ? parseFloat(taxesStr.replace(/[$,]/g, '')) : 0;
      const shipping = shippingStr ? parseFloat(shippingStr.replace(/[$,]/g, '')) : 0;

      // Validation
      if (!soldPrice || soldPrice <= 0 || isNaN(soldPrice)) {
        errors.push('Missing or invalid sold price');
      }

      // Try to match to session item
      let matchedItem: SessionItem | undefined;
      let matched = false;

      if (itemNumber) {
        matchedItem = items.find(item => item.item_number === itemNumber);
        if (matchedItem) {
          matched = true;
        } else {
          errors.push(`Item #${itemNumber} not found in session`);
        }
      } else {
        errors.push('Missing item number');
      }

      return {
        rowNumber: idx + 2, // +2 because row 1 is header
        values,
        mapped: {
          itemNumber,
          name,
          soldPrice,
          fees,
          taxes,
          shipping,
          buyer,
          channel: channel || session.platform,
        },
        matched,
        matchedItem,
        errors,
      };
    });

    setParsedRows(rows);
    setStep('preview');
  };

  const handleApplyReconciliation = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const validRows = parsedRows.filter(r => r.matched && r.matchedItem && r.mapped.soldPrice);

      if (validRows.length === 0) {
        alert('[REC_APP_001] No valid matched sales to apply');
        return;
      }

      // Create sales records and update item statuses
      for (const row of validRows) {
        const item = row.matchedItem!;
        const netProfit =
          (row.mapped.soldPrice || 0) -
          (row.mapped.fees || 0) -
          (row.mapped.taxes || 0) -
          (row.mapped.shipping || 0) -
          (item.item?.cost_basis || 0);

        // Create sale record
        const { error: saleError } = await supabase
          .from('sales')
          .insert({
            user_id: session.user_id,
            item_id: item.item_id,
            session_id: session.id,
            channel: row.mapped.channel || session.platform,
            sold_price: row.mapped.soldPrice,
            fees: row.mapped.fees || 0,
            taxes: row.mapped.taxes || 0,
            shipping: row.mapped.shipping || 0,
            net_profit: netProfit,
            sold_at: new Date().toISOString(),
          });

        if (saleError) {
          console.error('[REC_APP_002] Failed to create sale record:', saleError);
          alert(`[REC_APP_002] Failed to create sale record for item #${row.mapped.itemNumber}: ${saleError.message}`);
          return;
        }

        // Update item status to SOLD
        const { error: itemError } = await supabase
          .from('inventory_items')
          .update({
            status: 'SOLD',
            lifecycle_status: 'sold',
          })
          .eq('id', item.item_id);

        if (itemError) {
          console.error('[REC_APP_003] Failed to update item status:', itemError);
          // Don't abort, just log the error
        }
      }

      // Update session status to RECONCILED
      const { error: sessionError } = await supabase
        .from('sessions')
        .update({
          status: 'RECONCILED',
          reconciled_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (sessionError) {
        console.error('[REC_APP_004] Failed to update session status:', sessionError);
        alert(`[REC_APP_004] Failed to update session status: ${sessionError.message}`);
        return;
      }

      // Calculate P&L
      const totalRevenue = validRows.reduce((sum, r) => sum + (r.mapped.soldPrice || 0), 0);
      const totalFees = validRows.reduce((sum, r) => sum + (r.mapped.fees || 0), 0);
      const totalTaxes = validRows.reduce((sum, r) => sum + (r.mapped.taxes || 0), 0);
      const totalShipping = validRows.reduce((sum, r) => sum + (r.mapped.shipping || 0), 0);
      const totalCOGS = validRows.reduce((sum, r) => sum + (r.matchedItem?.item?.cost_basis || 0), 0);
      const totalCosts = totalCOGS + breaksCost + totalExpenses;
      const netProfit = totalRevenue - totalFees - totalTaxes - totalShipping - totalCosts;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const soldCount = validRows.length;
      const unsoldCount = items.length - soldCount;
      const sellThroughRate = items.length > 0 ? (soldCount / items.length) * 100 : 0;

      setPnl({
        totalRevenue,
        totalFees,
        totalTaxes,
        totalShipping,
        totalCOGS: totalCosts,
        netProfit,
        profitMargin,
        soldCount,
        unsoldCount,
        sellThroughRate,
      });

      setStep('completed');
      onReconciled();
    } catch (err) {
      console.error('[REC_APP_005] Unexpected error applying reconciliation:', err);
      alert('[REC_APP_005] Unexpected error occurred while applying reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedRows.filter(r => r.matched).length;
  const invalidCount = parsedRows.filter(r => !r.matched).length;

  if (step === 'completed' && pnl) {
    return (
      <div className="space-y-6">
        <Card className="border border-success-subtle bg-success-subtle">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-success-subtle" />
                <div>
                  <CardTitle className="text-success-subtle">Show Reconciled Successfully!</CardTitle>
                  <CardDescription className="text-success-subtle">
                    {pnl.soldCount} items sold, {pnl.unsoldCount} unsold
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild size="lg" variant="outline">
                  <Link href="/insights">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View in Insights
                  </Link>
                </Button>
                <Button asChild size="lg">
                  <Link href={`/sessions/${session.id}/report`}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Report
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Session P&L Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                  <span className="font-mono font-semibold">${pnl.totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Platform Fees</span>
                  <span className="font-mono text-danger-subtle">-${pnl.totalFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Taxes</span>
                  <span className="font-mono text-danger-subtle">-${pnl.totalTaxes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Shipping</span>
                  <span className="font-mono text-danger-subtle">-${pnl.totalShipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total COGS + Expenses</span>
                  <span className="font-mono text-danger-subtle">-${pnl.totalCOGS.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-primary text-primary-foreground rounded-lg">
                  <p className="text-sm opacity-90">Net Profit</p>
                  <p className="text-3xl font-mono font-bold">
                    ${pnl.netProfit.toFixed(2)}
                  </p>
                  <p className="text-sm opacity-90 mt-1">
                    {pnl.profitMargin.toFixed(1)}% margin
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Sold</p>
                    <p className="text-xl font-bold">{pnl.soldCount}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Unsold</p>
                    <p className="text-xl font-bold">{pnl.unsoldCount}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg col-span-2">
                    <p className="text-xs text-muted-foreground">Sell-Through Rate</p>
                    <p className="text-xl font-bold">{pnl.sellThroughRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Preview Sales Data</CardTitle>
            <CardDescription>
              Review matched sales before finalizing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="default" className="bg-green-600">
                {validCount} matched
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">
                  {invalidCount} unmatched
                </Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Row</TableHead>
                    <TableHead className="w-[80px]">Item #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[100px]">Sold Price</TableHead>
                    <TableHead className="w-[80px]">Fees</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow key={row.rowNumber} className={!row.matched ? 'bg-danger-subtle' : ''}>
                      <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                      <TableCell className="font-mono">{row.mapped.itemNumber || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.matchedItem?.item?.display_name || row.mapped.name || '—'}
                      </TableCell>
                      <TableCell className="font-mono">
                        ${row.mapped.soldPrice?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        ${row.mapped.fees?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell>
                        {row.matched ? (
                          <Badge variant="outline" className="text-success-subtle border-success-subtle">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Matched
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            {row.errors[0] || 'No match'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {invalidCount > 0 && (
              <div className="p-3 bg-warning-subtle border border-warning-subtle rounded-lg text-sm">
                <p className="font-semibold text-warning-subtle">
                  {invalidCount} unmatched row{invalidCount !== 1 ? 's' : ''}
                </p>
                <p className="text-warning-subtle text-xs mt-1">
                  Unmatched rows will be skipped. Only matched sales will be recorded.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('map')}>
            Back to Mapping
          </Button>
          <Button onClick={handleApplyReconciliation} disabled={validCount === 0 || loading}>
            {loading ? 'Processing...' : `Apply Reconciliation (${validCount} sales)`}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'map') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Map CSV Columns</CardTitle>
            <CardDescription>
              Assign your CSV columns to the corresponding fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-info-subtle border border-info-subtle p-4 rounded-lg">
              <p className="text-sm font-semibold text-info-subtle mb-2">Column Mapping</p>
              <p className="text-sm text-info-subtle">
                We detected {headers.length} columns. Map them to the corresponding fields below.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Item Number */}
              <div className="space-y-2">
                <Label htmlFor="map_item_number" className="flex items-center gap-2">
                  Item Number <Badge variant="destructive" className="text-xs">Required</Badge>
                </Label>
                <Select
                  value={columnMapping.itemNumber !== null ? columnMapping.itemNumber.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('itemNumber', val)}
                >
                  <SelectTrigger id="map_item_number">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sold Price */}
              <div className="space-y-2">
                <Label htmlFor="map_sold_price" className="flex items-center gap-2">
                  Sold Price <Badge variant="destructive" className="text-xs">Required</Badge>
                </Label>
                <Select
                  value={columnMapping.soldPrice !== null ? columnMapping.soldPrice.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('soldPrice', val)}
                >
                  <SelectTrigger id="map_sold_price">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="map_name" className="flex items-center gap-2">
                  Item Name <Badge variant="outline" className="text-xs">Optional</Badge>
                </Label>
                <Select
                  value={columnMapping.name !== null ? columnMapping.name.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('name', val)}
                >
                  <SelectTrigger id="map_name">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fees */}
              <div className="space-y-2">
                <Label htmlFor="map_fees" className="flex items-center gap-2">
                  Fees <Badge variant="outline" className="text-xs">Optional</Badge>
                </Label>
                <Select
                  value={columnMapping.fees !== null ? columnMapping.fees.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('fees', val)}
                >
                  <SelectTrigger id="map_fees">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped (will be 0) --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Taxes */}
              <div className="space-y-2">
                <Label htmlFor="map_taxes" className="flex items-center gap-2">
                  Taxes <Badge variant="outline" className="text-xs">Optional</Badge>
                </Label>
                <Select
                  value={columnMapping.taxes !== null ? columnMapping.taxes.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('taxes', val)}
                >
                  <SelectTrigger id="map_taxes">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped (will be 0) --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Shipping */}
              <div className="space-y-2">
                <Label htmlFor="map_shipping" className="flex items-center gap-2">
                  Shipping <Badge variant="outline" className="text-xs">Optional</Badge>
                </Label>
                <Select
                  value={columnMapping.shipping !== null ? columnMapping.shipping.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('shipping', val)}
                >
                  <SelectTrigger id="map_shipping">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped (will be 0) --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Buyer */}
              <div className="space-y-2">
                <Label htmlFor="map_buyer" className="flex items-center gap-2">
                  Buyer <Badge variant="outline" className="text-xs">Optional</Badge>
                </Label>
                <Select
                  value={columnMapping.buyer !== null ? columnMapping.buyer.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('buyer', val)}
                >
                  <SelectTrigger id="map_buyer">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Channel */}
              <div className="space-y-2">
                <Label htmlFor="map_channel" className="flex items-center gap-2">
                  Channel/Platform <Badge variant="outline" className="text-xs">Optional</Badge>
                </Label>
                <Select
                  value={columnMapping.channel !== null ? columnMapping.channel.toString() : 'none'}
                  onValueChange={(val) => handleColumnMappingChange('channel', val)}
                >
                  <SelectTrigger id="map_channel">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped (use session platform) --</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Column {idx + 1}: {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview first 3 rows */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-semibold mb-2">Preview (first 3 rows):</p>
              <div className="space-y-2 text-sm">
                {rawRows.slice(0, 3).map((row, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 p-2 bg-background rounded border">
                    <div>
                      <span className="text-xs text-muted-foreground">Item #:</span>
                      <p className="font-mono truncate">
                        {columnMapping.itemNumber !== null ? row[columnMapping.itemNumber] : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Sold Price:</span>
                      <p className="font-mono truncate">
                        {columnMapping.soldPrice !== null ? row[columnMapping.soldPrice] : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Fees:</span>
                      <p className="font-mono truncate">
                        {columnMapping.fees !== null ? row[columnMapping.fees] : '$0.00'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Buyer:</span>
                      <p className="font-mono truncate">
                        {columnMapping.buyer !== null ? row[columnMapping.buyer] : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('upload')}>
            Back
          </Button>
          <Button
            onClick={handlePreview}
            disabled={columnMapping.itemNumber === null || columnMapping.soldPrice === null}
          >
            Preview & Match Sales
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Sales Report
        </CardTitle>
        <CardDescription>
          Upload your platform&apos;s sales export CSV to reconcile this session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sales_csv">Sales Report CSV</Label>
          <Input
            id="sales_csv"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={loading}
          />
        </div>

        <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
          <p className="font-semibold mb-2">CSV Requirements:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>First row should contain column headers</li>
            <li>Required: Item Number and Sold Price columns</li>
            <li>Optional: Fees, Taxes, Shipping, Buyer, Channel</li>
            <li>Example: &quot;Item #, Name, Sold Price, Fees, Buyer&quot;</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
