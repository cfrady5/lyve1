"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LyvefolioFilters } from "@/lib/types/lyvefolio";
import { MoreHorizontal, Archive, DollarSign, ImageIcon } from "lucide-react";

// Local simplified type for active items
interface ActiveItem {
  id: string;
  name: string;
  cost_basis: number | null;
  created_at: string;
  image_url: string | null;
  serial_number: string | null;
  condition: string | null;
  days_held: number;
  session_id: string | null;
  session_name: string | null;
}

interface ActiveTabProps {
  filters: LyvefolioFilters;
  userId: string;
  onRefresh: () => void;
}

export function ActiveTab({ filters, userId, onRefresh }: ActiveTabProps) {
  const [items, setItems] = useState<ActiveItem[]>([]);
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
          lifecycle_status,
          image_url,
          serial_number,
          condition,
          sessions:session_items(
            session:sessions(id, name)
          )
        `)
        .eq('user_id', userId)
        .or('lifecycle_status.eq.active,lifecycle_status.is.null');

      // Apply search filter
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      // Apply sort
      const sortField = filters.sort_by === 'cost' ? 'cost_basis' : 
                        filters.sort_by === 'name' ? 'name' : 'created_at';
      query = query.order(sortField, { ascending: filters.sort_direction === 'asc' });

      const { data, error: fetchError } = await query.limit(100);

      if (fetchError) throw fetchError;

      // Transform data to match the view structure
      const transformed: ActiveItem[] = (data || []).map(item => {
        const now = new Date();
        const created = new Date(item.created_at);
        const daysHeld = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        
        // Extract session info
        let sessionInfo = null;
        if (item.sessions && Array.isArray(item.sessions) && item.sessions.length > 0) {
          const firstSession = item.sessions[0];
          if ('session' in firstSession && firstSession.session) {
            const session = Array.isArray(firstSession.session) 
              ? firstSession.session[0] 
              : firstSession.session;
            sessionInfo = session;
          }
        }

        return {
          id: item.id,
          name: item.name,
          cost_basis: item.cost_basis,
          created_at: item.created_at,
          image_url: item.image_url,
          serial_number: item.serial_number,
          condition: item.condition,
          days_held: daysHeld,
          session_id: sessionInfo?.id || null,
          session_name: sessionInfo?.name || null,
        };
      });

      // Apply session filter client-side if needed
      const filtered = filters.session_id 
        ? transformed.filter(item => item.session_id === filters.session_id)
        : transformed;

      // Sort by days held if requested
      if (filters.sort_by === 'days_held') {
        filtered.sort((a, b) => {
          const comparison = a.days_held - b.days_held;
          return filters.sort_direction === 'asc' ? comparison : -comparison;
        });
      }

      setItems(filtered);
    } catch (err) {
      console.error('Error loading active items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleArchive = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      const supabase = createClient();
      const { error: archiveError } = await supabase
        .from('inventory_items')
        .update({ 
          lifecycle_status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (archiveError) throw archiveError;
      
      // Remove from list
      setItems(prev => prev.filter(item => item.id !== itemId));
      onRefresh();
    } catch (err) {
      console.error('Error archiving item:', err);
      alert('Failed to archive item');
    } finally {
      setActionLoading(null);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMarkSold = async (_itemId: string) => {
    // This would open a dialog to enter sale details
    // For now, we'll just show an alert
    alert('Mark as Sold feature coming soon - will open sale entry dialog');
  };

  if (loading) {
    return <LoadingState message="Loading active inventory..." />;
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
        icon={<ImageIcon className="w-6 h-6 text-muted-foreground" />}
        title="No active inventory"
        description={filters.search || filters.session_id 
          ? "No items match your current filters" 
          : "Add items to your inventory to see them here"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              ${items.reduce((sum, i) => sum + (i.cost_basis || 0), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total Cost Basis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {Math.round(items.reduce((sum, i) => sum + i.days_held, 0) / items.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Avg Days Held</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              ${items.length > 0 
                ? (items.reduce((sum, i) => sum + (i.cost_basis || 0), 0) / items.length).toFixed(2) 
                : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Avg Cost per Item</p>
          </CardContent>
        </Card>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map(item => (
          <Card key={item.id} className="overflow-hidden group hover:shadow-md transition-shadow">
            {/* Image Area */}
            <div className="aspect-square bg-muted relative">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={item.name || 'Item image'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
              
              {/* Days Held Badge */}
              <Badge 
                variant="secondary" 
                className="absolute top-2 left-2 text-xs bg-background/80 backdrop-blur-sm"
              >
                {item.days_held} days
              </Badge>

              {/* Actions Menu */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleMarkSold(item.id)}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Mark as Sold
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleArchive(item.id)}
                      disabled={actionLoading === item.id}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Card Content */}
            <CardContent className="p-4">
              <h3 className="font-medium truncate" title={item.name || undefined}>
                {item.name}
              </h3>
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-semibold text-primary">
                  ${item.cost_basis?.toFixed(2) || '0.00'}
                </span>
                {item.condition && (
                  <Badge variant="outline" className="text-xs">
                    {item.condition}
                  </Badge>
                )}
              </div>
              {item.session_name && (
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  Session: {item.session_name}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
