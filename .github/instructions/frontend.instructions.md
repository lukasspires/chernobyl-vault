---
applyTo: "frontend/**/*.ts,frontend/**/*.tsx,frontend/**/*.css,frontend/package.json,frontend/tsconfig.json,frontend/vite.config.ts,frontend/vitest.config.ts"
---

# React frontend instructions

- Preserve React 19, TypeScript strict mode, Vite 6, React Router 7, TanStack Query 5, Zustand 5, Tailwind CSS 4, and the existing component conventions.
- Keep remote/server state in TanStack Query. Use Zustand only for shared client preferences and avoid duplicating query data in the store.
- Keep API calls and transport types in `frontend/src/api.ts`; update them whenever backend contracts change.
- Components must cover loading, empty, error, and success states where applicable.
- Preserve keyboard, pointer, touch, fullscreen, LTR/RTL, zoom, focus, and responsive behavior in reader changes.
- Use semantic HTML, visible focus, accessible names, and correct button/link behavior.
- Avoid unsafe HTML and direct DOM access except for focused platform interactions such as fullscreen, with cleanup.
- Add behavior-focused Vitest and Testing Library tests beside the affected component or page.
- Run `npm test` and `npm run build` from `frontend/` after frontend changes.

