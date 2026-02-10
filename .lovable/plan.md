

# Magazine Enhancements + Track Visitor Fix

## Overview
Five improvements: category filtering in magazine project selection, project images in the magazine, book-like page-flip experience, magazine popup behavior, and track-visitor edge function resilience.

---

## 1. Category Filter in Magazine Project Selection

**File:** `src/components/admin/MagazineManager.tsx`

Add a category filter dropdown above the project grid in the "Draft New Issue" dialog, reusing the same category extraction logic from `ProjectManager.tsx`.

- Extract unique categories from `projects` using `flatMap` on `categories` and `category` fields
- Add a `Select` dropdown to filter the project list by category
- The project grid below only shows projects matching the selected category (or all)

---

## 2. Project Images in the Magazine

**File:** `supabase/functions/generate-magazine/index.ts` (already done partly)

The edge function already attaches `image_drive_id` from projects to articles (lines 173-185). The `MagazineViewer` already renders these images. If images are missing, it's because some projects lack `image_drive_id` or `image_home_drive_id`.

**Fix:** Ensure the cover always gets an image, and articles without images get a fallback from any available project image. No AI image generation needed -- we use existing project images with CSS filters for the "print" look.

**File:** `supabase/functions/generate-magazine/index.ts`
- When building articles, if a matched project has no image, try to find any image from the project's gallery or folders
- For the cover, pick the best available image from the selected projects

---

## 3. Book-Like Magazine Viewer with Page-Flip Animation

**File:** `src/components/MagazineViewer.tsx` (rewrite)

Replace the current slide-based viewer with a realistic book/magazine experience using Framer Motion (already installed):

- **Book container**: Centered on screen with a subtle shadow and perspective, resembling an open book
- **Page-flip animation**: Use `rotateY` transform (hinge on the left/right edge) to simulate a page turning in 3D, with a shadow that moves across the page during the flip
- **Cover page**: Full-bleed cover with the headline overlaid on the project image (with CSS sepia/contrast filter for print look)
- **Swipe gestures**: Touch swipe left/right to turn pages (using Framer Motion drag)
- **Page structure**: Each "spread" shows one page at a time on mobile, two pages side-by-side on desktop
- **Page numbers**: Small page numbers at the bottom corners
- **Paper texture**: Subtle CSS background pattern to simulate paper grain

---

## 4. Magazine Popup Behavior

**Files:** `src/pages/Index.tsx`, `src/components/OnboardingPopup.tsx`

Current behavior: A floating "Read Magazine" button is always visible in creative mode. 

New behavior:
- **Remove** the floating "Read Magazine" button entirely
- **Add a magazine popup** that appears once per session when the user is in creative mode
- **Coordinate with OnboardingPopup**: The magazine popup should only appear AFTER the onboarding/mode-selector popup has been dismissed (or if it was already seen before)
- Use `sessionStorage` key `magazine_popup_shown` to track if shown this session
- The popup will be a small, elegant card with magazine cover preview and a "Read Now" / "Maybe Later" option

**Implementation:**
- `OnboardingPopup` already sets `localStorage` when dismissed. We detect its state.
- In `Index.tsx`, add a `MagazinePopup` component that:
  1. Only renders if `mode === 'creative'` and `magazineIssue` exists
  2. Checks `sessionStorage` for `magazine_popup_shown`
  3. Waits for the onboarding popup to close (either by watching its `localStorage` key or via a small delay after mount)
  4. Shows a dialog with magazine cover info and "Read Now" button
  5. Sets `sessionStorage` on dismiss

---

## 5. Track Visitor Edge Function - Connection Reset Fix

**File:** `supabase/functions/track-visitor/index.ts`

The error is a transient connection reset when the edge function talks to Supabase REST API. Fix by adding retry logic with a small delay.

- Wrap the Supabase API calls in a retry helper (max 2 retries, 500ms delay between)
- Return gracefully even if retries fail (don't crash the function)
- The function already returns success:false on error, so clients handle it

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/MagazineManager.tsx` | Add category filter dropdown for project selection |
| `supabase/functions/generate-magazine/index.ts` | Improve image attachment logic for articles and cover |
| `src/components/MagazineViewer.tsx` | Rewrite with book-like page-flip animation using Framer Motion |
| `src/pages/Index.tsx` | Remove floating magazine button, add magazine popup logic |
| `src/components/MagazinePopup.tsx` | New component for the session-based magazine popup |
| `supabase/functions/track-visitor/index.ts` | Add retry logic for transient connection resets |

---

## Technical Details

### Page-Flip Animation (Framer Motion)
```text
+-------------------+      +-------------------+
|                   |      |                   |
|   Current Page    | ---> |   Next Page       |
|                   |      |                   |
|                   |      |                   |
+-------------------+      +-------------------+
     rotateY: 0deg    ->    rotateY: -180deg
     (hinge on right edge, 3D perspective)
```

- `perspective: 1500px` on container
- `transformOrigin: 'left center'` for forward flip
- Page shadow opacity animated during flip
- Duration: ~600ms with easeInOut

### Magazine Popup Timing
```text
User lands on / (creative mode)
  |
  v
Is OnboardingPopup showing?
  |-- Yes --> Wait for it to close --> Show MagazinePopup after 1s delay
  |-- No (already seen) --> Show MagazinePopup after 2s delay
  |
  v
Has magazine_popup_shown in sessionStorage?
  |-- Yes --> Don't show
  |-- No --> Show popup
```

### Retry Helper for track-visitor
```text
async function withRetry(fn, maxRetries = 2, delayMs = 500) {
  for (let i = 0; i <= maxRetries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === maxRetries) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
```

