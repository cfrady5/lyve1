/**
 * Item Service
 * Handles inventory item CRUD and lifecycle state management
 */

import { createClient } from '@/lib/supabase/client';

export interface CreateItemParams {
  user_id: string;
  name?: string;
  cost_basis: number;
  estimated_value?: number;
  image_url?: string;
  photo_url?: string;
  notes?: string;
  acquired_at?: string;
  // Card-specific fields
  set_name?: string;
  year?: number;
  player?: string;
  grade?: string;
  cert_number?: string;
}

export interface AddItemToSessionParams {
  item_id: string;
  session_id: string;
  item_number: number;
  position?: number;
  added_via?: 'photo' | 'preshow_csv' | 'manual' | 'batch';
}

export interface MarkItemSoldParams {
  item_id: string;
  session_id?: string;
  platform_id?: string;
  platform_key?: string;
  sold_price: number;
  fees?: number;
  taxes_collected?: number;
  shipping_cost?: number;
  buyer_username?: string;
  order_id?: string;
  sold_at?: string;
  notes?: string;
}

export interface ArchiveItemParams {
  item_id: string;
  reason?: string;
  notes?: string;
}

/**
 * Create a new inventory item
 */
export async function createItem(params: CreateItemParams): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('inventory_items')
    .insert([
      {
        user_id: params.user_id,
        name: params.name,
        cost_basis: params.cost_basis,
        estimated_value: params.estimated_value,
        image_url: params.image_url || params.photo_url,
        photo_url: params.photo_url || params.image_url,
        notes: params.notes,
        acquired_at: params.acquired_at || new Date().toISOString(),
        status: 'ACTIVE',
        lifecycle_status: 'active',
        // Card fields
        set_name: params.set_name,
        year: params.year,
        player: params.player,
        grade: params.grade,
        cert_number: params.cert_number,
      },
    ])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create item: ${error.message}`);
  }

  return data.id;
}

/**
 * Create multiple items in batch
 */
export async function createItemsBatch(items: CreateItemParams[]): Promise<string[]> {
  const supabase = createClient();

  const itemsToInsert = items.map((item) => ({
    user_id: item.user_id,
    name: item.name,
    cost_basis: item.cost_basis,
    estimated_value: item.estimated_value,
    image_url: item.image_url || item.photo_url,
    photo_url: item.photo_url || item.image_url,
    notes: item.notes,
    acquired_at: item.acquired_at || new Date().toISOString(),
    status: 'ACTIVE',
    lifecycle_status: 'active',
    set_name: item.set_name,
    year: item.year,
    player: item.player,
    grade: item.grade,
    cert_number: item.cert_number,
  }));

  const { data, error } = await supabase
    .from('inventory_items')
    .insert(itemsToInsert)
    .select('id');

  if (error) {
    throw new Error(`Failed to create items: ${error.message}`);
  }

  return data.map((item) => item.id);
}

/**
 * Add an item to a session (create session_items entry)
 */
export async function addItemToSession(params: AddItemToSessionParams): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('session_items')
    .insert([
      {
        session_id: params.session_id,
        item_id: params.item_id,
        item_number: params.item_number,
        position: params.position || params.item_number,
        added_via: params.added_via || 'manual',
      },
    ])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to add item to session: ${error.message}`);
  }

  return data.id;
}

/**
 * Add multiple items to a session in batch
 */
export async function addItemsToSessionBatch(
  sessionId: string,
  items: Array<{
    item_id: string;
    item_number: number;
    position?: number;
    added_via?: 'photo' | 'preshow_csv' | 'manual' | 'batch';
  }>
): Promise<void> {
  const supabase = createClient();

  const sessionItemsToInsert = items.map((item) => ({
    session_id: sessionId,
    item_id: item.item_id,
    item_number: item.item_number,
    position: item.position || item.item_number,
    added_via: item.added_via || 'batch',
  }));

  const { error } = await supabase
    .from('session_items')
    .insert(sessionItemsToInsert);

  if (error) {
    throw new Error(`Failed to add items to session: ${error.message}`);
  }
}

/**
 * Mark an item as sold (create sale transaction + update item status)
 */
