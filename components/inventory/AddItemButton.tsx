"use client";

import { useState, useRef } from "react";
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
import Image from "next/image";

interface AddItemButtonProps {
  sessionId: string;
  nextCardNumber: number;
}

export function AddItemButton({ sessionId, nextCardNumber }: AddItemButtonProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [currentCardNumber, setCurrentCardNumber] = useState(nextCardNumber);
  const [costBasis, setCostBasis] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setCostBasis("");
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent, addAnother = false) => {
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

      // Fetch session to get item_label_pattern
      const { data: session } = await supabase
        .from('sessions')
        .select('item_label_pattern')
        .eq('id', sessionId)
        .single();

      const itemLabelPattern = session?.item_label_pattern || 'Card #';

      // Generate display name based on pattern and card number
      const productName = `${itemLabelPattern}${currentCardNumber}`;

      // Classify the item
      const classification = classifyItem(productName);

      let imageUrl = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${sessionId}/${currentCardNumber}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('inventory-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          setError(`Image upload failed: ${uploadError.message}`);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('inventory-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      // Create inventory item with classification metadata
      const { error: createError } = await supabase
        .from('inventory_items')
        .insert({
          session_id: sessionId,
          card_number: currentCardNumber,
          cost_basis: parseFloat(costBasis),
          image_url: imageUrl,
          display_name: classification.displayName,
          normalized_key: classification.normalizedKey,
          bucket_type: classification.bucketType,
          item_index: classification.itemIndex,
        });

      if (createError) {
        setError(createError.message);
      } else {
        router.refresh();

        if (addAnother) {
          // Keep dialog open, reset form, increment card number
          resetForm();
          setCurrentCardNumber(currentCardNumber + 1);
        } else {
          // Close dialog and reset everything
          setOpen(false);
          resetForm();
          setCurrentCardNumber(nextCardNumber);
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) {
        // Reset to the current next card number when opening
        setCurrentCardNumber(nextCardNumber);
      }
    }}>
      <DialogTrigger asChild>
        <Button>Add Item</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e) => handleCreate(e, false)}>
          <DialogHeader>
            <DialogTitle>Add Card {currentCardNumber}</DialogTitle>
            <DialogDescription>
              Upload a photo and enter the cost basis for this item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-danger-subtle bg-danger-subtle border border-danger-subtle rounded">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Item Photo (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Click to Upload Photo
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost-basis">Cost Basis ($)</Label>
              <Input
                id="cost-basis"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => {
              setOpen(false);
              resetForm();
              setCurrentCardNumber(nextCardNumber);
            }}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={(e) => handleCreate(e as React.FormEvent, true)}
              >
                {loading ? "Adding..." : "Add & Continue"}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
