'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, CheckCircle2, AlertCircle, Package } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  display_name: string | null;
  cert_number: string | null;
  cost_basis: number;
  estimated_value: number | null;
  notes: string | null;
  status: string;
  sport: string | null;
  brand: string | null;
}

interface InventoryPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  userId: string;
  existingItemIds: string[];
  onItemsAdded: () => void;
}

const formatUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function InventoryPickerModal({
  open,
  onOpenChange,
  sessionId,
  userId,
  existingItemIds,
  onItemsAdded,
}: InventoryPickerModalProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Load inventory
  const loadInventory = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('inventory_items')
        .select('id, name, display_name, cert_number, cost_basis, estimated_value, notes, status, sport, brand')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setInventory(data || []);
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [open, userId, supabase]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Filter and search
  const filteredItems = useMemo(() => {
    let filtered = inventory;

    // Filter out items already in session
    filtered = filtered.filter((item) => !existingItemIds.includes(item.id));

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.name?.toLowerCase().includes(query) ||
            item.display_name?.toLowerCase().includes(query) ||
            item.cert_number?.toLowerCase().includes(query) ||
            item.notes?.toLowerCase().includes(query))
      );
    }

    // Sport filter
    if (sportFilter !== 'all') {
      filtered = filtered.filter((item) => item.sport === sportFilter);
    }

    // Value range
    const minVal = parseFloat(minValue);
    const maxVal = parseFloat(maxValue);
    if (!isNaN(minVal)) {
      filtered = filtered.filter((item) => (item.estimated_value || item.cost_basis || 0) >= minVal);
    }
    if (!isNaN(maxVal)) {
      filtered = filtered.filter((item) => (item.estimated_value || item.cost_basis || 0) <= maxVal);
    }

    return filtered;
  }, [inventory, existingItemIds, searchQuery, sportFilter, minValue, maxValue]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Get unique sports for filter
  const sports = useMemo(() => {
    const uniqueSports = new Set(inventory.map((item) => item.sport).filter(Boolean));
    return Array.from(uniqueSports).sort() as string[];
  }, [inventory]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedIds);
      paginatedItems.forEach((item) => newSelected.add(item.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      paginatedItems.forEach((item) => newSelected.delete(item.id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedIds(newSelected);
  };

  const allPageSelected = paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.has(item.id));

  // Add items
  const handleAddItems = async () => {
    if (selectedIds.size === 0) return;

    setAdding(true);
    setError(null);

    try {
      // Get existing items to determine next item_number
      const { data: existingSessionItems } = await supabase
        .from('session_items')
        .select('item_number')
        .eq('session_id', sessionId)
        .order('item_number', { ascending: false })
        .limit(1);

      const nextItemNumber = existingSessionItems?.[0]?.item_number ? existingSessionItems[0].item_number + 1 : 1;

      // Create session_items records
      const sessionItems = Array.from(selectedIds).map((itemId, index) => ({
        session_id: sessionId,
        item_id: itemId,
        item_number: nextItemNumber + index,
        position: nextItemNumber + index,
        added_via: 'manual' as const,
      }));

      const { error: insertError } = await supabase
        .from('session_items')
        .insert(sessionItems);

      if (insertError) throw insertError;

      // Success!
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedIds(new Set());
        onItemsAdded();
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error('Error adding items:', err);
      setError(err instanceof Error ? err.message : 'Failed to add items');
      setAdding(false);
    }
  };

  const handleClose = () => {
    if (!adding) {
      setSelectedIds(new Set());
      setSearchQuery('');
      setSportFilter('all');
      setMinValue('');
      setMaxValue('');
      setCurrentPage(1);
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Items from Lyvefolio</DialogTitle>
          <DialogDescription>
            Select items from your inventory to add to this session
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Items Added Successfully!</p>
            <p className="text-sm text-muted-foreground mt-2">
              Added {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} to session
            </p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="space-y-4 border-b pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="lg:col-span-2 space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, cert, notes..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Sport Filter */}
                <div className="space-y-2">
                  <Label htmlFor="sport-filter">Sport</Label>
                  <Select
                    value={sportFilter}
                    onValueChange={(value) => {
                      setSportFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger id="sport-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      {sports.map((sport) => (
                        <SelectItem key={sport} value={sport}>
                          {sport}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Value Range */}
                <div className="space-y-2">
                  <Label>Value Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minValue}
                      onChange={(e) => {
                        setMinValue(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-20"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxValue}
                      onChange={(e) => {
                        setMaxValue(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>

              {/* Results count */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} available
                  {existingItemIds.length > 0 && (
                    <span className="ml-2">
                      ({existingItemIds.length} already in session)
                    </span>
                  )}
                </span>
                {selectedIds.size > 0 && (
                  <Badge variant="secondary">
                    {selectedIds.size} selected
                  </Badge>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No items available</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {inventory.length === 0
                      ? 'Your inventory is empty. Add items in Lyvefolio first.'
                      : 'All items are already in this session or filtered out.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header with Select All */}
                  <div className="grid grid-cols-[40px_1fr_120px_100px_150px] gap-3 pb-2 border-b font-medium text-sm sticky top-0 bg-background">
                    <div className="flex items-center">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all on page"
                      />
                    </div>
                    <div>Card Name</div>
                    <div>Cert Number</div>
                    <div>Cost Basis</div>
                    <div>Market Value</div>
                  </div>

                  {/* Item rows */}
                  {paginatedItems.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    const displayName = item.display_name || item.name || 'Unnamed Item';

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-[40px_1fr_120px_100px_150px] gap-3 py-2 border-b hover:bg-accent/5 transition-colors items-center"
                      >
                        <div className="flex items-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                            aria-label={`Select ${displayName}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-sm truncate">{displayName}</p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
                          )}
                        </div>
                        <div className="text-sm font-mono truncate">
                          {item.cert_number || '-'}
                        </div>
                        <div className="text-sm font-mono">
                          {formatUSD(item.cost_basis || 0)}
                        </div>
                        <div className="text-sm font-mono">
                          {item.estimated_value ? formatUSD(item.estimated_value) : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Footer */}
            <DialogFooter className="border-t pt-4">
              <div className="flex items-center justify-between w-full">
                <div className="text-sm text-muted-foreground">
                  {selectedIds.size > 0 && (
                    <span>
                      Selected: {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose} disabled={adding}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddItems}
                    disabled={adding || selectedIds.size === 0}
                  >
                    {adding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>Add Selected ({selectedIds.size})</>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
