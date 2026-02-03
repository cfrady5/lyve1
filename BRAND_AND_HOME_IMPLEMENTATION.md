# Brand Guidelines and Home Page Implementation

## ✅ Implementation Complete

Both requirements have been fully implemented:

### A) Brand Text Rule - Lowercase "lyve"

**Rule:** All brand text must be lowercase "lyve" everywhere, including sentence start.

#### Changes Made:

1. **Created Brand Constants** [`lib/constants/brand.ts`]
   - `BRAND.NAME` = 'lyve'
   - `BRAND.PORTFOLIO` = 'lyvefolio'
   - `BRAND.RANGE` = 'lyverange'
   - `BRAND.VALUE` = 'lyve value'
   - Helper functions: `formatBrand()`, `getBrandName()`, `getPortfolioName()`

2. **Updated All UI Text**
   - ✅ Header navigation: "Lyvefolio" → "lyvefolio" ([components/shared/Header.tsx:24](components/shared/Header.tsx#L24))
   - ✅ Billing page: "LYVE Premium" → "lyve premium" ([app/(dashboard)/billing/page.tsx:53](app/(dashboard)/billing/page.tsx#L53))
   - ✅ Session detail: "See Lyve Report" → "see lyve report" ([app/(dashboard)/sessions/[id]/SessionDetailContentNew.tsx:458](app/(dashboard)/sessions/[id]/SessionDetailContentNew.tsx#L458))
   - ✅ lyvefolio content: "Lyve Value" → "lyve value" ([app/(dashboard)/lyvefolio/LyvefolioContent.tsx:209](app/(dashboard)/lyvefolio/LyvefolioContent.tsx#L209))
   - ✅ Landing page: "Bartr" → "lyve", "Bartrfolio" → "lyvefolio" ([app/page.tsx](app/page.tsx))
   - ✅ API route comments: "Lyve Report" → "lyve report" ([app/api/insights/route.ts](app/api/insights/route.ts))

3. **Added Lint Check Script** [`package.json`]
   ```json
   "check:brand": "! grep -r \"\\bLyve\\b\\|\\bLYVE\\b\" app components --include='*.tsx' --include='*.ts' --exclude-dir=node_modules || (echo '❌ Found capitalized \"Lyve\" or \"LYVE\" in UI code. Use lowercase \"lyve\" instead.' && exit 1)"
   ```

   **Usage:**
   ```bash
   npm run check:brand
   ```

   **Current Status:** ✅ Passing - No capitalized instances found

### B) Clickable Logo → Home Page

#### Changes Made:

1. **Created Home Page** [`app/(dashboard)/home/`]
   - Route: `/home`
   - Authenticated page within dashboard layout
   - Premium, clean, modern design

2. **Home Page Sections:**

   **Hero Section** ([app/(dashboard)/home/HomeContent.tsx:17-32](app/(dashboard)/home/HomeContent.tsx#L17-L32))
   - Headline: "turn every show into data"
   - Subheadline: "{lyve} helps livestream sellers track inventory, streams, and profitability with real accounting, not vibes"
   - Primary CTAs:
     - "create a session" → `/sessions`
     - "open lyvefolio" → `/lyvefolio`

   **Mission Statement** ([app/(dashboard)/home/HomeContent.tsx:35-48](app/(dashboard)/home/HomeContent.tsx#L35-L48))
   - 3 paragraphs explaining the mission
   - Real accounting, not vibes
   - Clean data and smart decisions

   **Features Overview** ([app/(dashboard)/home/HomeContent.tsx:51-175](app/(dashboard)/home/HomeContent.tsx#L51-L175))
   - 4 feature cards with icons:
     - **lyvefolio**: inventory database
       - quick add with photos
       - cost basis tracking
       - sold tab and history
       - comps with lyverange
     - **sessions**: pre-show to post-show
       - build run order
       - breakeven calculator
       - breaks support (PYT/PYP/random)
       - post-show reconcile
     - **sales**: transaction log
       - complete audit trail
       - export ready
     - **insights**: seller profile
       - best price ranges
       - profit drivers and leaks
       - player/sport analysis

   **How It Works** ([app/(dashboard)/home/HomeContent.tsx:178-217](app/(dashboard)/home/HomeContent.tsx#L178-L217))
   - 3 steps: prep, run, reconcile and learn
   - Clean numbered circles
   - Concise descriptions

   **Footer** ([app/(dashboard)/home/HomeContent.tsx:220-242](app/(dashboard)/home/HomeContent.tsx#L220-L242))
   - Brand name and tagline
   - Quick links to all main sections

3. **Updated Logo Component** ([components/shared/Header.tsx:43-50](components/shared/Header.tsx#L43-L50))
   - Wrapped logo in `<Link href="/home">`
   - Added `aria-label="go to home"`
   - Added hover effect (opacity transition)
   - Uses `BRAND.NAME` constant

4. **Design Implementation:**
   - ✅ Modern and minimal
   - ✅ Clean spacing with Tailwind utilities
   - ✅ Strong typography hierarchy
   - ✅ Responsive design (mobile-first)
   - ✅ Fast and lightweight (no heavy charts)
   - ✅ Consistent with existing UI patterns
   - ✅ Uses Lucide icons
   - ✅ Card-based layout for features

## Usage

### Accessing the Home Page

1. **From Logo:** Click the "lyve" logo in the top-left of any page
2. **Direct URL:** Navigate to `/home`
3. **From Landing:** Login redirects to dashboard, logo goes to `/home`

### Brand Enforcement

**Before committing:**
```bash
npm run check:brand
```

This will fail if any capitalized "Lyve" or "LYVE" is found in UI code.

**In new code:**
- Use `BRAND.NAME` for "lyve"
- Use `BRAND.PORTFOLIO` for "lyvefolio"
- Use `BRAND.RANGE` for "lyverange"
- Use `BRAND.VALUE` for "lyve value"

**Examples:**
```tsx
import { BRAND } from '@/lib/constants/brand';

// ✅ Correct
<h1>{BRAND.NAME}</h1>
<p>Welcome to {BRAND.PORTFOLIO}</p>

// ✅ Also correct (in server components or plain text)
<h1>lyve</h1>
<p>Welcome to lyvefolio</p>

// ❌ Wrong
<h1>Lyve</h1>
<p>Welcome to Lyvefolio</p>
```

## File Structure

```
app/
├── (dashboard)/
│   └── home/
│       ├── page.tsx          # Home route
│       └── HomeContent.tsx   # Home page client component
├── page.tsx                  # Updated landing page
└── api/
    └── insights/
        └── route.ts          # Updated comments

components/
└── shared/
    └── Header.tsx            # Updated logo link and nav

lib/
└── constants/
    └── brand.ts              # NEW: Brand constants

package.json                  # NEW: check:brand script
```

## Testing Checklist

- [x] Logo links to `/home` from all pages
- [x] Home page loads correctly
- [x] Home page is responsive (mobile/tablet/desktop)
- [x] All brand text is lowercase throughout app
- [x] `npm run check:brand` passes
- [x] Navigation works correctly
- [x] CTAs on home page link to correct routes
- [x] Footer links work

## Notes

- The home page is within the `(dashboard)` group, so it requires authentication
- If user is not logged in, they will be redirected to `/login` (existing auth flow)
- The landing page at `/` remains for unauthenticated users
- All copy uses lowercase brand name per requirements
- No em dashes used in any text
- Copy is concise and seller-focused

## Future Enhancements

- Add "Home" nav item to header (optional, logo click already works)
- Add animations/transitions for hero section
- Add testimonials or social proof section
- Add pricing section (when pricing is finalized)

---

**Implementation Date:** 2026-02-01
**Status:** ✅ Complete and Tested
