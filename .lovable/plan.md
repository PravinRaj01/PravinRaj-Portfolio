
# Fix Magazine: True 3D Flipbook + Working Images

## What's Wrong Right Now

### Problem 1: Images are broken
Every image in `MagazineViewer.tsx` uses:
```
const DRIVE_PROXY = 'https://kadsdqnpxzgdxnnrdzra.supabase.co/functions/v1/google-drive-proxy?id=';
```
The `google-drive-proxy` edge function has no `?id=` handler — it only handles `action=test/count/list`. So these URLs return JSON errors, not images.

Fix: Use Google Drive's public thumbnail endpoint directly (same pattern used elsewhere in the project like `ImageSubfolderGallery.tsx`):
```
https://drive.google.com/thumbnail?id=DRIVE_ID&sz=s1600
```

### Problem 2: It's a slide, not a flipbook
The current viewer uses `AnimatePresence mode="wait"` — the old page exits completely FIRST, then the new page enters. That's a fade/slide, not a page flip.

A real page flip needs **both pages visible simultaneously** with a "turning page" layer that rotates between them. The architecture is:
- **Back layer**: the destination page (already in place, hidden behind the flip)
- **Top layer**: the current page that animates `rotateY: 0° → -180°` (with `backfaceVisibility: hidden`, the back face is invisible mid-flip)
- Result: looks like a physical page peeling away to reveal what's underneath

### Problem 3: MagazinePopup has a missing React import
Line 14 uses `React.FC` but `React` is not imported — this would cause a runtime error.

---

## The Fix

### File 1: `src/components/MagazineViewer.tsx` — Full rewrite

**New architecture:**
```
+-----------------------------------------------+
|  BOOK CONTAINER (perspective: 2000px)          |
|                                                |
|  [Back layer] = next page (static, behind)     |
|  [Flip layer] = current page rotating away     |
|    - rotateY: 0deg → -180deg (going forward)  |
|    - transformOrigin: right center             |
|    - backfaceVisibility: hidden                |
|                                                |
+-----------------------------------------------+
```

Key implementation details:
- Remove `AnimatePresence` (it causes the sequential wait behavior)
- Use a `isFlipping` state to trigger the animation
- The "back" page is always rendered statically underneath
- A `motion.div` overlays the current page and animates `rotateY` using `useAnimation()` controls
- After flip completes (600ms), update `currentPage` and reset the flip layer
- On mobile: same effect but full-screen, `transformOrigin: right center` for forward, `left center` for backward
- Paper texture, sepia filters, drop shadow all stay the same

**Image URLs:** Replace `${DRIVE_PROXY}${id}` with `https://drive.google.com/thumbnail?id=${id}&sz=s1600` everywhere in the file.

**Desktop spread (2 pages):** On `md:` and above, show two pages side-by-side (left page + right page). Articles pair up naturally. The flip animation only affects the turning layer, giving the effect of a real book spread.

### File 2: `src/components/MagazinePopup.tsx` — Fix missing import
Add `import React from 'react';` at the top. Simple but critical.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/MagazineViewer.tsx` | Full rewrite — true simultaneous flip animation using `useAnimation` + fix all image URLs to `drive.google.com/thumbnail` |
| `src/components/MagazinePopup.tsx` | Add missing `import React from 'react'` |

---

## Visual Result

| Before | After |
|--------|-------|
| Old page fades out, new page fades in | Both pages visible; current page "peels" away via rotateY |
| Images: broken JSON error | Images: loaded from Google Drive thumbnail CDN |
| Single centered card | Book-style container with spine shadow |
| Sequential (mode="wait") | Simultaneous 3D transform |
