# Breaks Feature - Complete Implementation Guide

## Overview
The Breaks feature is fully implemented in the Lyve app, providing comprehensive multi-box break configuration with real-time breakeven calculations.

## ✅ Implemented Features

### 1. Database Schema (Migrations)
- **breaks** table with all required fields:
  - Break style support (PYT, PYP, Random/Drafted)
  - Spot configuration (TEAM_30, THREE_TEAM_10, CUSTOM)
  - Teams/players count tracking
  - Expense allocation settings
  - Profit target overrides
  - Fee rate overrides

- **break_boxes** table for multi-box support:
  - Product name
  - Quantity (for multi-box of same product)
  - Price paid per box
  - Total cost (computed column)

- **Database functions**:
  - `calculate_break_breakeven()` - Accurate per-break breakeven with expense allocation
  - `calculate_breakeven_revenue()` - Session-level breakeven including all breaks

### 2. Break Configuration Component
Location: `components/sessions/preshow/BreakConfiguration.tsx`

**Features:**
- Add/Edit/Delete breaks
- Collapsible break cards
- Multi-box configuration table
- Break style selector (PYT/PYP/Random)
- Spot configuration based on style
- Real-time breakeven display per break
- Expense allocation with multiple methods
- Custom fee rates and profit targets per break

### 3. Box Builder (Multi-Box Support)
**In the Break Dialog:**
- Single Product mode: One box with cost
- Mixer mode: Multiple boxes with:
  - Product name field
  - Quantity stepper
  - Price per box
  - Computed line total
  - Add/remove box rows
  - Total box cost summary

### 4. Break Style Configuration

**PYT (Pick Your Team):**
- Number of teams input (default 30, editable)
- Spots count = teams_count
- Breakeven per team spot

**PYP (Pick Your Player):**
- Number of player spots input (required)
- Warning text for experienced breakers
- Breakeven per player spot

**Random/Drafted:**
- Spot configuration selector:
  - Team spots (30)
  - 3-team spots (10)
  - Custom
- Editable teams count
- Custom spot count input
- Breakeven per spot

### 5. Breakeven Calculator (Per Break)
Each break card shows:
- Total box cost (from multi-box sum)
- Allocated expenses (if enabled)
- Fee rate used (break or session default)
- Profit target used (break or session default)
- **Required total revenue**
- **Required price per spot** (primary number)

**Expense Allocation Methods:**
1. **Pro-rata by cost** (default):
   - `allocated_expense = session_expenses_total × (break_box_cost / total_planned_outlay_cost)`

2. **Equal per break**:
   - `allocated_expense = session_expenses_total / number_of_breaks_in_session`

3. **Manual**:
   - User enters custom allocated expense amount

### 6. Session-Level Breakeven Calculator
Location: `components/sessions/preshow/BreakevenCalculator.tsx`

**Shows:**
- Total inventory cost
- Total break product cost
- Total expenses
- Total planned outlay
- Breakeven revenue
- Required per card (singles)
- Required per spot (breaks overall)
- Per-break targets list
- Profit targets (+10%, +25%, +50%)

### 7. Show Type Integration
Works seamlessly with:
- **Singles Only**: Inventory run list only
- **Breaks Only**: Break configuration only
- **Mixed**: Both singles and breaks with revenue allocation slider

## 🎯 Usage Workflow

### Creating a Break:
1. Navigate to session detail page
2. Select show type (Breaks Only or Mixed)
3. Click "Add Break" button
4. Fill in:
   - Break title (e.g., "2024 Prizm Football")
   - Break style (PYT/PYP/Random)
   - Break type (Single Product or Mixer)
5. Configure boxes:
   - For single: Enter box cost
   - For mixer: Add multiple boxes with product names, quantities, prices
6. Configure spots based on break style
7. (Optional) Set custom fee rate or profit target
8. (Optional) Configure expense allocation
9. Save break

### Viewing Breakeven:
1. Each break card shows:
   - Quick stats: Box cost, spots, breakeven/spot
   - Expand to see: Box details, expense allocation, full breakeven breakdown
2. Session-level calculator on right shows:
   - Total outlay across all breaks
   - Required revenue
   - Per-spot averages

## 🗄️ Database Queries

### Get all breaks for a session:
```sql
SELECT * FROM breaks
WHERE session_id = 'session-id'
ORDER BY position;
```

### Get boxes for a mixer break:
```sql
SELECT * FROM break_boxes
WHERE break_id = 'break-id'
ORDER BY position;
```

### Calculate breakeven for a break:
```sql
SELECT * FROM calculate_break_breakeven(
  'break-id',
  true  -- include profit target
);
```

### Calculate session breakeven:
```sql
SELECT * FROM calculate_breakeven_revenue(
  'session-id',
  true  -- include profit target
);
```

## 🎨 UI Components Structure

