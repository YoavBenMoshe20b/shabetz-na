# `api/` — backend-ready data gateway

This directory is the **single contract surface** between the React app and
whatever persists the data. Today every function returns mock data wrapped
in a Promise so the signature already matches a real backend.

## Why this layer

The app started as in-memory mock state inside `AppContext`. That works
for prototyping but ties every page tightly to a specific implementation.
When Supabase / Firebase / a custom Node backend lands, we want to:

1. **Replace one folder**, not 40 files.
2. **Keep the call sites stable** — page code never changes when the
   adapter changes.
3. **Make async behavior visible from day one** so suspense / loading /
   error handling is wired correctly.

## Conventions

* Every read returns `Promise<T>`. Today the body is
  `Promise.resolve(mockData.x)`. Tomorrow it's a `supabase.from(...).select()`.
* Every write returns `Promise<T>` of the persisted entity (server may
  echo back generated IDs / timestamps).
* Errors throw. Callers wrap in try/catch or react-query.
* Modules are organized by domain, not by HTTP verb.
* No module knows about React. Pure data plane.

## Integration with AppContext

AppContext is the **state cache + write coordinator** today. The
read-paths in this layer are equivalent to what AppContext exposes via
`useApp()`. The intent is that:

* Today: `AppContext` reads `mockData` synchronously, and `api/*` shadows
  the same data for new code paths that want async-shaped reads.
* Tomorrow: `AppContext` becomes a thin React-Query / Zustand layer that
  delegates to `api/*` for every fetch.

We intentionally do **not** flip every page to `api/*` today — that's
busy-work. New features should consume `api/*` directly; legacy pages
keep their `useApp()` reads. The migration happens organically when the
backend lands.
