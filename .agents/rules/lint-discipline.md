# Rule: Lint & TypeScript Cleanliness

When generating or editing code in `client/`:

1. **Strict Types**: Never introduce `any`. Use domain types, generics, or `unknown` with narrowing.
2. **React 19 Effects**: Do not call `setState()` synchronously in an effect body to mirror props or reset values. Compute derived values during render.
3. **No Dynamic Components in Render**: Do not instantiate or declare component functions inside JSX or render closures.
4. **Fast Refresh**: Do not export non-component constants or functions from `.tsx` files that export components.
5. **No Dead Code**: Remove all unused variables, unused imports, and empty catch blocks.