```
SessionDetailContentNew.tsx
├── Show Type Selector
├── Left Column
│   ├── Inventory Run List (singles_only, mixed)
│   └── BreakConfiguration (breaks_only, mixed)
│       ├── Add Break Button
│       └── BreakCard (for each break)
│           ├── Collapsible Header
│           ├── Quick Stats
│           └── Collapsible Content
│               ├── Box Details (mixer)
│               ├── Breakeven Breakdown
│               └── Notes
└── Right Column (Sticky)
    └── BreakevenCalculator
        ├── Cost Breakdown
        ├── Configuration
        ├── Revenue Allocation (mixed)
        ├── Breakeven Revenue
        └── Profit Targets
```

## 🔧 Component Props

### BreakConfiguration
```typescript
{
  sessionId: string;
  breaks: Break[];
  sessionFeeRate: number;
  sessionProfitTarget: number;
  totalSessionExpenses: number;
  onBreaksChange: () => void;
}
```

### BreakevenCalculator
```typescript
{
  session: Session;
  inventoryCost: number;
  breaksCost: number;
  expenses: SessionExpense[];
  itemCount: number;
  breaks: Break[];
  onSessionUpdate?: (updates: Partial<Session>) => void;
}
```

## 📊 Breakeven Math

### Per-Break Formula:
```
C_box = sum(quantity × price_paid_per_box) for all boxes
E_alloc = allocated expenses (based on method)
P = profit target for break
f = fee rate (0-1)

Required Revenue = (C_box + E_alloc + P) / (1 - f)
Spot Price = Required Revenue / spot_count
```

### Session-Level Formula:
```
Total Outlay = inventory_cost + break_cost + expenses
Profit Target = profit_target_amount OR (Total Outlay × profit_target_percent/100)

Breakeven Revenue = (Total Outlay + Profit Target) / (1 - fee_rate)
```

## 🚀 Testing Checklist

### Single Product Break
- [ ] Create PYT break with 30 teams
- [ ] Verify box cost shows correctly
- [ ] Verify spot count = 30
- [ ] Verify breakeven per spot calculates correctly
- [ ] Edit and change teams count to 32
- [ ] Verify calculations update

### Mixer Break
- [ ] Create mixer break with 3 different boxes
- [ ] Add boxes with different quantities
- [ ] Verify total box cost sums correctly
- [ ] Verify line totals (qty × price)
- [ ] Remove a box and verify total updates

### PYP Break
- [ ] Create PYP break with 50 player spots
- [ ] Verify warning message appears
- [ ] Verify breakeven per player spot

### Random/Drafted Break
- [ ] Create with TEAM_30 configuration
- [ ] Switch to THREE_TEAM_10, verify 10 spots
- [ ] Switch to CUSTOM, enter 15 spots
- [ ] Verify calculations for each

### Expense Allocation
- [ ] Add $100 in session expenses
- [ ] Create break with pro-rata allocation
- [ ] Verify allocated expense shown in breakeven
- [ ] Change to equal per break method
- [ ] Create second break, verify expenses split 50/50
- [ ] Change to manual, enter $75
- [ ] Verify $75 shows in breakeven

### Custom Fee Rate & Profit Target
- [ ] Create break with default fee rate
- [ ] Enable custom fee rate, set to 15%
- [ ] Verify breakeven changes
- [ ] Enable custom profit target, set to $200
- [ ] Verify breakeven includes $200 profit

### Mixed Show
- [ ] Set show type to Mixed
- [ ] Add inventory items
- [ ] Add breaks
- [ ] Adjust revenue allocation slider
- [ ] Verify per-card and per-spot targets update

## 🐛 Known Issues / Limitations
- Break slot sales (post-show tracking) table exists but UI not yet implemented
- Finalize behavior locks run order but doesn't restrict break edits yet
- No drag-and-drop reordering of breaks (position field exists but not used in UI)

## 📝 Future Enhancements
1. Break slot sales tracking (post-show)
2. Drag-and-drop break reordering
3. Break templates (save common break configs)
4. Import breaks from previous sessions
5. Export break spot lists to CSV
6. Integration with WhatNot for break automation

## 🎓 Tips for Users
1. **Start with singles or breaks only** before trying mixed shows
2. **Use pro-rata expense allocation** for most accurate per-break costs
3. **Set profit targets at session level** and let breaks inherit unless specific override needed
4. **For mixers**, name products clearly (e.g., "Prizm Hobby", "Select Blaster")
5. **Always verify** total box cost before finalizing

## 📚 Related Files
- Database: `supabase/migrations/20260131020000_enhanced_breaks_multi_box.sql`
- Types: `lib/types/sessions.ts`
- Break Config: `components/sessions/preshow/BreakConfiguration.tsx`
- Calculator: `components/sessions/preshow/BreakevenCalculator.tsx`
- Session Page: `app/(dashboard)/sessions/[id]/SessionDetailContentNew.tsx`

---

**Status**: ✅ Fully Implemented
**Last Updated**: 2026-01-31
