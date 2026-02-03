# Breaks Feature - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide gets you creating breaks immediately.

---

## Step 1: Navigate to Your Session

1. Go to the Sessions page
2. Click on an existing session or create a new one
3. You'll see the session detail page

---

## Step 2: Select Show Type

At the top of the page, find the **Show Type** dropdown:

- **Singles Only**: Traditional singles show (no breaks)
- **Breaks Only**: Box breaks only (no singles)
- **Mixed**: Both singles and breaks

Select **"Breaks Only"** or **"Mixed"** to enable breaks.

---

## Step 3: Add Your First Break

1. Scroll to the **Breaks** section
2. Click the **"Add Break"** button
3. A dialog opens with the break configuration form

---

## Step 4: Configure Your Break

### Basic Info
- **Break Title**: Enter a name (e.g., "2024 Prizm Football")
- **Break Style**: Choose one:
  - **PYT (Pick Your Team)**: Classic team breaks
  - **PYP (Pick Your Player)**: Player breaks (advanced)
  - **Random / Drafted**: Random or drafted team assignments

### Box Configuration
- **Break Type**:
  - **Single Product**: One box type
  - **Mixer**: Multiple different boxes

**For Single Product:**
1. Enter the box cost (e.g., $150.00)

**For Mixer:**
1. Click "Add Box" to add more rows
2. For each box:
   - Product name (e.g., "Prizm Hobby")
   - Quantity (e.g., 2)
   - Price per box (e.g., $120.00)
3. Total box cost is calculated automatically

### Spot Configuration

**If PYT:**
- Enter number of teams (default 30)
- Each team = 1 spot

**If PYP:**
- Enter number of player spots

**If Random/Drafted:**
- Choose spot configuration:
  - **Team Spots (30)**: 30 individual team spots
  - **3-Team Spots (10)**: 10 spots, each gets 3 teams
  - **Custom**: Define your own spot count

---

## Step 5: Review Breakeven

The dialog shows a live preview of your breakeven calculation:
- Total box cost
- Required revenue
- **Required per spot** ← This is your target price!

You'll see this update as you change values.

---

## Step 6: Save Your Break

Click **"Add Break"** at the bottom of the dialog.

Your break is now saved and appears in the Breaks section.

---

## Step 7: View Break Details

Click the **chevron** icon on the break card to expand and see:
- Box details (for mixers)
- Full breakeven breakdown:
  - Box cost
  - Allocated expenses
  - Profit target
  - Fee rate
  - **Required per spot** (your selling price target)

---

## Example: Creating a Simple PYT Break

```
Title: 2024 Prizm Football
Break Style: PYT (Pick Your Team)
Break Type: Single Product
Box Cost: $150.00
Teams Count: 30

→ Breakeven Per Spot: $5.68
   (at 12% fee rate, no expenses)
```

You should price each team spot at **$5.68 or higher** to break even.

---

## Example: Creating a Mixer Break

```
Title: NFL Mixer
Break Style: Random / Drafted
Spot Config: Team Spots (30)
Break Type: Mixer

Boxes:
- 2× Prizm Hobby @ $120 = $240
- 1× Select Blaster @ $80 = $80
- 3× Mosaic Cello @ $15 = $45

Total Box Cost: $365

→ Breakeven Per Spot: $13.80
   (with $50 expenses allocated pro-rata)
```

Price each team spot at **$13.80 or higher** to break even.

---

## Advanced Features (Optional)

### Custom Fee Rate
1. Expand "Advanced Settings" in the break dialog
2. Toggle "Custom Fee Rate"
3. Enter your custom rate (e.g., 15%)

### Custom Profit Target
1. Expand "Advanced Settings"
2. Toggle "Custom Profit Target"
3. Enter target profit for this break (e.g., $100)

### Expense Allocation
1. By default, session expenses are allocated to breaks
2. Change allocation method:
   - **Pro-Rata by Cost** (recommended): Proportional to break cost
   - **Equal per Break**: Split evenly
   - **Manual**: Enter exact amount
3. Or disable: Toggle off "Include Expenses"

---

## Session-Level Breakeven Calculator

On the right side of the page, you'll see the **Breakeven Calculator** card:

**Shows:**
- Total inventory cost (singles)
- Total break product cost (all breaks)
- Total expenses
- **Total Planned Outlay**
- **Breakeven Revenue** (total needed)
- Required per card (singles)
- Required per spot (breaks)
- Per-break detail list

This updates automatically as you add/edit breaks.

---

## Mixed Shows

When you select **"Mixed"** show type:

1. Add inventory items (singles)
2. Add breaks
3. Adjust the **Revenue Allocation** slider:
   - Left: More revenue from singles
   - Right: More revenue from breaks
4. The calculator shows:
   - Required avg per card
   - Required avg per spot
   - How revenue splits between singles and breaks

---

## Tips for Success

1. **Start Simple**: Create a single-product PYT break first
2. **Check Expenses**: Make sure session expenses are entered
3. **Review Breakeven**: Always expand the break card to see the full breakdown
4. **Test Pricing**: Use the breakeven as your minimum, price higher for profit
5. **Mixer Naming**: Use clear product names like "Prizm Hobby" not "Box 1"

---

## Common Questions

**Q: Can I change a break after creating it?**
A: Yes! Click the edit (pencil) icon on the break card.

**Q: How do I delete a break?**
A: Click the trash icon on the break card. You'll be asked to confirm.

**Q: What if I don't know my exact expenses yet?**
A: You can add expenses later. Breakeven will recalculate automatically.

**Q: Can I reorder breaks?**
A: Not yet via drag-and-drop, but the position field exists for future implementation.

**Q: Do breaks work with finalized sessions?**
A: Finalize locks the run order, but breaks can still be edited (for now).

---

## Next Steps

- ✅ Create your first break
- ✅ Review the breakeven calculation
- ✅ Add session expenses if applicable
- ✅ Configure custom fee rates or profit targets
- ✅ Try a mixer break
- ✅ Experiment with different spot configurations

---

## Need More Help?

- **Detailed Guide**: See [BREAKS_FEATURE_GUIDE.md](./BREAKS_FEATURE_GUIDE.md)
- **Feature Coverage**: See [BREAKS_SPEC_VERIFICATION.md](./BREAKS_SPEC_VERIFICATION.md)
- **Implementation Details**: See [BREAKS_IMPLEMENTATION_SUMMARY.md](./BREAKS_IMPLEMENTATION_SUMMARY.md)

---

**Happy Breaking!** 🎉
