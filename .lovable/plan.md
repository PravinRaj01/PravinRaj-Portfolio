

## AI-Generated Portfolio Magazine ("Code & Creative")

A "publish once, read everywhere" magazine experience for Creative Mode. The AI writes an entire magazine issue from your featured projects in the admin panel, stores it as structured JSON, and the frontend renders it instantly with page-flip animations.

---

### How It Works (High Level)

1. **Admin Panel**: You click "Publish New Issue" in a new "Magazine" tab. The AI reads your featured/creative projects and generates a full magazine issue (cover, editor's note, project articles, contact page).
2. **Database**: The structured JSON is saved to a `magazine_issues` table.
3. **Frontend**: When a visitor lands in Creative Mode, a "Read Magazine" button appears. Clicking it opens a full-screen magazine modal with page-turning animations, rendering the pre-generated content instantly (no AI wait time for visitors).

---

### Architecture

```text
Admin Panel                          Database                    Frontend (Creative Mode)
+-----------------------+     +-------------------+     +-------------------------+
| "Publish New Issue"   |---->| magazine_issues   |<----| Fetch latest published  |
| button                |     | (JSONB content)   |     | issue                   |
+-----------------------+     +-------------------+     +-------------------------+
         |                                                        |
         v                                                        v
+------------------------+                              +-------------------------+
| Edge Function:         |                              | MagazineViewer          |
| generate-magazine      |                              | - Page flip animations  |
| - Fetches projects     |                              | - Cover, articles, etc  |
| - Calls Lovable AI     |                              | - Swipe/click nav       |
| - Returns JSON issue   |                              | - CSS "print" styling   |
+------------------------+                              +-------------------------+
```

---

### Database: `magazine_issues` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Issue title, e.g. "The AI Architect - Feb 2026" |
| `is_published` | boolean | Only published issues shown to visitors |
| `mode` | text | Always 'creative' for now |
| `cover_headline` | text | Main cover headline |
| `cover_subhead` | text | Cover subtitle |
| `content` | jsonb | Full magazine structure (pages array) |
| `project_ids` | text[] | Which projects were used to generate |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto |

RLS policies:
- Public can SELECT where `is_published = true`
- Authenticated users can do everything (admin)

---

### Content JSON Structure

The `content` JSONB column stores:

```text
{
  "cover": {
    "headline": "The Architect of Automation",
    "subhead": "How Pravin Raj is rewriting the rules",
    "cover_image_drive_id": "abc123"
  },
  "editors_note": {
    "title": "From the Editor",
    "body": "Welcome to this edition..."
  },
  "articles": [
    {
      "project_id": "uuid",
      "headline": "Beyond the Script",
      "pull_quote": "Automation isn't just speed...",
      "body": "In a world of manual compliance...",
      "layout": "split_left",
      "image_drive_id": "xyz789"
    }
  ],
  "closing": {
    "title": "Get In Touch",
    "body": "Interested in collaborating?..."
  }
}
```

---

### Edge Function: `generate-magazine`

- Receives a request with optional `project_ids` filter (defaults to featured creative projects)
- Fetches projects from the database using the Supabase service role key
- Builds a rich prompt telling the AI to act as an "Editor-in-Chief" and return structured JSON via tool calling (not raw JSON in text)
- Uses `google/gemini-3-flash-preview` via Lovable AI Gateway
- Uses tool calling to get structured output (cover, editor's note, articles array, closing page)
- Returns the structured magazine content
- Handles 429/402 rate limit errors gracefully

---

### Admin Panel: Magazine Manager

A new "Magazine" subtab under the Projects tab (alongside Projects and Folders):

- **Issue List**: Shows existing magazine issues with title, date, published status
- **"Draft New Issue" Button**: Opens a dialog where you can:
  - See which featured projects will be included
  - Optionally select/deselect specific projects
  - Add a theme or tone hint (e.g. "focus on AI projects")
  - Click "Generate" to call the edge function
- **Preview**: After generation, see a text preview of the magazine content before publishing
- **Publish/Unpublish Toggle**: Only one issue can be published at a time (auto-unpublishes previous)
- **Delete**: Remove old issues

---

### Frontend: Magazine Viewer

Since `react-pageflip` would add a new dependency, we'll use **Framer Motion** (already installed) to create a custom page-flip experience that's lightweight and fits the existing design language.

**Component: `MagazineViewer.tsx`**
- Full-screen modal/overlay triggered by a "Read Magazine" button on the Creative Mode home page
- Pages rendered as cards with Framer Motion `AnimatePresence` for page transitions (slide + subtle 3D rotate for a flip feel)
- Swipe support via Framer Motion's drag gestures
- Keyboard navigation (arrow keys)
- Page indicator dots at the bottom

**Page Layouts:**
- **Cover Page**: Full-bleed with large headline, subtitle, and project image with CSS sepia/grain filter
- **Editor's Note**: Two-column layout with drop cap typography
- **Article Pages**: Split layout (image left, text right or vice versa based on `layout` field)
- **Closing Page**: Contact CTA with social links

**Styling:**
- Serif fonts for headlines (using Google Fonts or system serif)
- CSS filters on project images (`sepia(0.15) contrast(1.1)`) for a print magazine aesthetic
- Large drop-cap first letters on article bodies
- Pull quotes styled with large quotation marks

**Entry Point:**
- A floating "Read Magazine" button/card on the Creative Mode home page (only shows if a published issue exists)
- Could also be triggered from the Navigation menu

---

### File Changes Summary

| Action | File |
|--------|------|
| **Migration** | Create `magazine_issues` table with RLS |
| **Create** | `supabase/functions/generate-magazine/index.ts` - Edge function |
| **Update** | `supabase/config.toml` - Add function config |
| **Create** | `src/components/admin/MagazineManager.tsx` - Admin UI for managing issues |
| **Create** | `src/components/MagazineViewer.tsx` - Frontend magazine viewer |
| **Create** | `src/hooks/useMagazine.ts` - Hook for fetching magazine data |
| **Update** | `src/components/admin/AdminDashboard.tsx` - Add Magazine subtab under Projects |
| **Update** | `src/pages/Index.tsx` - Add Magazine entry button in creative mode |
| **Update** | `src/types/cms.ts` - Add magazine types |
| **Update** | `src/integrations/supabase/types.ts` - Update generated types |

---

### Technical Details

**AI Prompt Strategy (in edge function):**

The system prompt instructs the AI to write as a tech magazine editor, using narrative language instead of resume-speak. Tool calling is used to enforce the structured JSON output format, ensuring we get properly typed data every time.

**Performance:**
- Magazine content is pre-generated (stored as ~5-10KB of JSON)
- Images reuse existing Google Drive project images (no new image generation)
- CSS filters applied client-side for the "print" look
- Only the published issue is fetched (single row query)
- Framer Motion animations are GPU-accelerated

**Mobile Support:**
- Swipe gestures for page navigation
- Single-column layout on mobile (stacked image + text)
- Touch-friendly page indicators

