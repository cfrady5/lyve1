"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface CostStack {
  purchase_price: number;
  purchase_tax: number;
  shipping_in: number;
  supplies_cost: number;
  grading_cost: number;
  other_costs: number;
}

interface CostBasisEditorProps {
  itemId: string;
  currentCostBasis: number;
  currentCostStack?: Partial<CostStack>;
  onUpdate?: () => void;
  trigger?: React.ReactNode;
}

export function CostBasisEditor({
  itemId,
  currentCostBasis,
  currentCostStack = {},
  onUpdate,
  trigger,
}: CostBasisEditorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [costs, setCosts] = useState<CostStack>({
    purchase_price: currentCostStack.purchase_price || 0,
    purchase_tax: currentCostStack.purchase_tax || 0,
    shipping_in: currentCostStack.shipping_in || 0,
    supplies_cost: currentCostStack.supplies_cost || 0,
    grading_cost: currentCostStack.grading_cost || 0,
    other_costs: currentCostStack.other_costs || 0,
  });

  // Calculate total cost basis
  const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

  useEffect(() => {
    if (open) {
      // Reset to current values when opening
      setCosts({
        purchase_price: currentCostStack.purchase_price || 0,
        purchase_tax: currentCostStack.purchase_tax || 0,
        shipping_in: currentCostStack.shipping_in || 0,
        supplies_cost: currentCostStack.supplies_cost || 0,
        grading_cost: currentCostStack.grading_cost || 0,
        other_costs: currentCostStack.other_costs || 0,
      });
    }
  }, [open, currentCostStack]);

  const handleCostChange = (field: keyof CostStack, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCosts((prev) => ({ ...prev, [field]: numValue }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Update all cost columns and the computed cost_basis
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({
          ...costs,
          cost_basis: totalCost, // Update legacy cost_basis field for backward compatibility
        })
        .eq("id", itemId);

      if (updateError) {
        throw updateError;
      }

      setOpen(false);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update costs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Edit Costs
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Cost Basis</DialogTitle>
          <DialogDescription>
            Break down the total cost of acquiring and preparing this item for sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 text-sm text-danger-subtle bg-danger-subtle border border-danger-subtle rounded">
              {error}
            </div>
          )}

          {/* Purchase Price */}
          <div className="space-y-2">
            <Label htmlFor="purchase-price">Purchase Price ($)</Label>
            <Input
              id="purchase-price"
              type="number"
              step="0.01"
              min="0"
              value={costs.purchase_price || ""}
              onChange={(e) => handleCostChange("purchase_price", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              The price you paid for the item
            </p>
          </div>

          {/* Purchase Tax */}
          <div className="space-y-2">
            <Label htmlFor="purchase-tax">Sales Tax ($)</Label>
            <Input
              id="purchase-tax"
              type="number"
              step="0.01"
              min="0"
              value={costs.purchase_tax || ""}
              onChange={(e) => handleCostChange("purchase_tax", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Tax paid on the purchase
            </p>
          </div>

          {/* Shipping In */}
          <div className="space-y-2">
            <Label htmlFor="shipping-in">Shipping to You ($)</Label>
            <Input
              id="shipping-in"
              type="number"
              step="0.01"
              min="0"
              value={costs.shipping_in || ""}
              onChange={(e) => handleCostChange("shipping_in", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Cost to receive the item
            </p>
          </div>

          <Separator />

          {/* Supplies Cost */}
          <div className="space-y-2">
            <Label htmlFor="supplies-cost">Supplies ($)</Label>
            <Input
              id="supplies-cost"
              type="number"
              step="0.01"
              min="0"
              value={costs.supplies_cost || ""}
              onChange={(e) => handleCostChange("supplies_cost", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Sleeves, top loaders, boxes, etc.
            </p>
          </div>

          {/* Grading Cost */}
          <div className="space-y-2">
            <Label htmlFor="grading-cost">Grading Fees ($)</Label>
            <Input
              id="grading-cost"
              type="number"
              step="0.01"
              min="0"
              value={costs.grading_cost || ""}
              onChange={(e) => handleCostChange("grading_cost", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              PSA, BGS, SGC, or other grading fees
            </p>
          </div>

          {/* Other Costs */}
          <div className="space-y-2">
            <Label htmlFor="other-costs">Other Costs ($)</Label>
            <Input
              id="other-costs"
              type="number"
              step="0.01"
              min="0"
              value={costs.other_costs || ""}
              onChange={(e) => handleCostChange("other_costs", e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Any additional costs
            </p>
          </div>

          <Separator />

          {/* Total Cost Display */}
          <div className="p-4 bg-primary/5 rounded-lg">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Total Cost Basis</span>
              <span className="text-2xl font-bold tabular-nums">
                ${totalCost.toFixed(2)}
              </span>
            </div>
            {currentCostBasis !== totalCost && (
              <div className="text-xs text-muted-foreground mt-1">
                Current: ${currentCostBasis.toFixed(2)}
                {" → "}
                Change: {totalCost > currentCostBasis ? '+' : ''}
                ${(totalCost - currentCostBasis).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
