---
name: clean-code-defense
description: Guidelines and checklists to prevent ESLint errors, TypeScript 'any' types, and React 19 / Compiler anti-patterns during code generation.
---

# Clean Code Defense Guide

Use this skill when authoring or modifying React 19 and TypeScript components in IntellMeet.

## 1. Type Discipline (Zero `any`)
- Never use `any`. Use strict domain models from `src/api/` or `src/types/`.
- For unknown external payloads (e.g. socket events, browser media tracks), type as `unknown` and narrow with type guards or use specific union interfaces.
- For empty extended props, use type aliases:
  ```ts
  // Bad: interface Props extends BaseProps {}
  // Good:
  export type Props = BaseProps;
  ```

## 2. Effect & State Rules (React 19 & React Compiler)
- **No synchronous `setState` in effects**: Never do `useEffect(() => { setState(val); }, [dep])` to mirror props or reset state.
  - If a value can be computed from props/state, compute it directly during render.
  - If state needs resetting when an ID changes, prefer keying the component: `<Component key={id} />`.
  - If resetting preview/streams when a shelf closes, reset in the shelf-toggle handler or within an asynchronous cleanup.
- **No in-render component declarations**:
  ```tsx
  // Bad:
  const Icon = getVolumeIcon(vol);
  return <Icon />;

  // Good:
  // Render lucide icons directly with conditional rendering or element mapping:
  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
  ```

## 3. Fast Refresh & File Discipline
- In `.tsx` component files, only export React components.
- Move shared constants, options lists, and non-component utilities to a dedicated `.constants.ts` or `.types.ts` file.

## 4. Blocks and Unused Variables
- Empty catch blocks are prohibited by `no-empty`. Handle the error or include an explicit comment: `catch { /* ignore cleanup error */ }`.
- Remove dead variables and unused destructured props. Do not assign values that are never read.
- Avoid redundant wrappers: use `canPost && <Element />` instead of `Boolean(canPost) && <Element />`.
