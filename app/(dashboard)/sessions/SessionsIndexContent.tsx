"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  MoreHorizontal,
  Package,
  DollarSign,
  TrendingUp,
  Calendar,
  Copy,
  Trash2,
  ArrowUpDown,
  Loader2,
  FileText,
} from "lucide-react";

interface SessionOverview {
  id: string;
  name: string;
  title: string | null;
  date: string;
  platform: string;
  status: string;
  item_count: number;
  sold_count: number;
  gross_revenue: number;
  total_expenses: number;
  net_profit: number;
}

const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'whatnot', label: 'Whatnot' },
  { value: 'ebay', label: 'eBay' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'show', label: 'Show/Event' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'FINALIZED', label: 'Finalized' },
  { value: 'RECONCILED', label: 'Reconciled' },
];

export function SessionsIndexContent({ userId }: { userId: string }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy] = useState<"date" | "name" | "revenue">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Create session dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionPlatform, setNewSessionPlatform] = useState("whatnot");
  const [creating, setCreating] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Query sessions with new schema columns
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        name,
        title,
        date,
        platform,
        status,
        created_at
      `)
      .eq('user_id', userId)
      .order(sortBy === 'date' ? 'date' : sortBy === 'name' ? 'name' : 'created_at', {
        ascending: sortDir === 'asc',
        nullsFirst: false
      });

    if (error) {
      console.error('Error loading sessions:', error);
      setLoading(false);
      return;
    }

    // For each session, calculate rollups
    const sessionsWithRollups = await Promise.all(
      (data || []).map(async (s) => {
        // Get item count from session_items
        const { count: itemCount } = await supabase
          .from('session_items')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id);

        // Get sales data for this session
        const { data: salesData } = await supabase
          .from('sales')
          .select('sold_price, fees, taxes_collected, shipping_cost, inventory_items!inner(cost_basis)')
          .eq('session_id', s.id);

        const soldCount = salesData?.length || 0;
        const grossRevenue = salesData?.reduce((sum, sale) => sum + (sale.sold_price || 0), 0) || 0;
        const totalFees = salesData?.reduce((sum, sale) => sum + (sale.fees || 0) + (sale.taxes_collected || 0) + (sale.shipping_cost || 0), 0) || 0;
        const cogs = salesData?.reduce((sum, sale) => {
          const itemData = Array.isArray(sale.inventory_items) ? sale.inventory_items[0] : sale.inventory_items;
          return sum + (itemData?.cost_basis || 0);
        }, 0) || 0;

        // Get expenses
        const { data: expensesData } = await supabase
          .from('session_expenses')
          .select('amount')
          .eq('session_id', s.id);

        const totalExpenses = expensesData?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

        // Calculate net profit
        const netProfit = grossRevenue - totalFees - cogs - totalExpenses;

        return {
          id: s.id,
          name: s.name || '',
          title: s.title || s.name || 'Untitled Session',
          date: s.date || s.created_at,
          platform: s.platform || 'whatnot',
          status: s.status || 'DRAFT',
          item_count: itemCount || 0,
          sold_count: soldCount,
          gross_revenue: grossRevenue,
          total_expenses: totalExpenses,
          net_profit: netProfit,
        } as SessionOverview;
      })
    );

    let transformed = sessionsWithRollups;

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      transformed = transformed.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.title && s.title.toLowerCase().includes(query))
      );
    }

    // Filter by platform
    if (platformFilter !== 'all') {
      transformed = transformed.filter((s) => s.platform === platformFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      transformed = transformed.filter((s) => s.status === statusFilter);
    }

    // Sort by revenue if needed
    if (sortBy === 'revenue') {
      transformed.sort((a, b) => {
        const diff = a.gross_revenue - b.gross_revenue;
        return sortDir === 'asc' ? diff : -diff;
      });
    }

    setSessions(transformed);
    setLoading(false);
  }, [userId, searchQuery, platformFilter, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;

    setCreating(true);
    const supabase = createClient();

    // Create session with new schema columns
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        name: newSessionName.trim(),
        title: newSessionName.trim(),
        platform: newSessionPlatform,
        status: 'DRAFT',
        date: new Date().toISOString(),
        estimated_fee_rate: newSessionPlatform === 'whatnot' ? 0.08 :
                            newSessionPlatform === 'ebay' ? 0.125 : 0.08,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      setCreating(false);
      return;
    }

    setCreateOpen(false);
    setNewSessionName("");
    setNewSessionPlatform("whatnot");
    setCreating(false);

    // Navigate to new session
    router.push(`/sessions/${data.id}`);
  };

  const handleDuplicate = async (sessionId: string, originalName: string) => {
    const supabase = createClient();

    // Get original session
    const { data: original, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !original) return;

    // Create new session - only use columns that exist in base schema
    const { data: newSession, error: createError } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        name: `${originalName} (Copy)`,
      })
      .select()
      .single();

    if (createError || !newSession) return;

    loadSessions();
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    const supabase = createClient();
    await supabase.from('sessions').delete().eq('id', sessionId);
    loadSessions();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'FINALIZED':
        return <Badge variant="outline" className="border-info-subtle text-info-subtle">Finalized</Badge>;
      case 'RECONCILED':
        return <Badge className="bg-success-subtle text-success-subtle">Reconciled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlatformLabel = (platform: string) => {
    return PLATFORMS.find((p) => p.value === platform)?.label || platform;
  };

  // Calculate totals
  const totals = sessions.reduce(
    (acc, s) => ({
      items: acc.items + s.item_count,
      sold: acc.sold + s.sold_count,
      revenue: acc.revenue + s.gross_revenue,
      profit: acc.profit + s.net_profit,
    }),
    { items: 0, sold: 0, revenue: 0, profit: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            Prep, run, and reconcile your livestream sessions
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Session
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.items.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{totals.sold} sold</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
              {formatCurrency(totals.profit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
        >
          <ArrowUpDown className="h-4 w-4 mr-1" />
          {sortDir === 'asc' ? 'Oldest First' : 'Newest First'}
        </Button>
      </div>

      {/* Sessions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Sessions Yet</CardTitle>
            <CardDescription>
              Create your first session to start tracking your livestreams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onDoubleClick={() => router.push(`/sessions/${session.id}`)}
                >
                  <TableCell>
                    <Link href={`/sessions/${session.id}`} className="block">
                      <div className="font-medium">{session.title || session.name}</div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(session.date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getPlatformLabel(session.platform)}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(session.status)}</TableCell>
                  <TableCell className="text-right">{session.item_count}</TableCell>
                  <TableCell className="text-right">{session.sold_count}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(session.gross_revenue)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${session.net_profit >= 0 ? 'text-success-subtle' : 'text-danger-subtle'}`}>
                    {formatCurrency(session.net_profit)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/sessions/${session.id}`}>
                            Open
                          </Link>
                        </DropdownMenuItem>
                        {session.status === 'RECONCILED' && (
                          <DropdownMenuItem asChild>
                            <Link href={`/sessions/${session.id}/report`}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Report
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDuplicate(session.id, session.name)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(session.id)}
                          className="text-danger-subtle"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Session Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
            <DialogDescription>
              Start a new session to prep your next stream or show
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sessionName">Session Name</Label>
              <Input
                id="sessionName"
                placeholder="e.g., Saturday Night Stream"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={newSessionPlatform} onValueChange={setNewSessionPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.filter((p) => p.value !== 'all').map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSession} disabled={creating || !newSessionName.trim()}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Session'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
