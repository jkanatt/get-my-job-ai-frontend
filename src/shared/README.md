# Shared Layer

The `shared` layer provides generic, reusable primitives.

## Responsibilities
- **Design System**: CSS variables, tokens, and atomic design constraints.
- **UI Primitives**: Generic components (Buttons, Inputs, Modals) devoid of business logic.
- **Utilities**: Date formatters, validators.
- **Constants**: Application routes, configuration flags.
- **Types**: Generic TypeScript definitions (`PaginatedResponse`).

## Critical Rules
- **Zero Business Logic**: A `Button` in `shared/ui` should never know about a "Job Application". It should only know about `onClick`, `variant`, and `children`.
- **Absolute Foundation**: `shared` can NEVER import from `core`, `infrastructure`, or `features`. It is the lowest dependency layer in the application.
