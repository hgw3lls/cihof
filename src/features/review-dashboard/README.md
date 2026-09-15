# Review Dashboard Module Map

`ReviewDashboardView.tsx` owns portal-level state, tab routing, and composition.

- `components/` contains portal-only React panels and shared UI primitives.
- `models/` contains pure review, source, relationship, story-lens, and packet shaping logic.
- `services/` contains browser storage, downloads, report loading, and runner communication.
- `utils/` contains small framework-independent helpers.

When refactoring, prefer moving pure data transformations into `models/`, side-effectful code into `services/`, and JSX surfaces into `components/`.
