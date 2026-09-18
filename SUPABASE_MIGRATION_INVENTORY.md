# Supabase Migration Inventory

This document inventories the repository’s current Supabase usage so it can be migrated away from Supabase cleanly.

## 1) Relational database tables and their columns

The app’s typed schema is defined in `src/integrations/supabase/types.ts`.

### about_content
- id
- mode
- order_index
- section_title
- content
- created_at
- updated_at

### certifications
- id
- name
- issuer
- description
- date
- featured
- credential_id
- credential_url
- order_index
- created_at
- updated_at

### contact_content
- id
- mode
- title
- subtitle
- email
- phone
- location
- services
- created_at
- updated_at

### education
- id
- degree
- institution
- location
- period
- description
- achievements
- order_index
- created_at
- updated_at

### experiences
- id
- title
- company
- location
- period
- description
- achievements
- mode
- order_index
- experience_type
- date_type
- event_date
- role
- event_images
- certificate_url
- certificate_drive_id
- created_at
- updated_at

### game_scores
- id
- game_type
- nickname
- score
- created_at

### github_ticker
- id
- mode
- text
- url
- created_at
- updated_at

### hero_content
- id
- mode
- order_index
- name
- title
- greeting
- description
- cta_text
- cta_link
- animated_titles
- animation_speed
- animation_pause_duration
- gradient_overlay_opacity
- background_image_url
- profile_photo_url
- created_at
- updated_at

### magazine_issues
- id
- title
- mode
- is_published
- cover_headline
- cover_subhead
- project_ids
- content
- created_at
- updated_at

### project_folders
- id
- name
- description
- mode
- order_index
- cover_image_drive_id
- is_active
- created_at
- updated_at

### project_image_folders
- id
- project_id
- name
- description
- media_type
- images
- video_url
- video_thumbnail
- order_index
- created_at
- updated_at

### projects
- id
- title
- category
- categories
- tags
- positions
- position
- description
- featured
- show_in_recent
- recent_order_index
- project_date
- image_drive_id
- image_home_drive_id
- video_url
- video_thumbnail_drive_id
- gallery_images
- github_url
- live_url
- folder_id
- mode
- order_index
- crop_square
- crop_landscape
- crop_phone
- crop_tablet
- image_scroll_enabled
- include_thumbnail_in_gallery
- project_links
- is_active
- scroll_speed
- slug
- created_at
- updated_at

### services
- id
- title
- description
- features
- order_index
- created_at
- updated_at

### site_settings
- id
- site_name
- logo_url
- professional_site_name
- professional_logo_url
- professional_mode_enabled
- professional_resume_url
- professional_visible_pages
- creative_site_name
- creative_logo_url
- creative_mode_enabled
- creative_resume_url
- creative_visible_pages
- mode_toggle_pages
- default_mode
- academic_default_view
- projects_default_view
- visitor_counter_enabled
- show_total_visitors
- show_daily_visitors
- resume_url
- chatbot_enabled
- chatbot_name
- chatbot_welcome_message
- chatbot_default_state
- created_at
- updated_at

### skills
- id
- category
- icon
- color
- mode
- order_index
- skills
- created_at
- updated_at

### socials
- id
- name
- icon
- url
- enabled
- mode
- order_index
- created_at
- updated_at

### stats
- id
- mode
- label
- value
- order_index
- created_at
- updated_at

### technical_skills
- id
- name
- category
- color
- icon_url
- position_x
- position_y
- position_z
- is_active
- created_at
- updated_at

### visitor_daily_stats
- id
- date
- view_count
- created_at

### visitor_stats
- id
- view_count
- last_updated

### Additional schema note
- The schema exposes one Postgres function: `submit_game_score` with arguments `p_game_type`, `p_nickname`, and `p_score`.

## 2) Active storage bucket names found in code

### resumes
- Used in `src/components/admin/ResumeManager.tsx` via `supabase.storage.from('resumes')`
- Storage policies for this bucket are defined in `supabase/migrations/20251225133606_fc85be31-7f68-4235-8381-0cc2bf09aa3e.sql`

