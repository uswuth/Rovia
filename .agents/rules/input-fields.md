# UI Input Field & Tool Rules

- **Global Input Component**: Always use the global `<Input />` component from `@/components/ui/input` instead of raw `<input>` elements with ad-hoc styling.
- **Corner Radius**: Do not use custom high-radius classes like `rounded-xl` or `rounded-full` on text input fields. Input fields must adhere to the design system's global radius (`rounded-md` as defined in the global `<Input />` component).
- **Poll Action Icons**: Action icon buttons for polls (e.g., `<BarChart3>` in chat) must use `rounded-xs`.
