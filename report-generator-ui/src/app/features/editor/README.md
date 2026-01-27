# Editor feature folder guide

This folder contains the **report editor feature**.

## Structure

- **`toolbar/`**: editor-level UI (document actions, zoom, undo/redo). Not tied to a specific widget type.
- **`widgets/`**: widget hosting infrastructure (container, factory). This folder should **not** contain widget implementations.
- **`plugins/`**: widget-type implementations and their related UI.
  - Each plugin groups **widget**, plus any plugin UI (dialogs/toolbars), plus any plugin-specific engines.

## Rules of thumb

- Plugin code may depend on **`src/app/core/`**, **`src/app/models/`**, **`src/app/shared/`**, **`src/app/store/`**.
- Avoid importing deep internals across plugins. Prefer each plugin’s `index.ts` as its public surface.
- `widgets/widget-container` is the only place that “hosts” all widget selectors (`app-text-widget`, `app-table-widget`, etc.).


