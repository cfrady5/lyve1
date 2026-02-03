"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { classifyItem } from "@/lib/itemClassification";
import { calculatePlatformFees } from "@/lib/feeCalculations";
import { Platform } from "@/lib/types/portfolio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Platform selector component removed - using inline Select instead

interface Session {
  id: string;
  name: string;
}

interface MatchResult {
  totalItems: number;
  matchedCount: number;
  createdCount: number;
  unmatchedCards: number[];
}

interface ImportCSVButtonProps {
  sessionId?: string;
  variant?: "default" | "outline" | "ghost";
}

export function ImportCSVButton({ sessionId, variant = "default" }: ImportCSVButtonProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>(sessionId || "");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (open) {
      if (!sessionId) {
        fetchSessions();
      }
      if (!selectedPlatform) {
        fetchDefaultPlatform();
      }
      fetchPlatforms();
    }
  }, [open, sessionId]);

  const fetchPlatforms = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('platforms')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (data) {
      setPlatforms(data);
    }
  };

  const fetchDefaultPlatform = async () => {
    const supabase = createClient();
    // Default to Whatnot platform
    const { data } = await supabase
      .from('platforms')
      .select('*')
      .eq('platform_key', 'whatnot')
      .single();

    if (data) {
      setSelectedPlatform(data);
    }
  };

  const fetchSessions = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('sessions')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setSessions(data);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setError(null);
    } else {
      setError('Please select a valid CSV file');
    }
  };

  const detectItemLabelPattern = (productNames: string[]): string | null => {
    // Common patterns to look for in product names
    const patterns = [
      { regex: /^(Item\s*#)/i, pattern: 'Item #' },
      { regex: /^(Card\s*#)/i, pattern: 'Card #' },
      { regex: /^(Slot\s*#)/i, pattern: 'Slot #' },
      { regex: /^(Item\s+)/i, pattern: 'Item ' },
      { regex: /^(Card\s+)/i, pattern: 'Card ' },
      { regex: /^(Slot\s+)/i, pattern: 'Slot ' },
    ];

    // Count matches for each pattern
    const patternCounts = new Map<string, number>();

    for (const name of productNames) {
      if (!name) continue;

      for (const { regex, pattern } of patterns) {
        if (regex.test(name)) {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        }
      }
    }

    // Find the most common pattern (must appear in at least 50% of items)
    let maxCount = 0;
    let detectedPattern: string | null = null;
    const threshold = Math.floor(productNames.length * 0.5);

    Array.from(patternCounts.entries()).forEach(([pattern, count]) => {
      if (count > maxCount && count >= threshold) {
        maxCount = count;
        detectedPattern = pattern;
      }
    });

    return detectedPattern;
  };

  const parseCSV = (text: string, platform: Platform | null): { items: Array<{ title: string; price: number; fees: number; cardNumber: number | null }>, detectedPattern: string | null } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Try to find the relevant columns
    const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('item') || h.includes('product'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('sale') || h.includes('amount'));
    const feesIdx = headers.findIndex(h => h.includes('fee'));
    const cardNumberIdx = headers.findIndex(h =>
      h.includes('card') && (h.includes('number') || h.includes('#') || h.includes('num')) ||
      h === 'card' ||
      h === 'card #' ||
      h === 'card number' ||
      h === 'item #' ||
      h === 'item number'
    );

    if (priceIdx === -1) {
      throw new Error('Could not find price column in CSV. Please check the file format.');
    }

    // Card number column is optional - if missing, we'll auto-create inventory items

    const items: Array<{ title: string; price: number; fees: number; cardNumber: number | null }> = [];
    const productNames: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());

      const title = titleIdx !== -1 ? values[titleIdx] : `Item ${i}`;
      const priceStr = values[priceIdx].replace(/[$,]/g, '');
      const price = parseFloat(priceStr);

      // Calculate fees using platform fee structure
      // If fees column exists in CSV and has a value, use it; otherwise calculate automatically
      let fees = 0;
      if (feesIdx !== -1 && values[feesIdx]) {
        const feesStr = values[feesIdx].replace(/[$,]/g, '');
        const csvFees = parseFloat(feesStr);
        if (!isNaN(csvFees)) {
          fees = csvFees;
        }
      }

      // If no fees from CSV, calculate automatically using platform settings
      if (fees === 0 && !isNaN(price) && price > 0) {
        const feeCalc = calculatePlatformFees(price, platform);
        fees = feeCalc.total_fees;
      }

      let cardNumber: number | null = null;
      if (cardNumberIdx !== -1) {
        const cardStr = values[cardNumberIdx].replace(/[#,]/g, '').trim();
        cardNumber = parseInt(cardStr, 10);
        if (isNaN(cardNumber)) {
          cardNumber = null;
        }
      }

      if (!isNaN(price)) {
        items.push({ title, price, fees, cardNumber });
        productNames.push(title);
      }
    }

    // Detect the naming pattern from product names
    const detectedPattern = detectItemLabelPattern(productNames);

    return { items, detectedPattern };
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || !selectedSession) {
      setError('Please select a session and CSV file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in");
        return;
      }

      // Read and parse CSV
      const text = await csvFile.text();
      const { items: parsedItems, detectedPattern } = parseCSV(text, selectedPlatform);

      if (parsedItems.length === 0) {
        setError('No valid items found in CSV');
        return;
      }

      // Update session with detected pattern if found
      if (detectedPattern) {
        await supabase
          .from('sessions')
          .update({ item_label_pattern: detectedPattern })
          .eq('id', selectedSession);
      }

      // Upload CSV file to storage
      const fileName = `${selectedSession}/${Date.now()}-${csvFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('sales-reports')
        .upload(fileName, csvFile);

      if (uploadError) {
        setError(`File upload failed: ${uploadError.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('sales-reports')
        .getPublicUrl(fileName);

      // Create sales report record
      const { data: report, error: reportError } = await supabase
        .from('sales_reports')
        .insert({
          user_id: user.id,
          session_id: selectedSession,
          file_name: csvFile.name,
          file_url: publicUrl,
        })
        .select()
        .single();

      if (reportError) {
        setError(reportError.message);
        return;
      }

      // Create sale items with card numbers and platform information
      const saleItems = parsedItems.map((item, index) => ({
        sales_report_id: report.id,
        row_number: index + 1,
        item_title: item.title,
        sale_price: item.price,
        fees: item.fees,
        card_number: item.cardNumber,
        platform_id: selectedPlatform?.id || null,
        platform_key: selectedPlatform?.platform_key || null,
      }));

      const { data: createdSaleItems, error: saleItemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)
        .select();

      if (saleItemsError) {
        setError(saleItemsError.message);
        return;
      }

      // Get existing inventory items for this session
      const { data: existingInventoryItems } = await supabase
        .from('inventory_items')
        .select('id, card_number, display_name')
        .eq('session_id', selectedSession)
        .order('card_number', { ascending: true });

      // Calculate next card number for auto-created items
      let nextCardNumber = 1;
      if (existingInventoryItems && existingInventoryItems.length > 0) {
        const maxCardNumber = Math.max(...existingInventoryItems.map(item => item.card_number));
        nextCardNumber = maxCardNumber + 1;
      }

      // Get session to get item_label_pattern
      await supabase
        .from('sessions')
        .select('item_label_pattern')
        .eq('id', selectedSession)
        .single();

      // Create a separate inventory item for EACH CSV row
      let createdCount = 0;
      const unmatchedCards: number[] = [];

      interface SaleItem {
        id: string;
        card_number?: number;
        item_title: string;
      }

      if (createdSaleItems) {
        const createItems = createdSaleItems.map(async (saleItem: SaleItem, index: number) => {
          // Use card_number from CSV if provided, otherwise assign sequential numbers
          const cardNumber = saleItem.card_number || (nextCardNumber + index);
          const productName = saleItem.item_title;
          const classification = classifyItem(productName);

          // Create new inventory item for this sale
          const { error: inventoryError } = await supabase
            .from('inventory_items')
            .insert({
              session_id: selectedSession,
              card_number: cardNumber,
              cost_basis: 0, // Default cost basis, user can update later
              image_url: null,
              display_name: classification.displayName,
              normalized_key: classification.normalizedKey,
              bucket_type: classification.bucketType,
              item_index: classification.itemIndex,
              sale_item_id: saleItem.id, // Link to sale immediately
              match_type: 'auto',
            })
            .select('id')
            .single();

          if (inventoryError) {
            console.error('Failed to create inventory item:', inventoryError);
            if (saleItem.card_number) {
              unmatchedCards.push(saleItem.card_number);
            }
            return;
          }

          createdCount++;
        });

        await Promise.all(createItems);
      }

      // Show results
      setMatchResult({
        totalItems: parsedItems.length,
        matchedCount: createdCount, // All items are created
        createdCount,
        unmatchedCards,
      });
      setOpen(false);
      setShowResults(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseResults = () => {
    setShowResults(false);
    setMatchResult(null);
    setSelectedSession("");
    setSelectedPlatform(null);
    setCsvFile(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={variant}>Import CSV</Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleImport}>
            <DialogHeader>
              <DialogTitle>Import Sales Report</DialogTitle>
              <DialogDescription>
                Upload a CSV file with your sales data. Fees are calculated automatically based on the selected platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 text-sm text-danger-subtle bg-danger-subtle border border-danger-subtle rounded">
                  {error}
                </div>
              )}

              {!sessionId && (
                <div className="space-y-2">
                  <Label htmlFor="session">Select Session</Label>
                  <Select value={selectedSession} onValueChange={setSelectedSession}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Platform</Label>
                <Select
                  value={selectedPlatform?.id || ''}
                  onValueChange={(platformId: string) => {
                    const platform = platforms.find(p => p.id === platformId);
                    if (platform) setSelectedPlatform(platform);
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>
                        {platform.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>CSV File</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {csvFile ? (
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="text-sm">{csvFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCsvFile(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose CSV File
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !csvFile || !selectedSession || !selectedPlatform}>
                {loading ? "Importing..." : "Import & Match"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Match Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Complete</DialogTitle>
            <DialogDescription>
              Your sales report has been imported and items have been matched.
            </DialogDescription>
          </DialogHeader>
          {matchResult && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-primary/5 rounded-lg">
                  <div className="text-2xl font-bold">{matchResult.createdCount}</div>
                  <div className="text-sm text-muted-foreground">Items Created</div>
                </div>
                <div className="p-4 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold">{matchResult.totalItems}</div>
                  <div className="text-sm text-muted-foreground">Total in CSV</div>
                </div>
              </div>

              {matchResult.unmatchedCards.length > 0 && (
                <div className="p-4 bg-warning-subtle border border-warning-subtle rounded-lg">
                  <div className="text-sm font-medium mb-2">
                    {matchResult.unmatchedCards.length} items could not be matched
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cards without matching inventory items: {matchResult.unmatchedCards.join(', ')}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    These items were imported but not linked to inventory. Add Cards {matchResult.unmatchedCards.join(', ')} to your session to match them.
                  </div>
                </div>
              )}

              {matchResult.matchedCount === matchResult.totalItems && (
                <div className="p-4 bg-success-subtle border border-success-subtle rounded-lg">
                  <div className="text-sm font-medium text-success-subtle">
                    All items created successfully!
                  </div>
                  <div className="text-xs text-success-subtle mt-1">
                    Created {matchResult.createdCount} separate inventory {matchResult.createdCount === 1 ? 'item' : 'items'} from your CSV. Each item shows its individual sale price.
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleCloseResults}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