export async function markItemSold(params: MarkItemSoldParams): Promise<string> {
  const supabase = createClient();

  // Get the item to extract user_id and cost_basis
  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('user_id, cost_basis, status')
    .eq('id', params.item_id)
    .single();

  if (itemError || !item) {
    throw new Error(`Item not found: ${itemError?.message || 'Unknown error'}`);
  }

  if (item.status === 'SOLD') {
    throw new Error('Item is already sold');
  }

  // Create sale transaction
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert([
      {
        user_id: item.user_id,
        item_id: params.item_id,
        session_id: params.session_id,
        platform_id: params.platform_id,
        platform_key: params.platform_key,
        sold_price: params.sold_price,
        fees: params.fees || 0,
        taxes_collected: params.taxes_collected || 0,
        shipping_cost: params.shipping_cost || 0,
        buyer_username: params.buyer_username,
        order_id: params.order_id,
        sold_at: params.sold_at || new Date().toISOString(),
        notes: params.notes,
      },
    ])
    .select('id')
    .single();

  if (saleError) {
    throw new Error(`Failed to create sale: ${saleError.message}`);
  }

  // Update item status to SOLD
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({
      status: 'SOLD',
      lifecycle_status: 'sold',
      sold_date: params.sold_at
        ? new Date(params.sold_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.item_id);

  if (updateError) {
    throw new Error(`Failed to update item status: ${updateError.message}`);
  }

  return sale.id;
}

/**
 * Mark multiple items as sold in batch
 */
export async function markItemsSoldBatch(
  items: MarkItemSoldParams[]
): Promise<string[]> {
  const supabase = createClient();

  // Get all items to validate and extract user_id
  const itemIds = items.map((i) => i.item_id);
  const { data: inventoryItems, error: fetchError } = await supabase
    .from('inventory_items')
    .select('id, user_id, cost_basis, status')
    .in('id', itemIds);

  if (fetchError || !inventoryItems) {
    throw new Error(`Failed to fetch items: ${fetchError?.message || 'Unknown error'}`);
  }

  // Check for already sold items
  const alreadySold = inventoryItems.filter((i) => i.status === 'SOLD');
  if (alreadySold.length > 0) {
    throw new Error(
      `Some items are already sold: ${alreadySold.map((i) => i.id).join(', ')}`
    );
  }

  // Create map for quick lookup
  const itemMap = new Map(inventoryItems.map((i) => [i.id, i]));

  // Create sales
  const salesToInsert = items.map((params) => {
    const item = itemMap.get(params.item_id);
    if (!item) {
      throw new Error(`Item not found: ${params.item_id}`);
    }

    return {
      user_id: item.user_id,
      item_id: params.item_id,
      session_id: params.session_id,
      platform_id: params.platform_id,
      platform_key: params.platform_key,
      sold_price: params.sold_price,
      fees: params.fees || 0,
      taxes_collected: params.taxes_collected || 0,
      shipping_cost: params.shipping_cost || 0,
      buyer_username: params.buyer_username,
      order_id: params.order_id,
      sold_at: params.sold_at || new Date().toISOString(),
      notes: params.notes,
    };
  });

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .insert(salesToInsert)
    .select('id');

  if (salesError) {
    throw new Error(`Failed to create sales: ${salesError.message}`);
  }

  // Update all items to SOLD
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({
      status: 'SOLD',
      lifecycle_status: 'sold',
      updated_at: new Date().toISOString(),
    })
    .in('id', itemIds);

  if (updateError) {
    throw new Error(`Failed to update item statuses: ${updateError.message}`);
  }

  return sales.map((s) => s.id);
}

/**
 * Archive an item (set status to ARCHIVED)
 */
export async function archiveItem(params: ArchiveItemParams): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('inventory_items')
    .update({
      status: 'ARCHIVED',
      lifecycle_status: 'archived',
      archived_at: new Date().toISOString(),
      archived_reason: params.reason,
      archived_notes: params.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.item_id);

  if (error) {
    throw new Error(`Failed to archive item: ${error.message}`);
  }
}

/**
 * Restore an archived item to ACTIVE
 */
export async function restoreItem(itemId: string): Promise<void> {
  const supabase = createClient();

  // Verify item is not sold
  const { data: item, error: fetchError } = await supabase
    .from('inventory_items')
    .select('status')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new Error(`Item not found: ${fetchError?.message || 'Unknown error'}`);
  }

  if (item.status === 'SOLD') {
    throw new Error('Cannot restore a sold item');
  }

  const { error } = await supabase
    .from('inventory_items')
    .update({
      status: 'ACTIVE',
      lifecycle_status: 'active',
      archived_at: null,
      archived_reason: null,
      archived_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    throw new Error(`Failed to restore item: ${error.message}`);
  }
}

/**
 * Update item cost basis
 */
export async function updateItemCostBasis(
  itemId: string,
  costBasis: number
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('inventory_items')
    .update({
      cost_basis: costBasis,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    throw new Error(`Failed to update cost basis: ${error.message}`);
  }
}

/**
 * Remove item from session (delete session_items entry)
 */
export async function removeItemFromSession(
  sessionId: string,
  itemId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('session_items')
    .delete()
    .eq('session_id', sessionId)
    .eq('item_id', itemId);

  if (error) {
    throw new Error(`Failed to remove item from session: ${error.message}`);
  }
}
