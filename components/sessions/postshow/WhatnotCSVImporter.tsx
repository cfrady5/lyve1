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
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, XCircle, Upload, AlertTriangle, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Session, SessionItem } from '@/lib/types/sessions';

interface WhatnotCSVImporterProps {
  session: Session;
  items: SessionItem[];
  onReconciled: () => void;
}

interface ParsedCSVRow {
  rowNumber: number;
  rawData: Record<string, string>;
  orderId?: string;
  orderNumericId?: string;
  buyer?: string;
  productName?: string;
  quantity: number;
  soldPrice?: number;
  placedAt?: string;
  cancelledOrFailed: boolean;
  trackingNumber?: string;
  sku?: string;
  extractedItemNumber?: number;
}

interface ReconciliationRow {
  itemNumber: number;
  sessionItem: SessionItem;
  csvRow?: ParsedCSVRow;
  matchStatus: 'matched' | 'missing' | 'duplicate' | 'unparsed' | 'cancelled';
  errors: string[];
  fees: number;
  taxes: number;
  netProfit: number;
}

export function WhatnotCSVImporter({ session, items, onReconciled }: WhatnotCSVImporterProps) {
  const [step, setStep] = useState<'upload' | 'reconcile' | 'completed'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedCSVRow[]>([]);
  const [reconciliationRows, setReconciliationRows] = useState<ReconciliationRow[]>([]);
  const [useRowOrderMatching, setUseRowOrderMatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    totalRows: number;
    cancelledRows: number;
    matchedCount: number;
    unmatchedCount: number;
    duplicatesCount: number;
  } | null>(null);

  // Extract item number from product name
  const extractItemNumber = (productName: string): number | undefined => {
    if (!productName) return undefined;

    // Try patterns in order of specificity:
    // 1. "SINGLES #1", "Singles #12", "SINGLES#12"
    const singlesMatch = productName.match(/singles\s*#\s*(\d+)/i);
    if (singlesMatch) return parseInt(singlesMatch[1]);

    // 2. "ITEM #1", "Item #12", "ITEM#12"
    const itemMatch = productName.match(/item\s*#\s*(\d+)/i);
    if (itemMatch) return parseInt(itemMatch[1]);

    // 3. Generic "#123" at the end
    const genericMatch = productName.match(/#\s*(\d+)$/);
    if (genericMatch) return parseInt(genericMatch[1]);

    // 4. Just digits at the end "Item 12"
    const digitsMatch = productName.match(/\s+(\d+)$/);
    if (digitsMatch) return parseInt(digitsMatch[1]);

    return undefined;
  };

  // Parse sold price from string
  const parseSoldPrice = (value: string): number | undefined => {
    if (!value) return undefined;
    const cleaned = value.replace(/[$,]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  };

  // Check if order is cancelled
  const isCancelled = (value: string): boolean => {
    if (!value) return false;
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'cancelled' || lower === 'failed';
  };

  // Parse CSV line
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
      const parsedHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

      // Find column indices
      const getColIndex = (patterns: string[]) => {
        return parsedHeaders.findIndex(h => patterns.some(p => h.includes(p)));
      };

      const orderIdIdx = getColIndex(['order id']);
      const orderNumericIdIdx = getColIndex(['order numeric id']);
      const buyerIdx = getColIndex(['buyer', 'customer']);
      const productNameIdx = getColIndex(['product name', 'title', 'item']);
      const quantityIdx = getColIndex(['quantity', 'qty']);
      const soldPriceIdx = getColIndex(['sold price', 'price', 'total']);
      const placedAtIdx = getColIndex(['placed at', 'date', 'timestamp']);
      const cancelledIdx = getColIndex(['cancelled', 'failed']);
      const trackingIdx = getColIndex(['tracking']);
      const skuIdx = getColIndex(['sku']);

      // Parse data rows
      const parsed: ParsedCSVRow[] = lines.slice(1).map((line, idx) => {
        const values = parseCSVLine(line);
        const rawData: Record<string, string> = {};
        parsedHeaders.forEach((header, i) => {
          rawData[header] = values[i] || '';
        });

        const productName = productNameIdx >= 0 ? values[productNameIdx] : undefined;
        const soldPriceStr = soldPriceIdx >= 0 ? values[soldPriceIdx] : undefined;
        const cancelledStr = cancelledIdx >= 0 ? values[cancelledIdx] : '';
        const quantityStr = quantityIdx >= 0 ? values[quantityIdx] : '1';

        return {
          rowNumber: idx + 2, // +2 for header
          rawData,
          orderId: orderIdIdx >= 0 ? values[orderIdIdx] : undefined,
          orderNumericId: orderNumericIdIdx >= 0 ? values[orderNumericIdIdx] : undefined,
          buyer: buyerIdx >= 0 ? values[buyerIdx] : undefined,
          productName,
          quantity: parseInt(quantityStr) || 1,
          soldPrice: parseSoldPrice(soldPriceStr || ''),
          placedAt: placedAtIdx >= 0 ? values[placedAtIdx] : undefined,
          cancelledOrFailed: isCancelled(cancelledStr),
          trackingNumber: trackingIdx >= 0 ? values[trackingIdx] : undefined,
          sku: skuIdx >= 0 ? values[skuIdx] : undefined,
          extractedItemNumber: productName ? extractItemNumber(productName) : undefined,
        };
      });

      setParsedRows(parsed);

      // Calculate import summary
      const totalRows = parsed.length;
      const cancelledRows = parsed.filter(r => r.cancelledOrFailed).length;

      setImportSummary({
        totalRows,
        cancelledRows,
        matchedCount: 0,
        unmatchedCount: 0,
        duplicatesCount: 0,
      });

      setStep('reconcile');
    } catch (err) {
      console.error('[CSV_PARSE_002] Error parsing CSV:', err);
      alert('[CSV_PARSE_002] Failed to parse CSV file');
    } finally {
      setLoading(false);
    }
  };

  const performMatching = () => {
    const reconciliation: ReconciliationRow[] = [];
    const csvRowsByItemNumber = new Map<number, ParsedCSVRow[]>();

    // Group CSV rows by extracted item number (excluding cancelled)
    parsedRows.forEach(row => {
      if (row.cancelledOrFailed) return;
      if (row.extractedItemNumber !== undefined) {
        const existing = csvRowsByItemNumber.get(row.extractedItemNumber) || [];
        existing.push(row);
        csvRowsByItemNumber.set(row.extractedItemNumber, existing);
      }
    });

    // Create reconciliation rows for each session item
    items.forEach(sessionItem => {
      const itemNumber = sessionItem.item_number;
      const errors: string[] = [];
      let matchStatus: ReconciliationRow['matchStatus'] = 'missing';
      let csvRow: ParsedCSVRow | undefined;

      if (useRowOrderMatching) {
        // Row-order matching: row 1 -> item 1
        const rowIdx = itemNumber - 1;
        const potentialRow = parsedRows[rowIdx];
        if (potentialRow && !potentialRow.cancelledOrFailed) {
          csvRow = potentialRow;
          matchStatus = 'matched';
        }
      } else {
        // Smart matching by extracted item number
        const matchingRows = csvRowsByItemNumber.get(itemNumber) || [];

        if (matchingRows.length === 1) {
          csvRow = matchingRows[0];
          matchStatus = 'matched';
        } else if (matchingRows.length > 1) {
          csvRow = matchingRows[0]; // Take first for now
          matchStatus = 'duplicate';
          errors.push(`${matchingRows.length} CSV rows match this item number`);
        } else {
          matchStatus = 'missing';
        }
      }

      // Calculate fees and taxes
      const soldPrice = csvRow?.soldPrice || 0;
      const feeRate = session.estimated_fee_rate || 0.12;
      const taxRate = session.tax_rate_default || 0;
      const fees = soldPrice * feeRate;
      const taxes = soldPrice * taxRate;
      const costBasis = sessionItem.item?.cost_basis || 0;
      const netProfit = soldPrice - fees - taxes - costBasis;

      reconciliation.push({
        itemNumber,
        sessionItem,
        csvRow,
        matchStatus,
        errors,
        fees,
        taxes,
        netProfit,
      });
    });

    setReconciliationRows(reconciliation);

    // Update summary
    const matchedCount = reconciliation.filter(r => r.matchStatus === 'matched').length;
    const duplicatesCount = reconciliation.filter(r => r.matchStatus === 'duplicate').length;
    const unmatchedCount = reconciliation.filter(r => r.matchStatus === 'missing').length;

    setImportSummary(prev => prev ? {
      ...prev,
      matchedCount,
      unmatchedCount,
      duplicatesCount,
    } : null);
  };

  // Perform matching whenever rows or matching mode changes
  useState(() => {
    if (parsedRows.length > 0) {
      performMatching();
    }
  });

  const handleApplyReconciliation = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const validRows = reconciliationRows.filter(r =>
        r.matchStatus === 'matched' && r.csvRow && r.csvRow.soldPrice
      );

      if (validRows.length === 0) {
        alert('[REC_APP_001] No valid matched sales to apply');
        return;
      }

      // Create sales records
      for (const row of validRows) {
        const csvRow = row.csvRow!;

        const { error: saleError } = await supabase
          .from('sales')
          .insert({
            user_id: session.user_id,
            item_id: row.sessionItem.item_id,
            session_id: session.id,
            channel: session.platform,
            sold_price: csvRow.soldPrice,
            fees: row.fees,
            taxes: row.taxes,
            shipping: 0,
            net_profit: row.netProfit,
            sold_at: csvRow.placedAt || new Date().toISOString(),
          });

        if (saleError) {
          console.error('[REC_APP_002] Failed to create sale record:', saleError);
          alert(`[REC_APP_002] Failed to create sale for item #${row.itemNumber}: ${saleError.message}`);
          return;
        }

        // Update item status
        const { error: itemError } = await supabase
          .from('inventory_items')
          .update({
            status: 'SOLD',
            lifecycle_status: 'sold',
          })
          .eq('id', row.sessionItem.item_id);

        if (itemError) {
          console.error('[REC_APP_003] Failed to update item status:', itemError);
        }
      }

      // Update session status
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

      setStep('completed');
      onReconciled();
    } catch (err) {
      console.error('[REC_APP_005] Unexpected error applying reconciliation:', err);
      alert('[REC_APP_005] Unexpected error occurred during reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const handleShiftMapping = (direction: 'up' | 'down') => {
    // Shift all mappings by 1
    const shift = direction === 'up' ? -1 : 1;
    setReconciliationRows(prevRows =>
      prevRows.map(row => {
        const newItemNumber = row.itemNumber + shift;
        const newSessionItem = items.find(i => i.item_number === newItemNumber);
        if (!newSessionItem) return row;

        return {
          ...row,
          itemNumber: newItemNumber,
          sessionItem: newSessionItem,
        };
      })
    );
  };

  const handleManualAssignment = (itemNumber: number, csvRowNumber: number) => {
    const csvRow = parsedRows.find(r => r.rowNumber === csvRowNumber);
    if (!csvRow) return;

    setReconciliationRows(prevRows =>
      prevRows.map(row => {
        if (row.itemNumber !== itemNumber) return row;

        const soldPrice = csvRow.soldPrice || 0;
        const feeRate = session.estimated_fee_rate || 0.12;
        const taxRate = session.tax_rate_default || 0;
        const fees = soldPrice * feeRate;
        const taxes = soldPrice * taxRate;
        const costBasis = row.sessionItem.item?.cost_basis || 0;
        const netProfit = soldPrice - fees - taxes - costBasis;

        return {
          ...row,
          csvRow,
          matchStatus: 'matched' as const,
          fees,
          taxes,
          netProfit,
        };
      })
    );
  };

  if (step === 'completed') {
    return (
      <Card className="border border-success-subtle bg-success-subtle">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-success-subtle" />
              <div>
                <CardTitle className="text-success-subtle">Reconciliation Complete!</CardTitle>
                <CardDescription className="text-success-subtle">
                  {importSummary?.matchedCount} items reconciled successfully
                </CardDescription>
              </div>
            </div>
            <Button asChild size="lg">
              <Link href={`/sessions/${session.id}/report`}>
                <FileText className="h-4 w-4 mr-2" />
                View Report
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (step === 'reconcile') {
    const validCount = reconciliationRows.filter(r => r.matchStatus === 'matched').length;
    const duplicateCount = reconciliationRows.filter(r => r.matchStatus === 'duplicate').length;
    const missingCount = reconciliationRows.filter(r => r.matchStatus === 'missing').length;

    return (
      <div className="space-y-4">
        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Import Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{importSummary?.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total CSV Rows</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{validCount}</p>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{missingCount}</p>
                <p className="text-xs text-muted-foreground">Missing</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{duplicateCount}</p>
                <p className="text-xs text-muted-foreground">Duplicates</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{importSummary?.cancelledRows}</p>
                <p className="text-xs text-muted-foreground">Cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Matching Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matching Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={useRowOrderMatching}
                  onCheckedChange={(checked) => {
                    setUseRowOrderMatching(checked);
                    setTimeout(performMatching, 0);
                  }}
                />
                <Label>Use row-order matching (fallback)</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleShiftMapping('up')}>
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Shift Up
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleShiftMapping('down')}>
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Shift Down
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {useRowOrderMatching
                ? 'Matching CSV rows to items by position (Row 1 → Item #1, etc.)'
                : 'Smart matching by extracting item numbers from product names'
              }
            </p>
          </CardContent>
        </Card>

        {/* Reconciliation Table */}
        <Card>
          <CardHeader>
            <CardTitle>Review Matches</CardTitle>
            <CardDescription>Verify sales alignment before applying</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Item #</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="w-[100px]">Cost Basis</TableHead>
                    <TableHead className="w-[120px]">Sold Price</TableHead>
                    <TableHead className="w-[100px]">Net Profit</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliationRows.map((row) => (
                    <TableRow
                      key={row.itemNumber}
                      className={
                        row.matchStatus === 'missing' ? 'bg-danger-subtle' :
                        row.matchStatus === 'duplicate' ? 'bg-warning-subtle' :
                        ''
                      }
                    >
                      <TableCell className="font-mono font-bold">#{row.itemNumber}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.sessionItem.item?.display_name || row.sessionItem.item?.name || '—'}
                      </TableCell>
                      <TableCell className="font-mono">
                        ${(row.sessionItem.item?.cost_basis || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {row.csvRow ? `$${row.csvRow.soldPrice?.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className={`font-mono ${row.netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${row.netProfit.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {row.matchStatus === 'matched' && (
                          <Badge variant="outline" className="text-success-subtle border-success-subtle">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Matched
                          </Badge>
                        )}
                        {row.matchStatus === 'missing' && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Missing
                          </Badge>
                        )}
                        {row.matchStatus === 'duplicate' && (
                          <Badge variant="default" className="bg-warning-subtle text-warning-subtle">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Duplicate
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.csvRow?.rowNumber.toString() || 'none'}
                          onValueChange={(val) => {
                            if (val !== 'none') {
                              handleManualAssignment(row.itemNumber, parseInt(val));
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Assign CSV row" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {parsedRows.filter(r => !r.cancelledOrFailed).map(csvRow => (
                              <SelectItem key={csvRow.rowNumber} value={csvRow.rowNumber.toString()}>
                                Row {csvRow.rowNumber}: {csvRow.productName} (${csvRow.soldPrice?.toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('upload')}>
            Back
          </Button>
          <Button onClick={handleApplyReconciliation} disabled={validCount === 0 || loading}>
            {loading ? 'Applying...' : `Apply Reconciliation (${validCount} sales)`}
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
          Upload Whatnot Sales CSV
        </CardTitle>
        <CardDescription>
          Upload your Whatnot orders export to reconcile this session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatnot_csv">Whatnot Orders CSV</Label>
          <Input
            id="whatnot_csv"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={loading}
          />
        </div>

        <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
          <p className="font-semibold mb-2">Expected Format:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Product Name must include item number (e.g., &quot;SINGLES #1&quot;, &quot;Item #12&quot;)</li>
            <li>Columns: order id, buyer, product name, sold price, placed at, cancelled or failed</li>
            <li>Cancelled orders are automatically excluded</li>
            <li>Fees and taxes are calculated based on session settings</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