### Pictures
- Referenced in `index.html` as a signed storage URL (`https://...supabase.co/storage/v1/object/sign/Pictures/...`)
- This appears to be a storage bucket/path used for site assets, but it is not used via a `supabase.storage.from(...)` call elsewhere in the app code

## 3) How user authentication is structured across the login contexts

### Admin authentication
The project’s only explicit login flow is the admin portal.

- `src/services/authService.ts`
  - `signInAdmin()` uses `supabase.auth.signInWithPassword({ email, password })`
  - `signOutAdmin()` uses `supabase.auth.signOut()`
  - `getCurrentUser()` uses `supabase.auth.getUser()`
  - `onAuthStateChange()` subscribes to Supabase Auth session updates

- `src/components/admin/AdminAuth.tsx`
  - Shows the email/password admin sign-in form
  - Calls `signInAdmin()` after form submit

- `src/components/admin/ProtectedRoute.tsx`
  - Checks the current auth state on mount
  - Redirects unauthenticated users to the admin login form
  - Re-checks auth after a successful login

### Frontend Supabase client setup
- `src/utils/supabase.ts`
  - Creates a client with the anon key

- `src/integrations/supabase/client.ts`
  - Creates a typed client with:
    - `persistSession: true`
    - `autoRefreshToken: true`
    - `storage: localStorage`

This means the browser persists the Supabase auth session in localStorage.

## 4) Supabase Edge Functions folders or API invocations used by the frontend

### Edge Function folders present
The project defines these Edge Functions in `supabase/config.toml`:

- `portfolio-chat`
- `google-drive-proxy`
- `generate-description`
- `generate-magazine`
- `track-visitor`

### Frontend invocations

#### `portfolio-chat`
- Called from `src/components/chatbot/ChatbotDrawer.tsx`
- Request path: `${VITE_SUPABASE_URL}/functions/v1/portfolio-chat`
- Backend implementation: `supabase/functions/portfolio-chat/index.ts`
- This function builds portfolio context from Supabase tables and then calls the Lovable AI Gateway using `google/gemini-2.5-flash`

#### `track-visitor`
- Called from `src/hooks/useVisitorCounter.ts`
- Invokes `supabase.functions.invoke('track-visitor', { body: { action: 'increment' } })`
- Also calls `supabase.functions.invoke('track-visitor', { body: { action: 'get' } })`

#### `generate-description`
- Called from `src/components/admin/DescriptionGenerator.tsx`
- Invokes `supabase.functions.invoke('generate-description', { body: { ... } })`

#### `generate-magazine`
- Called from `src/components/admin/MagazineManager.tsx`
- Invokes `supabase.functions.invoke('generate-magazine', { body: { ... } })`

#### `google-drive-proxy`
- Called directly by URL construction in `src/services/googleDriveService.ts`
- Uses `/functions/v1/google-drive-proxy?action=test&folderId=...`, `/count`, and `/list`

### Other Supabase data access patterns
- Frontend hooks use `supabase.from(...)` heavily to read/write all content tables
- `src/hooks/useGameScores.ts` calls `supabase.rpc('submit_game_score', ...)`
- `src/components/admin/ResumeManager.tsx` uses `supabase.storage.from('resumes')` for upload/delete operations

## Quick migration risks

If this project is being migrated away from Supabase, the key areas to replace are:

1. All `supabase.from(...)` calls for content/data reads and writes
2. Admin session management via `supabase.auth.*`
3. Storage operations for resumes and any public assets hosted in Supabase Storage
4. Edge Functions used by the frontend:
   - `portfolio-chat`
   - `track-visitor`
   - `generate-description`
   - `generate-magazine`
   - `google-drive-proxy`

## Summary

Supabase is currently being used for four major purposes in this project:

- Relational data persistence (content tables)
- Storage bucket access (resumes and asset URLs)
- Admin authentication
- Edge Function-backed APIs (chatbot, AI generation, visitor tracking, Google Drive proxy)
