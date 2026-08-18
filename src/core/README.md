# Core Layer

The `core` layer contains application-wide rules, state, and security boundaries.

## Responsibilities
- **Global Error Handling**: Uncaught exceptions (`ErrorBoundary`).
- **Telemetry**: Logging and monitoring (`logger.ts`).
- **Security & Auth**: Authentication wrappers, token management, and RBAC (Role-Based Access Control).
- **Global State**: Stores that must be accessed across entirely separate domains (e.g., Theme, Layout toggles).

## Rules
- **No Domain Logic**: The core layer must NEVER import from `src/features`.
- **Framework Agnostic (Mostly)**: Try to keep core utilities decoupled from specific UI framework quirks where possible.
