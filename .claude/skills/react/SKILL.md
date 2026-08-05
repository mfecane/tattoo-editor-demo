---
name: react
description: Use whenever writing, editing, or reviewing React components — .tsx/.jsx files, hooks, JSX markup, component props/state, or any frontend UI work in a React codebase. Trigger this even if the user just says "add a component," "fix this UI," or pastes JSX without saying "React" explicitly. Always consult this before writing or modifying any React/tsx code.
---

# React

- Ensure root-level elements of components for large menus/panels/headers are identified with data-id property even if it is not used for styling of dom queries. It is needed for LLM context and ease of inspection via browser dev tools.

- Collapse long-ass className's containing multiple tailwind classes to construction like this:

```
className = cn(
	'class1 class2 class3',
	'class4 class5 class6',
)
```

with line length not exceeding 120 characters

# Components

- components are as dumb as possible
- custom logic is extracted into reusable hooks.
- before implementing logic onside the component, research app for existing hooks and whether they can be reused right away or refactored to make them reusable
- keep components in separate files (for saving coding agent context)
- extract logical parts of the view markup into separate components. The reasons for splitting into components
    - Readability (huge markup code is hard to scan)
    - Organization, focus
    - Save LLM context
    - Testability
    - Reusability
- page gatweays do not contain any markup, just select and render appropriate root level component and that's it.

# UI

- Use as little local customization as possible
- Keep shadcn components as close to default as possible
- Prefer customization via theme (globals.css)
- Keep idiomatic shadcn + tailwind css approach. Do not invent anything new in this domain.

## Available shadcn/ui Components

- Use as much of shadcn/ui components as possible
- never build custom HTML/Tailwind components when a shadcn equivalent exists

### Layout

- Container - Responsive container with max-width
- Flex - Flexbox wrapper (via Tailwind)
- Grid - CSS Grid wrapper (via Tailwind)
- Separator - Visual divider line
- AspectRatio - Maintains aspect ratio for media

### Data Display

- Table - Data table with sorting/pagination
- DataTable - Advanced table with filtering, sorting, pagination
- Badge - Small label/status indicator
- Avatar - User profile image with fallback
- Tooltip - Hover information popup
- Skeleton - Loading placeholder

### Forms

- Input - Text input field
- Textarea - Multi-line text input
- Button - Action button (primary, secondary, outline, ghost, etc.)
- Checkbox - Boolean checkbox
- Radio - Single selection from group
- Toggle - On/off switch
- ToggleGroup - Group of toggleable buttons
- Select - Dropdown select
- Combobox - Searchable select dropdown
- Popover - Pop-up panel
- Label - Form field label
- Form - Form wrapper with validation (react-hook-form)

### Feedback

- Alert - Alert box (info, warning, error, success)
- AlertDialog - Confirmation dialog
- Dialog - Modal dialog
- Drawer - Slide-out panel (mobile-friendly)
- Popover - Floating content panel
- Sheet - Side sheet panel
- Toast - Notification toast (Sonner)

### Navigation

- Tabs - Tabbed interface
- Breadcrumb - Navigation breadcrumb
- NavigationMenu - Dropdown navigation menu
- Pagination - Page navigation
- Sidebar - Collapsible sidebar

### Specialized

- Slider - Range slider input
- Progress - Progress bar
- Spinner - Loading spinner
- Calendar - Date picker calendar
- DatePicker - Date input field
- TimePicker - Time selection
- Card - Container card with header/footer
- Collapsible - Expandable/collapsible section
- Accordion - Expandable accordion items
- Dropdown - Dropdown menu
- Command - Command palette / search
- KbdCommand - Keyboard shortcut display

### Typography (via Tailwind)

- h1, h2, h3, h4, h5, h6 - Headings
- p - Paragraph
- Small - Small text
- Code - Inline code
- Pre - Code block
