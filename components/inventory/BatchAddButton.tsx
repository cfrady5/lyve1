"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { classifyItem } from "@/lib/itemClassification";
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

interface BatchAddButtonProps {
  sessionId: string;
  nextCardNumber: number;
}

export function BatchAddButton({ sessionId, nextCardNumber }: BatchAddButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [averageCost, setAverageCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBatchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in");
        return;
      }

      const qty = parseInt(quantity);
      const cost = parseFloat(averageCost);

      if (isNaN(qty) || qty < 1 || qty > 1000) {
        setError("Quantity must be between 1 and 1000");
        return;
      }

      if (isNaN(cost) || cost < 0) {
        setError("Please enter a valid cost");
        return;
      }

      // Fetch session to get item_label_pattern
      const { data: session } = await supabase
        .from('sessions')
        .select('item_label_pattern')
        .eq('id', sessionId)
        .single();

      const itemLabelPattern = session?.item_label_pattern || 'Card #';

      // Create array of items to insert with classification metadata
      const items = Array.from({ length: qty }, (_, index) => {
        const cardNumber = nextCardNumber + index;
        const productName = `${itemLabelPattern}${cardNumber}`;
        const classification = classifyItem(productName);

        return {
          session_id: sessionId,
          card_number: cardNumber,
          cost_basis: cost,
          image_url: null,
          display_name: classification.displayName,
          normalized_key: classification.normalizedKey,
          bucket_type: classification.bucketType,
          item_index: classification.itemIndex,
        };
      });

      // Batch insert all items
      const { error: insertError } = await supabase
        .from('inventory_items')
        .insert(items);

      if (insertError) {
        setError(insertError.message);
      } else {
        setOpen(false);
        setQuantity("");
        setAverageCost("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Batch Add</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleBatchAdd}>
          <DialogHeader>
            <DialogTitle>Batch Add Items</DialogTitle>
            <DialogDescription>
              Quickly add multiple cards with the same cost basis
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-danger-subtle bg-danger-subtle border border-danger-subtle rounded">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quantity">Number of Cards</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="1000"
                placeholder="e.g., 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Will add Card {nextCardNumber} through Card {nextCardNumber + (parseInt(quantity) || 0) - 1}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="average-cost">Average Cost per Card ($)</Label>
              <Input
                id="average-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={averageCost}
                onChange={(e) => setAverageCost(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Summary</p>
              <p className="text-muted-foreground">
                Adding {quantity || 0} cards at ${averageCost || "0.00"} each
              </p>
              <p className="text-muted-foreground">
                Total cost: ${((parseInt(quantity) || 0) * (parseFloat(averageCost) || 0)).toFixed(2)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Cards"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
