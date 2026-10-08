# Component Refactoring & Consistency Policy

1. **Circular Avatar Consistency**:
   - All profile avatars and `<Avatar>` / `<AvatarFallback>` elements across the entire application must be 100% circular (`rounded-full`). Never use rounded rectangles (`rounded-md` or `rounded-lg`) for user profile avatars.

2. **Systematic Component Auditing (`/learn`)**:
   - When creating or updating a common UI component (e.g. `Avatar`, `Modal`, `DataTable`, `Badge`), ALWAYS search the entire codebase for pre-existing hardcoded/legacy elements and refactor them to consume the new common component.
