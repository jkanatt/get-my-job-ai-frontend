export const codebaseTaxonomy = {
  '/engines': {
    name: 'Engines Layer (AI & Compute)',
    description: 'The computational brain of the Get My Job platform.',
    purpose: 'Houses all heavy-lifting cognitive models, scoring engines, and formatting utilities that operate entirely autonomously. These scripts do not interact directly with the UI.',
    weaknesses: 'High token usage. Tightly coupled to specific model versions. Brittle if prompt parameters are changed without testing.',
    role: 'Executes the core Get My Job AI Tailor loops, Vector generation, PDF Compilation, and Cover Letter drafting.'
  },
  '/scripts': {
    name: 'Scripts Layer (Application Factory)',
    description: 'The orchestration and execution automation layer.',
    purpose: 'Acts as a headless factory, spinning up Python/Playwright workers to scrape job boards and submit applications across the web.',
    weaknesses: 'Significant technical debt. Scripts often duplicate configuration setups and directly interact with the database instead of using shared infrastructure repositories.',
    role: 'Handles all end-to-end cron jobs, batch testing, LocalStack queue submissions, and browser automation tasks.'
  },
  '/src/features': {
    name: 'Features Layer (Next.js Domain Modules)',
    description: 'The front-end domain architecture.',
    purpose: 'Provides the visual command center (Kanban boards, Calendar, Intelligence graphs). Each feature is encapsulated with its own components, utilities, and API routes.',
    weaknesses: 'Occasional client-side hydration issues. Some components may fetch data directly instead of using central React hooks.',
    role: 'Allows the user to observe and control the autonomous pipelines in a polished, Apple-tier dashboard environment.'
  },
  '/src/infrastructure': {
    name: 'Infrastructure Layer (Shared Core)',
    description: 'The global state and connectivity backbone.',
    purpose: 'Manages database adapters (Supabase/DynamoDB), email IMAP/SMTP transport, and multi-provider LLM routing logic.',
    weaknesses: 'Error handling is sometimes swallowed. The adapter pattern could be formalized further into strict TypeScript interfaces.',
    role: 'Provides a unified interface for the rest of the application to access external dependencies.'
  },
  '/.data': {
    name: 'Data Layer (The User Brain)',
    description: 'The physical local storage of the user\'s professional history.',
    purpose: 'Stores raw Markdown files from Obsidian and compiled JSON project graphs that act as the single source of truth for the AI tailor.',
    weaknesses: 'Susceptible to format breaking if the user inputs malformed markdown. Requires strict Pre-Flight Validation.',
    role: 'Serves as the knowledge repository that is vectorized and retrieved via Cosine Similarity.'
  }
};
