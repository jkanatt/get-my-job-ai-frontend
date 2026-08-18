# Features Layer

The `features` layer is organized using **Feature-Sliced Design (FSD)**.

## Responsibilities
- Groups code by **Business Domain** rather than technical type.
- Example: Instead of putting all reducers in `/store` and all components in `/components`, we group everything related to a Job in `features/jobs/`.

## Anatomy of a Feature
Each feature folder (e.g., `jobs`) contains:
- `components/`: UI specific to this feature.
- `api/`: Data fetching functions specific to this feature.
- `store/`: Local state management.
- `types/`: Domain-specific TypeScript models.
- `hooks/`: Domain-specific React hooks.
- `index.ts`: The **Public API** of the feature.

## Critical Rules
- **Strict Boundaries**: A feature (e.g., `networking`) cannot import deep into another feature (e.g., `import X from '@/features/jobs/components/X'`). If two features need to share something, it must either be exposed via the target feature's `index.ts`, or extracted down into the `shared` layer.
