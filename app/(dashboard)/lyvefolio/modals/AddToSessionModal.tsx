"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface Session {
  id: string;
  name: string;
  created_at: string;
}

interface AddToSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  itemName: string | null;
  sessions: Session[];
  onSuccess: () => void;
}

export function AddToSessionModal({
  open,
  onOpenChange,
  itemId,
  itemName,
  sessions,
  onSuccess,
}: AddToSessionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [itemNumber, setItemNumber] = useState("");

  const resetForm = () => {
    setSelectedSessionId(null);
    setItemNumber("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemId) {
      setError("No item selected");
      return;
    }
    
    if (!selectedSessionId) {
      setError("Please select a session");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Check if item is already in this session
      const { data: existing } = await supabase
        .from('session_items')
        .select('id')
        .eq('session_id', selectedSessionId)
        .eq('item_id', itemId)
        .single();

      if (existing) {
        setError("This item is already in the selected session");
        setLoading(false);
        return;
      }

      // Get next item number if not specified
      let finalItemNumber = itemNumber ? parseInt(itemNumber) : null;
      if (!finalItemNumber) {
        const { data: maxItem } = await supabase
          .from('session_items')
          .select('item_number')
          .eq('session_id', selectedSessionId)
          .order('item_number', { ascending: false })
          .limit(1)
          .single();
        
        finalItemNumber = (maxItem?.item_number || 0) + 1;
      }

      // Create session_item link
      const { error: insertError } = await supabase
        .from('session_items')
        .insert({
          session_id: selectedSessionId,
          item_id: itemId,
          item_number: finalItemNumber,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      resetForm();
      onSuccess();
    } catch (err) {
      console.error('Error adding item to session:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item to session');
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
            <DialogTitle>Add to Session</DialogTitle>
            <DialogDescription>
              {itemName ? (
                <>Add <strong>{itemName}</strong> to a session</>
              ) : (
                "Select a session to add this item to"
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-danger-subtle bg-danger-subtle border border-danger-subtle rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="session">Session *</Label>
              <Select 
                value={selectedSessionId || ""} 
                onValueChange={(v) => setSelectedSessionId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a session..." />
                </SelectTrigger>
                <SelectContent>
                  {sessions.length === 0 ? (
                    <SelectItem value="none" disabled>No sessions available</SelectItem>
                  ) : (
                    sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemNumber">Item Number (optional)</Label>
              <Input
                id="itemNumber"
                type="number"
                min="1"
                placeholder="Auto-assign next number"
                value={itemNumber}
                onChange={(e) => setItemNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-assign the next available number
              </p>
            </div>
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
            <Button type="submit" disabled={loading || !selectedSessionId || sessions.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add to Session'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
