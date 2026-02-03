"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { LyvefolioFilters } from "@/lib/types/lyvefolio";
import { Archive, RotateCcw, Trash2, ImageIcon } from "lucide-react";

// Local simplified type since the view type is too strict
interface ArchivedItem {
  id: string;
  name: string | null;
  cost_basis: number | null;
  created_at: string;
  image_url: string | null;
  serial_number: string | null;
  condition: string | null;
  archived_at: string | null;
  session_id: string | null;
  session_name: string | null;
}

interface ArchivedTabProps {
  filters: LyvefolioFilters;
  userId: string;
  onRefresh: () => void;
}

export function ArchivedTab({ filters, userId, onRefresh }: ArchivedTabProps) {
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          cost_basis,
          created_at,
          updated_at,
          lifecycle_status,
          image_url,
          serial_number,
          condition,
          session_items(
            session:sessions(id, name)
          )
        `)
        .eq('user_id', userId)
        .eq('lifecycle_status', 'archived');

      // Apply search filter
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      // Apply sort
      const sortField = filters.sort_by === 'cost' ? 'cost_basis' : 
                        filters.sort_by === 'name' ? 'name' : 'updated_at';
      query = query.order(sortField, { ascending: filters.sort_direction === 'asc' });

      const { data, error: fetchError } = await query.limit(100);

      if (fetchError) throw fetchError;

      // Transform the data
      const transformed: ArchivedItem[] = (data || []).map(item => {
        // Extract session info
        let sessionId = null;
        let sessionName = null;
        if (item.session_items && Array.isArray(item.session_items) && item.session_items.length > 0) {
          const sessionItem = item.session_items[0];
          if (sessionItem.session) {
            const session = Array.isArray(sessionItem.session) 
              ? sessionItem.session[0] 
              : sessionItem.session;
            sessionId = session?.id || null;
            sessionName = session?.name || null;
          }
        }

        return {
          id: item.id,
          name: item.name,
          cost_basis: item.cost_basis,
          created_at: item.created_at,
          lifecycle_status: 'archived' as const,
          image_url: item.image_url,
          serial_number: item.serial_number,
          condition: item.condition,
          archived_at: item.updated_at || item.created_at,
          session_id: sessionId,
          session_name: sessionName,
        };
      });

      // Apply session filter client-side
      const filtered = filters.session_id 
        ? transformed.filter(item => item.session_id === filters.session_id)
        : transformed;

      setItems(filtered);
    } catch (err) {
      console.error('Error loading archived items:', err);
      setError('Failed to load archived items');
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRestore = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      const supabase = createClient();
      const { error: restoreError } = await supabase
        .from('inventory_items')
        .update({ 
          lifecycle_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (restoreError) throw restoreError;
      
      // Remove from list
      setItems(prev => prev.filter(item => item.id !== itemId));
      onRefresh();
    } catch (err) {
      console.error('Error restoring item:', err);
      alert('Failed to restore item');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      const supabase = createClient();
      
      // First delete related session_items
      await supabase
        .from('session_items')
        .delete()
        .eq('inventory_item_id', itemId);

      // Then delete the item
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;
      
      // Remove from list
      setItems(prev => prev.filter(item => item.id !== itemId));
      onRefresh();
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <LoadingState message="Loading archived items..." />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">{error}</p>
          <Button onClick={loadItems} variant="outline" className="mt-4 mx-auto block">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Archive className="w-6 h-6 text-muted-foreground" />}
        title="No archived items"
        description={filters.search || filters.session_id 
          ? "No archived items match your current filters" 
          : "Items you archive will appear here"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
        <Archive className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {items.length} archived {items.length === 1 ? 'item' : 'items'} • 
          Total cost basis: ${items.reduce((sum, i) => sum + (i.cost_basis || 0), 0).toFixed(2)}
        </span>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map(item => (
          <Card key={item.id} className="overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
            {/* Image Area */}
            <div className="aspect-square bg-muted relative">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={item.name || 'Archived item'} 
                  className="w-full h-full object-cover grayscale"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
              
              {/* Archived Badge */}
              <Badge 
                variant="secondary" 
                className="absolute top-2 left-2 bg-gray-200 text-gray-600"
              >
                ARCHIVED
              </Badge>
            </div>

            {/* Card Content */}
            <CardContent className="p-4">
              <h3 className="font-medium truncate text-muted-foreground" title={item.name || undefined}>
                {item.name}
              </h3>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-semibold text-muted-foreground">
                  ${item.cost_basis?.toFixed(2) || '0.00'}
                </span>
                {item.condition && (
                  <Badge variant="outline" className="text-xs">
                    {item.condition}
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Archived: {item.archived_at ? new Date(item.archived_at).toLocaleDateString() : 'Unknown'}
              </p>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleRestore(item.id)}
                  disabled={actionLoading === item.id}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={actionLoading === item.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete &ldquo;{item.name}&rdquo; and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete(item.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
