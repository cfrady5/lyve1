'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Lock, Unlock, CheckCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import type { Session, SessionExpense, Break, SessionItem, ShowType } from '@/lib/types/sessions';
import { SHOW_TYPE_LABELS, PLATFORM_LABELS } from '@/lib/types/sessions';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { BreakConfiguration } from '@/components/sessions/preshow/BreakConfiguration';
import { ExpensesSection } from '@/components/sessions/preshow/ExpensesSection';
import { BreakevenCalculator } from '@/components/sessions/preshow/BreakevenCalculator';
import { PostShowReconciliation } from '@/components/sessions/postshow/PostShowReconciliation';
import { WhatnotCSVImporter } from '@/components/sessions/postshow/WhatnotCSVImporter';
import { RapidPhotoUpload } from '@/components/sessions/RapidPhotoUpload';
import { ImportPreshowCSV } from '@/components/sessions/ImportPreshowCSV';
import { ManualAddItemDialog } from '@/components/sessions/ManualAddItemDialog';
import * as sessionsService from '@/lib/services/sessions';

interface SessionDetailContentProps {
  sessionId: string;
  userId: string;
}

export function SessionDetailContent({ sessionId, userId }: SessionDetailContentProps) {
  const supabase = createClient();

  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [expenses, setExpenses] = useState<SessionExpense[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await sessionsService.getSession(supabase, sessionId);
      if (sessionError || !sessionData) {
        setError('Session not found');
        return;
      }

      // Ensure session has default values for new fields
      const enhancedSession: Session = {
        ...sessionData,
        show_type: sessionData.show_type || 'singles_only',
        estimated_fee_rate: sessionData.estimated_fee_rate ?? 0.12,
        sell_through_singles_percent: sessionData.sell_through_singles_percent ?? 100,
        sell_through_breaks_percent: sessionData.sell_through_breaks_percent ?? 100,
        revenue_allocation_singles_percent: sessionData.revenue_allocation_singles_percent ?? 50,
      };

      setSession(enhancedSession);

      // Load session items
      try {
        const { data: sessionItemsData } = await supabase
          .from('session_items')
          .select(`
            id,
            session_id,
            item_id,
            item_number,
            position,
            added_via,
            created_at,
            updated_at,
            inventory_items!inner(
              id,
              name,
              display_name,
              cost_basis,
              image_url,
              photo_url,
              status
            )
          `)
          .eq('session_id', sessionId)
          .order('position', { ascending: true });

        if (sessionItemsData) {
          setItems(sessionItemsData.map(si => {
            const item = Array.isArray(si.inventory_items) ? si.inventory_items[0] : si.inventory_items;
            return {
              id: si.id,
              session_id: si.session_id,
              item_id: si.item_id,
              item_number: si.item_number,
              position: si.position,
              added_via: (si.added_via as 'photo' | 'preshow_csv' | 'manual') || 'manual',
              created_at: si.created_at,
              updated_at: si.updated_at,
              item: {
                id: item?.id || '',
                name: item?.name,
                display_name: item?.display_name,
                cost_basis: item?.cost_basis || 0,
                image_url: item?.image_url,
                photo_url: item?.photo_url,
                status: item?.status || 'ACTIVE',
              },
            };
          }));
        }
      } catch (err) {
        console.error('Error loading session items:', err);
        setItems([]);
      }

      // Load expenses
      try {
        const { data: expensesData } = await supabase
          .from('session_expenses')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        setExpenses(expensesData || []);
      } catch (err) {
        console.error('Error loading expenses:', err);
        setExpenses([]);
      }

      // Load breaks
      try {
        const { data: breaksData } = await supabase
          .from('breaks')
          .select('*')
          .eq('session_id', sessionId)
          .order('position', { ascending: true, nullsFirst: false });

        setBreaks((breaksData || []).map(b => ({
          ...b,
          break_style: b.break_style || 'random_drafted',
          break_type: b.break_type || 'single_product',
          spot_count: b.spot_count || b.slots_count || 30,
        })));
      } catch (err) {
        console.error('Error loading breaks:', err);
        setBreaks([]);
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleShowTypeChange = async (showType: ShowType) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ show_type: showType })
        .eq('id', sessionId);

      if (error) throw error;

      setSession({ ...session, show_type: showType });
    } catch (err) {
      console.error('Failed to update show type:', err);
      alert('Failed to update show type');
    }
  };

  const handleSessionUpdate = async (updates: Partial<Session>) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;

      setSession({ ...session, ...updates });
    } catch (err) {
      console.error('Failed to update session:', err);
      alert('Failed to update session');
    }
  };

  const handleFinalizeSession = async () => {
    if (!confirm('Finalize this session? This will lock the run order and prepare for post-show reconciliation.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'FINALIZED',
          finalized_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;

      await loadSession();
      alert('Session finalized successfully!');
    } catch (err) {
      console.error('Failed to finalize session:', err);
      alert('Failed to finalize session');
    }
  };

  const handleUnfinalizeSession = async () => {
    if (!confirm('Unlock this session? You will be able to edit items and run order again.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'DRAFT',
          finalized_at: null,
        })
        .eq('id', sessionId);

      if (error) throw error;

      await loadSession();
      alert('Session unlocked successfully!');
    } catch (err) {
      console.error('Failed to unlock session:', err);
      alert('Failed to unlock session');
    }
  };

  const handlePhotoUpload = async (items: Array<{ name: string; costBasis: number; imageUrl?: string; file: File }>) => {
    try {
      // Upload images and create items
      const itemsWithImages = await Promise.all(
        items.map(async (item) => {
          let imageUrl = item.imageUrl;

          if (item.file) {
            // Upload image to Supabase Storage
            const fileName = `${sessionId}/${Date.now()}_${item.file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('item-images')
              .upload(fileName, item.file);

            if (uploadError) {
              console.error('Error uploading image:', uploadError);
            } else {
              const { data: urlData } = supabase.storage
                .from('item-images')
                .getPublicUrl(uploadData.path);
              imageUrl = urlData.publicUrl;
            }
          }

          return {
            name: item.name,
            costBasis: item.costBasis,
            imageUrl,
          };
        })
      );

      await sessionsService.batchAddItemsToSession(
        supabase,
        userId,
        sessionId,
        itemsWithImages,
        undefined,
        'photo'
      );

      await loadSession();
      setPhotoUploadOpen(false);
    } catch (err) {
      console.error('Failed to upload photos:', err);
      alert('Failed to upload photos');
    }
  };

  const handleItemsImport = async (importedItems: Array<{ name: string; costBasis: number; itemNumber?: number; notes?: string }>) => {
    try {
      await sessionsService.batchAddItemsToSession(
        supabase,
        userId,
        sessionId,
        importedItems.map(item => ({
          name: item.name,
          costBasis: item.costBasis,
          notes: item.notes,
        })),
        undefined,
        'preshow_csv'
      );

      await loadSession();
    } catch (err) {
      throw err; // Re-throw to be caught by ImportPreshowCSV
    }
  };

  const handleManualAddItem = async (item: { name: string; costBasis: number; imageUrl?: string; notes?: string }) => {
    try {
      await sessionsService.batchAddItemsToSession(
        supabase,
        userId,
        sessionId,
        [item],
        undefined,
        'manual'
      );

      await loadSession();
      setManualAddOpen(false);
    } catch (err) {
      console.error('Failed to add item:', err);
      alert('Failed to add item');
    }
  };

  // Calculate costs
  const inventoryCost = items.reduce((sum, item) => sum + (item.item?.cost_basis || 0), 0);

  // Calculate breaks cost - need to load boxes for mixer breaks
  const [breaksCost, setBreaksCost] = useState(0);

  useEffect(() => {
    const calculateBreaksCost = async () => {
      let total = 0;

      for (const breakItem of breaks) {
        if (breakItem.break_type === 'mixer') {
          // For mixer breaks, sum up the boxes
          const { data: boxes } = await supabase
            .from('break_boxes')
            .select('quantity, price_paid_per_box')
            .eq('break_id', breakItem.id);

          if (boxes) {
            const mixerCost = boxes.reduce((sum, box) =>
              sum + (box.quantity * box.price_paid_per_box), 0
            );
            total += mixerCost;
          }
        } else {
          // For single product breaks, use box_cost
          total += breakItem.box_cost || 0;
        }
      }

      setBreaksCost(total);
    };

    if (breaks.length > 0) {
      calculateBreaksCost();
    } else {
      setBreaksCost(0);
    }
  }, [breaks, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error || 'Session not found'}</p>
            <Button asChild className="mt-4">
              <Link href="/sessions">Back to Sessions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDraft = session.status === 'DRAFT';
  const isFinalized = session.status === 'FINALIZED';
  const isReconciled = session.status === 'RECONCILED';
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="container max-w-[1800px] mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sessions">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{session.title || session.name}</h1>
            <p className="text-sm text-muted-foreground">
              {session.date ? new Date(session.date).toLocaleDateString() : 'No date set'} • {PLATFORM_LABELS[session.platform]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={session.status} />
          {isDraft && (
            <Button onClick={handleFinalizeSession}>
              <Lock className="h-4 w-4 mr-2" />
              Finalize Stream
            </Button>
          )}
          {isFinalized && !isReconciled && (
            <>
              <Button variant="outline" onClick={handleUnfinalizeSession}>
                <Unlock className="h-4 w-4 mr-2" />
                Unlock
              </Button>
              <Button
                onClick={() => {
                  const postShowSection = document.getElementById('post-show-section');
                  postShowSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Show Completed?
              </Button>
            </>
          )}
          {isReconciled && (
            <Button asChild>
              <Link href={`/sessions/${sessionId}/report`}>
                <FileText className="h-4 w-4 mr-2" />
                see lyve report
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Show Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Show Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={session.show_type}
            onValueChange={(v) => handleShowTypeChange(v as ShowType)}
            disabled={!isDraft}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="singles_only">{SHOW_TYPE_LABELS.singles_only}</SelectItem>
              <SelectItem value="breaks_only">{SHOW_TYPE_LABELS.breaks_only}</SelectItem>
              <SelectItem value="mixed">{SHOW_TYPE_LABELS.mixed}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Main Content: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Content Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Inventory Run List (Singles) */}
          {(session.show_type === 'singles_only' || session.show_type === 'mixed') && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventory Run List</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {items.length} item{items.length !== 1 ? 's' : ''} loaded
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPhotoUploadOpen(true)}
                      disabled={!isDraft}
                    >
                      Upload Photos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCsvImportOpen(true)}
                      disabled={!isDraft}
                    >
                      Import CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManualAddOpen(true)}
                      disabled={!isDraft}
                    >
                      Add Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No items added yet.</p>
                    <p className="text-sm mt-1">Upload photos, import a CSV, or add items manually to get started.</p>
                  </div>
                ) : (
                  <div className="grid gap-2 max-h-96 overflow-y-auto">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <Badge variant="outline" className="font-mono">
                          #{item.item_number}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {item.item?.display_name || item.item?.name || 'Unnamed Item'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cost: ${(item.item?.cost_basis || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Break Configuration */}
          {(session.show_type === 'breaks_only' || session.show_type === 'mixed') && (
            <BreakConfiguration
              sessionId={sessionId}
              breaks={breaks}
              sessionFeeRate={session.estimated_fee_rate || 0.12}
              sessionProfitTarget={session.profit_target_amount || 0}
              totalSessionExpenses={totalExpenses}
              onBreaksChange={loadSession}
            />
          )}

          {/* Expenses */}
          {!isReconciled && (
            <ExpensesSection
              sessionId={sessionId}
              expenses={expenses}
              onExpensesChange={loadSession}
            />
          )}

          {/* Post-Show Reconciliation */}
          {isFinalized && !isReconciled && (
            <div id="post-show-section">
              {session.platform === 'whatnot' ? (
                <WhatnotCSVImporter
                  session={session}
                  items={items}
                  onReconciled={loadSession}
                />
              ) : (
                <PostShowReconciliation
                  session={session}
                  items={items}
                  inventoryCost={inventoryCost}
                  breaksCost={breaksCost}
                  totalExpenses={totalExpenses}
                  onReconciled={loadSession}
                />
              )}
            </div>
          )}

          {/* Post-Show Analytics (After Reconciled) */}
          {isReconciled && (
            <div id="post-show-section">
              {session.platform === 'whatnot' ? (
                <WhatnotCSVImporter
                  session={session}
                  items={items}
                  onReconciled={loadSession}
                />
              ) : (
                <PostShowReconciliation
                  session={session}
                  items={items}
                  inventoryCost={inventoryCost}
                  breaksCost={breaksCost}
                  totalExpenses={totalExpenses}
                  onReconciled={loadSession}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column: Breakeven Calculator (Sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <BreakevenCalculator
              session={session}
              inventoryCost={inventoryCost}
              breaksCost={breaksCost}
              expenses={expenses}
              itemCount={items.length}
              breaks={breaks}
              onSessionUpdate={handleSessionUpdate}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <RapidPhotoUpload
        open={photoUploadOpen}
        onOpenChange={setPhotoUploadOpen}
        onUpload={handlePhotoUpload}
      />

      <ImportPreshowCSV
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onImport={handleItemsImport}
      />

      <ManualAddItemDialog
        open={manualAddOpen}
        onOpenChange={setManualAddOpen}
        onAdd={handleManualAddItem}
      />
    </div>
  );
}
