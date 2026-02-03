"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { MoreHorizontal, DollarSign, Plus, Archive, ImageIcon, List, LayoutGrid, RefreshCw } from "lucide-react";
import { AddToSessionModal } from "../modals/AddToSessionModal";

interface ActiveItem {
  id: string;
  name: string | null;
  cost_basis: number | null;
  created_at: string;
  image_url: string | null;
  photo_url: string | null;
  status: string | null;
  in_session: boolean;
  session_name?: string | null;
  lyve_value?: number | null;
  lyve_range_low?: number | null;
  lyve_range_high?: number | null;
  lyve_comp_source?: string | null;
  lyve_comp_sample_size?: number | null;
  lyve_comp_confidence?: string | null;
  lyve_value_updated_at?: string | null;
}

interface Session {
  id: string;
  name: string;
  created_at: string;
}

interface ActiveItemsTabProps {
  userId: string;
  searchQuery: string;
  sessions: Session[];
  onMarkSold: (itemId: string) => void;
  onRefresh: () => void;
}

export function ActiveItemsTab({ 
  userId, 
  searchQuery, 
  sessions, 
  onMarkSold, 
  onRefresh 
}: ActiveItemsTabProps) {
  const [items, setItems] = useState<ActiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addToSessionItem, setAddToSessionItem] = useState<string | null>(null);
  const [refreshingComps, setRefreshingComps] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // Build query
      let query = supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          display_name,
          cost_basis,
          created_at,
          image_url,
          photo_url,
          status,
          lifecycle_status,
          lyve_value,
          lyve_range_low,
          lyve_range_high,
          lyve_comp_source,
          lyve_comp_sample_size,
          lyve_comp_confidence,
          lyve_value_updated_at,
          session_items(session_id, session:sessions(name))
        `)
        .eq('user_id', userId);

      // Filter for active items (not sold, not archived)
      query = query.or('status.eq.ACTIVE,status.is.null');
      
      // Also exclude items with lifecycle_status = sold or archived (backwards compat)
      query = query.not('lifecycle_status', 'eq', 'sold');
      query = query.not('lifecycle_status', 'eq', 'archived');

      // Apply search filter
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`);
      }

      // Apply sort
      const sortField = sortBy === 'cost' ? 'cost_basis' : 
                        sortBy === 'name' ? 'name' : 'created_at';
      query = query.order(sortField, { ascending: sortDir === 'asc', nullsFirst: false });

      const { data, error: fetchError } = await query.limit(200);

      if (fetchError) throw fetchError;

      // Also check sales table to exclude sold items
      const { data: salesData } = await supabase
        .from('sales')
        .select('item_id')
        .eq('user_id', userId);
      
      const soldItemIds = new Set((salesData || []).map(s => s.item_id));

      // Transform data
      const transformed: ActiveItem[] = (data || [])
        .filter(item => !soldItemIds.has(item.id))
        .map(item => {
          // Get session info
          let sessionName: string | null = null;
          let inSession = false;
          
          if (item.session_items && Array.isArray(item.session_items) && item.session_items.length > 0) {
            inSession = true;
            const firstSession = item.session_items[0];
            if (firstSession.session) {
              const session = Array.isArray(firstSession.session) 
                ? firstSession.session[0] 
                : firstSession.session;
              sessionName = session?.name || null;
            }
          }

          return {
            id: item.id,
            name: item.name || item.display_name || `Item`,
            cost_basis: item.cost_basis,
            created_at: item.created_at,
            image_url: item.image_url,
            photo_url: item.photo_url,
            status: item.status || item.lifecycle_status,
            in_session: inSession,
            session_name: sessionName,
          };
        });

      // Apply session filter client-side
      let filtered = transformed;
      if (sessionFilter && sessionFilter !== "all") {
        if (sessionFilter === "not_in_session") {
          filtered = filtered.filter(item => !item.in_session);
        } else {
          filtered = filtered.filter(item => item.session_name === sessionFilter);
        }
      }

      setItems(filtered);
    } catch (err) {
      console.error('Error loading active items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, sortBy, sortDir, sessionFilter]);

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
          status: 'ARCHIVED',
          lifecycle_status: 'archived',
        })
        .eq('id', itemId);

      if (archiveError) throw archiveError;

      setItems(prev => prev.filter(item => item.id !== itemId));
      onRefresh();
    } catch (err) {
      console.error('Error archiving item:', err);
      alert('Failed to archive item');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshComps = async (itemId: string) => {
    setRefreshingComps(itemId);
    try {
      const response = await fetch(`/api/items/${itemId}/comps/refresh`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh comps');
      }

      // Update the item in state with new comp values
      setItems(prev => prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              lyve_value: data.lyve_value,
              lyve_range_low: data.lyve_range_low,
              lyve_range_high: data.lyve_range_high,
              lyve_comp_source: data.source,
              lyve_comp_sample_size: data.sample_size,
              lyve_comp_confidence: data.confidence,
              lyve_value_updated_at: data.updated_at,
            }
          : item
      ));
    } catch (err) {
      console.error('Error refreshing comps:', err);
      alert(err instanceof Error ? err.message : 'Failed to refresh comps');
    } finally {
      setRefreshingComps(null);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getConfidenceBadgeVariant = (confidence: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
    if (confidence === 'high') return 'default';
    if (confidence === 'medium') return 'secondary';
    if (confidence === 'low') return 'outline';
    return 'outline';
  };

  if (loading) {
    return <LoadingState message="Loading inventory..." />;
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
        icon={<ImageIcon className="w-8 h-8 text-muted-foreground" />}
        title="No active inventory"
        description={searchQuery 
          ? "No items match your search" 
          : "Add your first item to start tracking your inventory"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All items" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="not_in_session">Not in a session</SelectItem>
              {sessions.slice(0, 10).map(session => (
                <SelectItem key={session.id} value={session.name}>
                  {session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date Added</SelectItem>
              <SelectItem value="acquired">Acquired</SelectItem>
              <SelectItem value="cost">Cost</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortDir(prev => prev === "asc" ? "desc" : "asc")}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </Button>
        </div>
        
        <div className="flex items-center gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Item Count */}
      <p className="text-sm text-muted-foreground">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12"></TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead className="text-right">Cost Basis</TableHead>
                <TableHead className="text-right">lyve value</TableHead>
                <TableHead className="text-right">lyverange</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Acquired</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} className="group">
                  <TableCell>
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                      {(item.image_url || item.photo_url) ? (
                        <img 
                          src={item.image_url || item.photo_url || ''} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    {item.session_name && (
                      <div className="text-xs text-muted-foreground">In: {item.session_name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.cost_basis)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.lyve_value != null ? (
                      <div>
                        <div className="font-medium">{formatCurrency(item.lyve_value ?? null)}</div>
                        {item.lyve_comp_confidence && (
                          <Badge variant={getConfidenceBadgeVariant(item.lyve_comp_confidence)} className="text-xs mt-1">
                            {item.lyve_comp_confidence}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {item.lyve_range_low != null && item.lyve_range_high != null ? (
                      <div>
                        {formatCurrency(item.lyve_range_low ?? null)} - {formatCurrency(item.lyve_range_high ?? null)}
                        {item.lyve_comp_sample_size && (
                          <div className="text-xs mt-0.5">n={item.lyve_comp_sample_size}</div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.lyve_value_updated_at ? (
                      <div>
                        <div>{formatDate(item.lyve_value_updated_at)}</div>
                        {item.lyve_comp_source && (
                          <div className="text-xs opacity-60">{item.lyve_comp_source.replace('ebay_', '')}</div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.created_at)}
                  </TableCell>
                  <TableCell>
                    {item.in_session ? (
                      <Badge variant="outline" className="text-xs">In Session</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleRefreshComps(item.id)}
                          disabled={refreshingComps === item.id}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${refreshingComps === item.id ? 'animate-spin' : ''}`} />
                          Refresh Comps
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onMarkSold(item.id)}>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Mark Sold
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAddToSessionItem(item.id)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add to Session
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleArchive(item.id)}
                          disabled={actionLoading === item.id}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="aspect-square bg-muted relative">
                {(item.image_url || item.photo_url) ? (
                  <img 
                    src={item.image_url || item.photo_url || ''} 
                    alt={item.name || 'Item'} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                
                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRefreshComps(item.id)}
                    disabled={refreshingComps === item.id}
                  >
                    <RefreshCw className={`mr-1 h-3 w-3 ${refreshingComps === item.id ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onMarkSold(item.id)}>
                    <DollarSign className="mr-1 h-3 w-3" />
                    Sell
                  </Button>
                </div>

                {item.in_session && (
                  <Badge variant="secondary" className="absolute top-2 left-2 text-xs bg-background/80">
                    In Session
                  </Badge>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm truncate" title={item.name || undefined}>
                  {item.name}
                </p>
                {item.lyve_value != null ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-primary">
                        {formatCurrency(item.lyve_value ?? null)}
                      </p>
                      {item.lyve_comp_confidence && (
                        <Badge variant={getConfidenceBadgeVariant(item.lyve_comp_confidence)} className="text-xs">
                          {item.lyve_comp_confidence}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cost: {formatCurrency(item.cost_basis)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-primary">
                    {formatCurrency(item.cost_basis)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add to Session Modal */}
      <AddToSessionModal
        open={!!addToSessionItem}
        onOpenChange={(open) => !open && setAddToSessionItem(null)}
        itemId={addToSessionItem}
        itemName={items.find(i => i.id === addToSessionItem)?.name || null}
        sessions={sessions}
        onSuccess={() => {
          setAddToSessionItem(null);
          loadItems();
        }}
      />
    </div>
  );
}
