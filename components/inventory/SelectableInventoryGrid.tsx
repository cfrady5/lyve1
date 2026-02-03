"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { InventoryItemCard } from "@/components/inventory/InventoryItemCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InventoryItem {
  id: string;
  card_number: number;
  cost_basis: number;
  image_url: string | null;
  purchase_price?: number;
  purchase_tax?: number;
  shipping_in?: number;
  supplies_cost?: number;
  grading_cost?: number;
  other_costs?: number;
  sale_items?: {
    item_title: string;
    sale_price: number;
    fees: number;
    platform_key?: string | null;
    platforms?: {
      display_name: string;
      fee_percent_default: number;
    } | null;
  } | null;
}

interface SelectableInventoryGridProps {
  items: InventoryItem[];
  itemLabelPattern?: string;
}

export function SelectableInventoryGrid({ items, itemLabelPattern = 'Card #' }: SelectableInventoryGridProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const hasSelection = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();

      // Delete images first
      const itemsToDelete = items.filter(item => selectedIds.has(item.id));
      const imageUrls = itemsToDelete
        .map(item => item.image_url)
        .filter((url): url is string => url !== null);

      if (imageUrls.length > 0) {
        const filePaths = imageUrls.map(url => {
          const urlParts = url.split('/storage/v1/object/public/inventory-images/');
          return urlParts[1] || '';
        }).filter(path => path !== '');

        if (filePaths.length > 0) {
          await supabase.storage
            .from('inventory-images')
            .remove(filePaths);
        }
      }

      // Delete inventory items
      await supabase
        .from('inventory_items')
        .delete()
        .in('id', Array.from(selectedIds));

      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      router.refresh();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Sticky Toolbar */}
      <div className="sticky top-[73px] z-40 -mx-4 px-4 py-3 mb-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Selection controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all items"
              />
              <span className="text-sm font-medium">
                {hasSelection ? (
                  <span>
                    {selectedIds.size} of {items.length} selected
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </span>
            </div>

            {hasSelection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-8 text-xs"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Right: Actions */}
          {hasSelection && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8"
            >
              Delete ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Items Grid - Responsive with max card width */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <InventoryItemCard
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={() => toggleItem(item.id)}
            showCheckbox={true}
            itemLabelPattern={itemLabelPattern}
            onRefresh={() => router.refresh()}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected inventory items and their images.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
