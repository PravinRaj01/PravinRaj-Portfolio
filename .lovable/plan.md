
# Convert Project & Experience Forms to Popup Dialogs

## Overview
Currently, when you click "Add Project" or "Add Experience" in the admin panel, the form appears inline on the same page, which makes the layout feel messy and cluttered. This update will convert both forms to appear as centered popup dialogs (modals) that overlay the content, providing a cleaner and more focused editing experience.

---

## Current Behavior
- **ProjectManager**: When `showForm` is true, the `ProjectForm` renders inline within the same container
- **ExperienceManager**: When `showForm` is true, it replaces the entire content with `ExperienceForm`
- Both approaches make the page feel crowded and disorganized

## Proposed Solution
Wrap both forms in the existing `Dialog` component from your UI library to create a popup modal experience.

---

## Changes

### 1. ProjectManager.tsx
- Wrap the `ProjectForm` component inside a `Dialog` component
- Use `showForm` state to control `Dialog open` prop
- Set the dialog content to a larger width (`max-w-4xl`) to accommodate the form
- Add scrollable content area with max-height

### 2. ExperienceManager.tsx
- Wrap the `ExperienceForm` component inside a `Dialog` component
- Use `showForm` state to control `Dialog open` prop
- Remove the current conditional rendering that replaces the entire page content
- Keep the experience list visible behind the modal

### 3. ProjectForm.tsx (Minor adjustments)
- Remove the outer `Card` wrapper since the Dialog provides its own container
- Keep the header sticky but adjust for modal context
- Ensure the form fills the dialog properly

### 4. ExperienceForm.tsx (Minor adjustments)
- Remove the outer `Card` wrapper
- Adjust max-width since the dialog controls sizing
- Ensure proper scrolling within the modal

---

## Visual Result
- Clicking "Add Project" or "Add Experience" opens a centered popup
- Dark overlay behind the popup focuses attention on the form
- The list of existing items remains visible (dimmed) in the background
- Close button (X) in the top-right corner of the popup
- Popup is scrollable for long forms
- Clean, professional modal appearance

---

## Technical Details

### Dialog Structure
```text
+---------------------------------------+
|           Dark Overlay                |
|   +-----------------------------+     |
|   |  Form Title            [X]  |     |
|   |-----------------------------|     |
|   |                             |     |
|   |     Scrollable Form         |     |
|   |        Content              |     |
|   |                             |     |
|   |-----------------------------|     |
|   |    Cancel    |    Save      |     |
|   +-----------------------------+     |
+---------------------------------------+
```

### Files to Modify
| File | Change |
|------|--------|
| `src/components/admin/ProjectManager.tsx` | Wrap ProjectForm in Dialog |
| `src/components/admin/ExperienceManager.tsx` | Wrap ExperienceForm in Dialog |
| `src/components/admin/ProjectForm.tsx` | Remove Card wrapper, adjust styling |
| `src/components/admin/ExperienceForm.tsx` | Remove Card wrapper, adjust styling |

### Key Implementation Notes
- Dialog width: `max-w-4xl` for projects (more fields), `max-w-2xl` for experiences
- Max height: `max-h-[90vh]` with `overflow-y-auto` for scrolling
- Prevent dialog from closing when clicking inside the form
- Keep the Google Drive file picker behavior (it already conditionally renders)
