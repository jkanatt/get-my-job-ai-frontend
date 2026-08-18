# Infrastructure Layer

The `infrastructure` layer handles all communication across external boundaries.

## Responsibilities
- **API Clients**: Axios/Fetch wrappers and interceptors.
- **Caching**: React Query (`query-client.ts`).
- **Databases**: Supabase client initialization.
- **Third-Party Services**: Wrappers for Stripe, SendGrid, Mixpanel, etc.

## Rules
- Components in `features` or `app` should never interact directly with `window.localStorage` or raw `fetch`. They should call services exported from this layer.
- This layer does NOT contain UI.
