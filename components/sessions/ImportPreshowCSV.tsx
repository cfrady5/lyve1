'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ParsedCSVRow {
  rowNumber: number;
  values: string[];
  mapped: {
    name?: string;
    costBasis?: number;
    itemNumber?: number;
    notes?: string;
  };
  valid: boolean;
  errors: string[];
}

interface ColumnMapping {
  name: number | null;
  cost: number | null;
  itemNumber: number | null;
  notes: number | null;
}

interface ImportPreshowCSVProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: Array<{
    name: string;
    costBasis: number;
    itemNumber?: number;
    notes?: string;
  }>) => Promise<void>;
}

export function ImportPreshowCSV({ open, onOpenChange, onImport }: ImportPreshowCSVProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: null,
    cost: null,
    itemNumber: null,
    notes: null
  });
  const [parsedRows, setParsedRows] = useState<ParsedCSVRow[]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [loading, setLoading] = useState(false);

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
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const text = await selectedFile.text();
    const lines = text.trim().split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      alert('CSV must have at least a header row and one data row');
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
      name: null,
      cost: null,
      itemNumber: null,
      notes: null
    };

    parsedHeaders.forEach((header, idx) => {
      const h = header.toLowerCase();
      if ((h.includes('name') || h.includes('title') || h.includes('item')) && !h.includes('number') && !h.includes('#')) {
        autoMapping.name = idx;
      } else if (h.includes('cost') || h.includes('price') || h.includes('paid')) {
        autoMapping.cost = idx;
      } else if ((h.includes('item') && (h.includes('number') || h.includes('#'))) || h === 'item#') {
        autoMapping.itemNumber = idx;
      } else if (h.includes('note') || h.includes('description') || h.includes('desc')) {
        autoMapping.notes = idx;
      }
    });

    setColumnMapping(autoMapping);
    setStep('map');
  };

  const handleColumnMappingChange = (field: keyof ColumnMapping, value: string) => {
    const idx = value === 'none' ? null : parseInt(value);
    setColumnMapping(prev => ({ ...prev, [field]: idx }));
  };

  const handlePreview = () => {
    const rows: ParsedCSVRow[] = rawRows.map((values, idx) => {
      const errors: string[] = [];

      const name = columnMapping.name !== null ? values[columnMapping.name] : undefined;
      const costStr = columnMapping.cost !== null ? values[columnMapping.cost] : undefined;
      const itemNumStr = columnMapping.itemNumber !== null ? values[columnMapping.itemNumber] : undefined;
      const notes = columnMapping.notes !== null ? values[columnMapping.notes] : undefined;

      const costBasis = costStr ? parseFloat(costStr.replace(/[$,]/g, '')) : undefined;
      const itemNumber = itemNumStr ? parseInt(itemNumStr) : undefined;

      // Validation
      if (!name || name === '') {
        errors.push('Missing name');
      }
      if (!costBasis || costBasis <= 0 || isNaN(costBasis)) {
        errors.push('Missing or invalid cost');
      }

      return {
        rowNumber: idx + 2, // +2 because row 1 is header
        values,
        mapped: {
          name,
          costBasis,
          itemNumber,
          notes
        },
        valid: errors.length === 0,
        errors
      };
    });

    setParsedRows(rows);
    setStep('preview');
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.valid);
    if (validRows.length === 0) {
      alert('No valid rows to import');
      return;
    }

    setLoading(true);
    try {
      await onImport(validRows.map(r => ({
        name: r.mapped.name!,
        costBasis: r.mapped.costBasis!,
        itemNumber: r.mapped.itemNumber,
        notes: r.mapped.notes
      })));

      // Reset
      setHeaders([]);
      setRawRows([]);
      setParsedRows([]);
      setColumnMapping({ name: null, cost: null, itemNumber: null, notes: null });
      setStep('upload');
      onOpenChange(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import items');
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Items from CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file to import items'}
            {step === 'map' && 'Map your CSV columns to item fields'}
            {step === 'preview' && 'Review and confirm import'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv_file">CSV File</Label>
                <Input
                  id="csv_file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={loading}
                />
              </div>
              <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                <p className="font-semibold mb-2">CSV Format Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>First row should contain column headers</li>
                  <li>Required: Name/Title and Cost/Price columns</li>
                  <li>Optional: Item Number, Notes/Description</li>
                  <li>Example: &quot;Card Name, Cost, Item #, Notes&quot;</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="bg-info-subtle border border-info-subtle p-4 rounded-lg">
                <p className="text-sm font-semibold text-info-subtle mb-2">Map Your Columns</p>
                <p className="text-sm text-info-subtle">
                  We detected {headers.length} columns. Map them to the corresponding fields below.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="map_name" className="flex items-center gap-2">
                    Item Name <Badge variant="destructive" className="text-xs">Required</Badge>
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

                <div className="space-y-2">
                  <Label htmlFor="map_cost" className="flex items-center gap-2">
                    Cost Basis <Badge variant="destructive" className="text-xs">Required</Badge>
                  </Label>
                  <Select
                    value={columnMapping.cost !== null ? columnMapping.cost.toString() : 'none'}
                    onValueChange={(val) => handleColumnMappingChange('cost', val)}
                  >
                    <SelectTrigger id="map_cost">
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

                <div className="space-y-2">
                  <Label htmlFor="map_item_number" className="flex items-center gap-2">
                    Item Number <Badge variant="outline" className="text-xs">Optional</Badge>
                  </Label>
                  <Select
                    value={columnMapping.itemNumber !== null ? columnMapping.itemNumber.toString() : 'none'}
                    onValueChange={(val) => handleColumnMappingChange('itemNumber', val)}
                  >
                    <SelectTrigger id="map_item_number">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Not mapped (auto-assign) --</SelectItem>
                      {headers.map((header, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          Column {idx + 1}: {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="map_notes" className="flex items-center gap-2">
                    Notes <Badge variant="outline" className="text-xs">Optional</Badge>
                  </Label>
                  <Select
                    value={columnMapping.notes !== null ? columnMapping.notes.toString() : 'none'}
                    onValueChange={(val) => handleColumnMappingChange('notes', val)}
                  >
                    <SelectTrigger id="map_notes">
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
              </div>

              {/* Preview first 3 rows */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-semibold mb-2">Preview (first 3 rows):</p>
                <div className="space-y-2 text-sm">
                  {rawRows.slice(0, 3).map((row, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 p-2 bg-background rounded border">
                      <div>
                        <span className="text-xs text-muted-foreground">Name:</span>
                        <p className="font-mono truncate">{columnMapping.name !== null ? row[columnMapping.name] : '—'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Cost:</span>
                        <p className="font-mono truncate">{columnMapping.cost !== null ? row[columnMapping.cost] : '—'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Item #:</span>
                        <p className="font-mono truncate">{columnMapping.itemNumber !== null ? row[columnMapping.itemNumber] : 'Auto'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Notes:</span>
                        <p className="font-mono truncate">{columnMapping.notes !== null ? row[columnMapping.notes] : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex gap-2 items-center">
                <Badge variant="default">{validCount} valid</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">{invalidCount} invalid</Badge>
                )}
              </div>

              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[100px]">Cost</TableHead>
                      <TableHead className="w-[80px]">Item #</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow key={row.rowNumber} className={!row.valid ? 'bg-danger-subtle' : ''}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.mapped.name || '—'}</TableCell>
                        <TableCell className="font-mono">
                          {row.mapped.costBasis ? `$${row.mapped.costBasis.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="font-mono">{row.mapped.itemNumber || 'Auto'}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground text-xs">
                          {row.mapped.notes || '—'}
                        </TableCell>
                        <TableCell>
                          {row.valid ? (
                            <Badge variant="outline" className="text-success-subtle border-success-subtle">
                              ✓
                            </Badge>
                          ) : (
                            <Badge variant="destructive" title={row.errors.join(', ')}>
                              ✗
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {invalidCount > 0 && (
                <div className="text-sm text-danger-subtle p-3 bg-danger-subtle rounded-lg">
                  <strong>Validation Errors:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {parsedRows
                      .filter(r => !r.valid)
                      .map(r => (
                        <li key={r.rowNumber}>
                          Row {r.rowNumber}: {r.errors.join(', ')}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handlePreview}
                disabled={columnMapping.name === null || columnMapping.cost === null}
              >
                Preview Import
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>
                Back to Mapping
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || loading}>
                {loading ? 'Importing...' : `Import ${validCount} Item${validCount === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
