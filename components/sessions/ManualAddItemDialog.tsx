'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ManualAddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: {
    name: string;
    costBasis: number;
    imageUrl?: string;
    notes?: string;
  }) => Promise<void>;
}

export function ManualAddItemDialog({ open, onOpenChange, onAdd }: ManualAddItemDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    costBasis: 0,
    imageUrl: '',
    notes: ''
  });

  const handleSubmit = async () => {
    if (!form.name || form.costBasis <= 0) {
      alert('Please provide a name and cost basis');
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        name: form.name,
        costBasis: form.costBasis,
        imageUrl: form.imageUrl || undefined,
        notes: form.notes || undefined
      });

      // Reset form
      setForm({ name: '', costBasis: 0, imageUrl: '', notes: '' });
      onOpenChange(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Item to Run List</DialogTitle>
          <DialogDescription>
            Add a single item to this session manually
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item_name">Item Name</Label>
            <Input
              id="item_name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., 2023 Topps Chrome Mike Trout PSA 10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_basis">Cost Basis</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input
                id="cost_basis"
                type="number"
                step="0.01"
                min="0"
                value={form.costBasis || ''}
                onChange={(e) => setForm({ ...form, costBasis: parseFloat(e.target.value) || 0 })}
                className="pl-6"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">Image URL (optional)</Label>
            <Input
              id="image_url"
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional details"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding...' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
