"use client";

import { useState, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Camera, Upload, ChevronDown, Loader2 } from "lucide-react";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
}

export function AddItemModal({
  open,
  onOpenChange,
  userId,
  onSuccess,
}: AddItemModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMoreFields, setShowMoreFields] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [acquiredAt, setAcquiredAt] = useState(new Date().toISOString().split('T')[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Optional fields
  const [notes, setNotes] = useState("");
  const [player, setPlayer] = useState("");
  const [setNameField, setSetNameField] = useState("");
  const [year, setYear] = useState("");
  const [grade, setGrade] = useState("");
  const [grader, setGrader] = useState("");

  const resetForm = () => {
    setName("");
    setCostBasis("");
    setAcquiredAt(new Date().toISOString().split('T')[0]);
    setImageFile(null);
    setImagePreview(null);
    setNotes("");
    setPlayer("");
    setSetNameField("");
    setYear("");
    setGrade("");
    setGrader("");
    setError(null);
    setShowMoreFields(false);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Item name is required");
      return;
    }
    
    if (!costBasis || parseFloat(costBasis) < 0) {
      setError("Valid cost basis is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      let photoUrl = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('inventory-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('inventory-images')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      // Create inventory item
      const { error: insertError } = await supabase
        .from('inventory_items')
        .insert({
          user_id: userId,
          name: name.trim(),
          display_name: name.trim(),
          cost_basis: parseFloat(costBasis),
          photo_url: photoUrl,
          image_url: photoUrl,
          status: 'ACTIVE',
          lifecycle_status: 'active',
          notes: notes.trim() || null,
          player: player.trim() || null,
          set_name: setNameField.trim() || null,
          year: year ? parseInt(year) : null,
          grade: grade.trim() || null,
          grader: grader.trim() || null,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      resetForm();
      onSuccess();
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              Add a new item to your inventory
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-danger-subtle bg-danger-subtle border border-danger-subtle rounded-md">
                {error}
              </div>
            )}

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              {imagePreview ? (
                <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                </div>
              )}
            </div>

            {/* Item Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                placeholder="e.g., 2023 Topps Chrome Wander Franco RC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Cost Basis */}
            <div className="space-y-2">
              <Label htmlFor="costBasis">Cost Basis *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="costBasis"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={costBasis}
                  onChange={(e) => setCostBasis(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>

            {/* Acquired Date */}
            <div className="space-y-2">
              <Label htmlFor="acquiredAt">Acquired Date</Label>
              <Input
                id="acquiredAt"
                type="date"
                value={acquiredAt}
                onChange={(e) => setAcquiredAt(e.target.value)}
              />
            </div>

            {/* More Details Collapsible */}
            <Collapsible open={showMoreFields} onOpenChange={setShowMoreFields}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="w-full justify-between">
                  More details
                  <ChevronDown className={`h-4 w-4 transition-transform ${showMoreFields ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="player">Player</Label>
                    <Input
                      id="player"
                      placeholder="e.g., Wander Franco"
                      value={player}
                      onChange={(e) => setPlayer(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      placeholder="e.g., 2023"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="setName">Set Name</Label>
                  <Input
                    id="setName"
                    placeholder="e.g., Topps Chrome"
                    value={setNameField}
                    onChange={(e) => setSetNameField(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade</Label>
                    <Input
                      id="grade"
                      placeholder="e.g., PSA 10"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grader">Grader</Label>
                    <Input
                      id="grader"
                      placeholder="e.g., PSA"
                      value={grader}
                      onChange={(e) => setGrader(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
