"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActiveTab } from "./tabs/ActiveTab";
import { SoldTab } from "./tabs/SoldTab";
import { ArchivedTab } from "./tabs/ArchivedTab";
import type { LyvefolioFilters } from "@/lib/types/lyvefolio";

interface Session {
  id: string;
  name: string;
  created_at: string;
}

interface LyvefolioTabsProps {
  initialCounts: {
    active: number;
    sold: number;
    archived: number;
  };
  sessions: Session[];
  userId: string;
}

export function LyvefolioTabs({ initialCounts, sessions, userId }: LyvefolioTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("active");
  const [counts, setCounts] = useState(initialCounts);
  const [filters, setFilters] = useState<LyvefolioFilters>({
    search: "",
    session_id: undefined,
    sort_by: "date",
    sort_direction: "desc",
  });
  const [searchInput, setSearchInput] = useState("");

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const refreshCounts = useCallback(async () => {
    const supabase = createClient();
    
    const [activeResult, soldResult, archivedResult, legacySoldResult] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .or('lifecycle_status.eq.active,lifecycle_status.is.null'),
      
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('lifecycle_status', 'sold'),
      
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('lifecycle_status', 'archived'),

      // Legacy sold detection
      supabase
        .from('inventory_items')
        .select('id, sale_items!inner(id)', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    const soldCount = soldResult.count || legacySoldResult.count || 0;
    const activeCount = Math.max(0, (activeResult.count || 0) - soldCount);

    setCounts({
      active: activeCount,
      sold: soldCount,
      archived: archivedResult.count || 0,
    });
  }, [userId]);

  const handleFilterChange = (key: keyof LyvefolioFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex-1 w-full sm:max-w-xs">
          <Input
            placeholder="Search items..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-background"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Session:</span>
          <Select 
            value={filters.session_id || "all"} 
            onValueChange={(v) => handleFilterChange("session_id", v)}
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="All Sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map(session => (
                <SelectItem key={session.id} value={session.id}>
                  {session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Sort:</span>
          <Select 
            value={filters.sort_by || "date"} 
            onValueChange={(v) => handleFilterChange("sort_by", v)}
          >
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="cost">Cost Basis</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              {activeTab === "sold" && (
                <>
                  <SelectItem value="profit">Profit</SelectItem>
                  <SelectItem value="roi">ROI %</SelectItem>
                </>
              )}
              {activeTab === "active" && (
                <SelectItem value="days_held">Days Held</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters(prev => ({
            ...prev,
            sort_direction: prev.sort_direction === "asc" ? "desc" : "asc"
          }))}
          className="text-muted-foreground hover:text-foreground"
        >
          {filters.sort_direction === "asc" ? "↑ Asc" : "↓ Desc"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-12 p-1 bg-muted/50">
          <TabsTrigger 
            value="active" 
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm h-full text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              Active
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {counts.active}
              </Badge>
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="sold" 
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm h-full text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              Sold
              <Badge variant="secondary" className="bg-success-subtle text-success-subtle text-xs px-1.5 py-0">
                {counts.sold}
              </Badge>
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="archived" 
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm h-full text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              Archived
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {counts.archived}
              </Badge>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <ActiveTab 
            filters={filters} 
            userId={userId}
            onRefresh={refreshCounts}
          />
        </TabsContent>

        <TabsContent value="sold" className="mt-6">
          <SoldTab 
            filters={filters} 
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <ArchivedTab 
            filters={filters} 
            userId={userId}
            onRefresh={refreshCounts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
