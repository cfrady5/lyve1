"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, Calculator } from "lucide-react";

interface Platform {
  id: string;
  platform_key: string;
  display_name: string;
  fee_percent_default: number;
  payment_processing_percent_default: number;
  payment_processing_fixed_default: number;
}

interface Session {
  id: string;
  name: string;
  created_at: string;
}

interface ActiveItem {
  id: string;
  name: string | null;
  cost_basis: number | null;
  image_url: string | null;
}

interface MarkSoldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  platforms: Platform[];
  sessions: Session[];
  preselectedItemId: string | null;
  onSuccess: () => void;
}

// Fee calculation engine
function calculateFees(
  soldPrice: number,
  channel: string,
  platforms: Platform[],
  overrides?: { feePercent?: number; processingPercent?: number; processingFixed?: number }
) {
  // Find platform config
  const platform = platforms.find(p => p.platform_key === channel);
  
  const feePercent = overrides?.feePercent ?? platform?.fee_percent_default ?? 0;
  const processingPercent = overrides?.processingPercent ?? platform?.payment_processing_percent_default ?? 0;
  const processingFixed = overrides?.processingFixed ?? platform?.payment_processing_fixed_default ?? 0;

  const commission = soldPrice * feePercent;
  const processing = (soldPrice * processingPercent) + processingFixed;
  const totalFees = commission + processing;

  return {
    commission: Math.round(commission * 100) / 100,
    processing: Math.round(processing * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
  };
}

export function MarkSoldModal({
  open,
  onOpenChange,
  userId,
  platforms,
  sessions,
  preselectedItemId,
  onSuccess,
}: MarkSoldModalProps) {
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Item selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ActiveItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ActiveItem | null>(null);
  
  // Sale form
  const [channel, setChannel] = useState("whatnot");
  const [soldPrice, setSoldPrice] = useState("");
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0]);
  const [includeTaxes, setIncludeTaxes] = useState(false);
  const [taxRate, setTaxRate] = useState("8.25");
  const [shipping, setShipping] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Fee overrides
  const [overrideFees, setOverrideFees] = useState(false);
  const [manualFees, setManualFees] = useState("");

  // Load preselected item
  useEffect(() => {
    if (open && preselectedItemId) {
      loadItem(preselectedItemId);
    }
  }, [open, preselectedItemId]);

  const loadItem = async (itemId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, display_name, cost_basis, image_url')
      .eq('id', itemId)
      .single();
    
    if (data) {
      setSelectedItem({
        id: data.id,
        name: data.name || data.display_name || 'Item',
        cost_basis: data.cost_basis,
        image_url: data.image_url,
      });
    }
  };

  const searchItems = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const supabase = createClient();
    
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, display_name, cost_basis, image_url')
      .eq('user_id', userId)
      .or('status.eq.ACTIVE,status.is.null')
      .not('lifecycle_status', 'eq', 'sold')
      .or(`name.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);

    setSearchResults((data || []).map(item => ({
      id: item.id,
      name: item.name || item.display_name || 'Item',
      cost_basis: item.cost_basis,
      image_url: item.image_url,
    })));
    setSearchLoading(false);
  }, [userId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && !selectedItem) {
        searchItems(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchItems, selectedItem]);

  // Calculate fees
  const price = parseFloat(soldPrice) || 0;
  const calculatedFees = calculateFees(price, channel, platforms);
  const fees = overrideFees ? (parseFloat(manualFees) || 0) : calculatedFees.totalFees;
  const taxes = includeTaxes ? (price * (parseFloat(taxRate) || 0) / 100) : 0;
  const shippingCost = parseFloat(shipping) || 0;
  const costBasis = selectedItem?.cost_basis || 0;
  const netPayout = price - fees - taxes - shippingCost;
  const netProfit = netPayout - costBasis;
  const roi = costBasis > 0 ? (netProfit / costBasis * 100) : null;

  const resetForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedItem(null);
    setChannel("whatnot");
    setSoldPrice("");
    setSoldDate(new Date().toISOString().split('T')[0]);
    setIncludeTaxes(false);
    setTaxRate("8.25");
    setShipping("");
    setSessionId(null);
    setOverrideFees(false);
    setManualFees("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedItem) {
      setError("Please select an item");
      return;
    }
    
    if (!soldPrice || price <= 0) {
      setError("Please enter a valid sold price");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Create sale record
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          user_id: userId,
          item_id: selectedItem.id,
          session_id: sessionId || null,
          channel: channel,
          sold_price: price,
          fees: Math.round(fees * 100) / 100,
          taxes: Math.round(taxes * 100) / 100,
          shipping: Math.round(shippingCost * 100) / 100,
          sold_at: new Date(soldDate).toISOString(),
        });

      if (saleError) {
        throw new Error(saleError.message);
      }

      // Update item status to SOLD
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          status: 'SOLD',
          lifecycle_status: 'sold',
          sold_date: soldDate,
        })
        .eq('id', selectedItem.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      resetForm();
      onSuccess();
    } catch (err) {
      console.error('Error marking item sold:', err);
      setError(err instanceof Error ? err.message : 'Failed to record sale');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mark Item Sold</DialogTitle>
            <DialogDescription>
              Record a sale and automatically move the item to Sold
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-danger-subtle bg-danger-subtle border border-danger-subtle rounded-md">
                {error}
              </div>
            )}

            {/* Item Selection */}
            {selectedItem ? (
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                    {selectedItem.image_url ? (
                      <img src={selectedItem.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedItem.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Cost: {formatCurrency(selectedItem.cost_basis || 0)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(null);
                      setSearchQuery("");
                    }}
                  >
                    Change
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <Label>Select Item</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search your inventory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searchLoading && (
                  <p className="text-sm text-muted-foreground">Searching...</p>
                )}
                {searchResults.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {searchResults.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full p-2 text-left hover:bg-muted flex items-center gap-2 border-b last:border-b-0"
                        onClick={() => {
                          setSelectedItem(item);
                          setSearchResults([]);
                        }}
                      >
                        <div className="w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                          {item.image_url && (
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cost: {formatCurrency(item.cost_basis || 0)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Channel Selection */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatnot">Whatnot</SelectItem>
                  <SelectItem value="ebay">eBay</SelectItem>
                  <SelectItem value="instagram">Instagram / DM</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sold Price */}
            <div className="space-y-2">
              <Label htmlFor="soldPrice">Sold Price *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="soldPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={soldPrice}
                  onChange={(e) => setSoldPrice(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>

            {/* Fees Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fees</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="overrideFees"
                    checked={overrideFees}
                    onCheckedChange={(checked) => setOverrideFees(checked === true)}
                  />
                  <Label htmlFor="overrideFees" className="text-xs text-muted-foreground cursor-pointer">
                    Override
                  </Label>
                </div>
              </div>
              
              {overrideFees ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Manual fee amount"
                    value={manualFees}
                    onChange={(e) => setManualFees(e.target.value)}
                    className="pl-7"
                  />
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-md text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Commission ({(platforms.find(p => p.platform_key === channel)?.fee_percent_default || 0) * 100}%):</span>
                    <span>{formatCurrency(calculatedFees.commission)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Processing:</span>
                    <span>{formatCurrency(calculatedFees.processing)}</span>
                  </div>
                  <div className="flex justify-between font-medium mt-1 pt-1 border-t">
                    <span>Total Fees:</span>
                    <span>{formatCurrency(calculatedFees.totalFees)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Taxes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeTaxes"
                  checked={includeTaxes}
                  onCheckedChange={(checked) => setIncludeTaxes(checked === true)}
                />
                <Label htmlFor="includeTaxes" className="cursor-pointer">
                  Include sales tax
                </Label>
              </div>
              {includeTaxes && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="20"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">% = {formatCurrency(taxes)}</span>
                </div>
              )}
            </div>

            {/* Shipping */}
            <div className="space-y-2">
              <Label htmlFor="shipping">Shipping Cost (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="shipping"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            {/* Sold Date */}
            <div className="space-y-2">
              <Label htmlFor="soldDate">Sold Date</Label>
              <Input
                id="soldDate"
                type="date"
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
              />
            </div>

            {/* Session (optional) */}
            <div className="space-y-2">
              <Label>Session (optional)</Label>
              <Select value={sessionId || "none"} onValueChange={(v) => setSessionId(v === "none" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Not from a session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not from a session</SelectItem>
                  {sessions.map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profit Preview */}
            {selectedItem && price > 0 && (
              <Card className={netProfit >= 0 ? "bg-success-subtle border-success-subtle" : "bg-danger-subtle border-danger-subtle"}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4" />
                    <span className="text-sm font-medium">Profit Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Sold Price:</div>
                    <div className="text-right">{formatCurrency(price)}</div>
                    <div className="text-muted-foreground">- Fees:</div>
                    <div className="text-right text-danger-subtle">-{formatCurrency(fees)}</div>
                    {includeTaxes && (
                      <>
                        <div className="text-muted-foreground">- Taxes:</div>
                        <div className="text-right text-danger-subtle">-{formatCurrency(taxes)}</div>
                      </>
                    )}
                    {shippingCost > 0 && (
                      <>
                        <div className="text-muted-foreground">- Shipping:</div>
                        <div className="text-right text-danger-subtle">-{formatCurrency(shippingCost)}</div>
                      </>
                    )}
                    <div className="text-muted-foreground">Net Payout:</div>
                    <div className="text-right font-medium">{formatCurrency(netPayout)}</div>
                    <div className="text-muted-foreground">- Cost Basis:</div>
                    <div className="text-right">-{formatCurrency(costBasis)}</div>
                    <div className="font-semibold border-t pt-1">Net Profit:</div>
                    <div className={`text-right font-bold border-t pt-1 ${netProfit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                      {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                    </div>
                    {roi !== null && (
                      <>
                        <div className="text-muted-foreground">ROI:</div>
                        <div className={`text-right font-medium ${roi >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                          {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedItem}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Sale'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
