# IntellMeet Design System & UI/UX Style Guide

## 1. Core Principles & UX Standard
- **Sharp Corners with Slightly Rounded Edges (`rounded-sm` / micro-radius)**: Use sharp, clean geometric corners with subtle, slightly rounded edges (`rounded-sm` / 2px-4px radius) across buttons, inputs, cards, panels, badges, and dialogs. Avoid rounded-2xl or rounded-full shapes except for circular profile avatars.
- **No Extra Card Backgrounds / Outer Borders**: Do NOT wrap page contents, search/filter bars, or forms inside heavy `bg-card border border-border` container boxes. Page sections and toolbars sit cleanly on `bg-background`.
- **Consistent Input Heights**: All input fields, select triggers, and action buttons use standard, consistent sizing (`h-10` for form inputs, `h-9` for search inputs & action buttons).
- **Dedicated Form Pages Over Modals**: Do NOT use popup modal dialogs for creating or editing entities (Teams, Tasks, Projects, Work Roles, Meetings). Always render dedicated full-view form pages (`/teams/new`, `/teams/:id/edit`, `/tasks/new`, `/tasks/:id/edit`).
- **Clean Layouts & No Unwanted Footers**: Auth/Login pages must be sleek, focused, and free of extraneous footers or unwanted public links.

---

## 2. Color Tokens & Themes

### Dark Mode Base Tokens
- **Background**: `var(--background)` (`#09090b` / `bg-background`)
- **Foreground / Primary Text**: `var(--foreground)` (`#f8fafc` / `text-foreground`)
- **Muted Text**: `var(--muted-foreground)` (`#94a3b8` / `text-muted-foreground`)
- **Card / Panel Background**: `var(--card)` (`#0f172a` / `bg-card`)
- **Borders**: `var(--border)` (`rgba(255, 255, 255, 0.08)` / `border-border`)

### Brand Accent (Emerald Focus)
- **Primary Brand Color**: Emerald 600 (`#059669` / `bg-emerald-600`)
- **Hover State**: Emerald 500 (`#10b981` / `hover:bg-emerald-500`)
- **Focus Ring**: `focus-visible:ring-2 focus-visible:ring-emerald-500/40`

---

## 3. Component Standards

### Standard Page Header
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
      <Icon size={24} className="text-emerald-500" />
      <span>{title}</span>
    </h1>
    <p className="text-xs text-muted-foreground mt-1">{description}</p>
  </div>
  <div className="flex items-center gap-2.5">
    {actions}
  </div>
</div>
```

### Toolbar & Search (No Card Wrapper)
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
  <div className="flex items-center gap-3 flex-1">
    <Input placeholder="Search..." className="max-w-xs h-9 text-xs" />
    <Select value={filter} onValueChange={setFilter}>
      <SelectTrigger className="w-48 h-9 text-xs">
        <SelectValue placeholder="All" />
      </SelectTrigger>
    </Select>
  </div>
</div>
```

### Form Input Pattern (`h-10`)
```tsx
<FormField label="Field Name" htmlFor="field-id" required error={errors.field?.message}>
  <Input id="field-id" className="h-10" {...register('field')} />
</FormField>
```

---

## 4. Route & Navigation Conventions
- Entity Overview: `/teams`, `/tasks`, `/projects`, `/meetings`, `/organization/work-roles`
- Entity Create: `/teams/new`, `/tasks/new`, `/projects/new`, `/meetings/new`, `/organization/work-roles/new`
- Entity Edit: `/teams/:id/edit`, `/tasks/:id/edit`, `/projects/:id/edit`
