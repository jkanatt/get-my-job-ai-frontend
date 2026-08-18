/**
 * Centralized Brand Configuration — Single Source of Truth
 * 
 * ALL brand identity, visual settings, and product metadata live here.
 * Changing a value here propagates across the entire application.
 * 
 * CSS variables are defined in globals.css and referenced here for JS contexts.
 * For CSS-only usage, reference the CSS custom properties directly.
 */

export const brand = {
  // ─── Identity ─────────────────────────────────────────────────
  name: "Get My Job",
  shortName: "Get My Job",
  tagline: "AI-Powered Job Application Platform",
  description: "AI-powered job application platform with ATS scoring, email tracking, and automated pipelines.",
  productSuffix: "Intelligence", // Shown next to brand name in sidebar

  // ─── Assets ───────────────────────────────────────────────────
  logo: {
    path: "/logo.png",
    alt: "Get My Job Logo",
  },
  favicon: "/icon.png",

  // ─── SEO & Metadata ───────────────────────────────────────────
  meta: {
    titleTemplate: (page) => page ? `${page} — Get My Job` : "Get My Job — AI-Powered Job Application Platform",
    defaultTitle: "Get My Job — AI-Powered Job Application Platform",
    ogImage: "/og-image.png",
  },

  // ─── Theme Colors (JS references to CSS variables) ───────────
  // For CSS usage, always use var(--token-name) directly.
  // These are for JS contexts (charts, dynamic inline styles, etc.)
  theme: {
    colors: {
      primary: "#6366F1",       // var(--c-primary)
      secondary: "#8B5CF6",     // var(--c-secondary)
      accent: "#00E676",        // var(--c-accent)
      success: "#10B981",       // var(--c-success)
      warning: "#F59E0B",       // var(--c-warning)
      danger: "#EF4444",        // var(--c-danger)
      info: "#3B82F6",          // var(--c-info)
      pink: "#EC4899",          // var(--c-pink)
      cyan: "#06B6D4",          // var(--c-cyan)
      background: {
        dark: "#08090A",        // var(--bg-base) dark
        light: "#F8F9FA",       // var(--bg-base) light
      },
    },
    // Light theme overrides (for JS contexts only)
    light: {
      primary: "#4F46E5",
      accent: "#059669",
    },
  },

  // ─── Chart & Graph Colors ─────────────────────────────────────
  charts: {
    palette: ["#6366F1", "#8B5CF6", "#EC4899", "#06B6D4", "#10B981", "#F59E0B"],
    grid: "rgba(255,255,255,0.06)",
    gridLight: "rgba(0,0,0,0.06)",
    axis: "#6B6C75",
    axisLight: "#6B7280",
  },

  // ─── Feature Flags ────────────────────────────────────────────
  features: {
    networking: { enabled: true, tag: "Beta" },
    architecture: { enabled: true, tag: null },
    phoneAuth: { enabled: true },
  },

  // ─── Company Information & Links ──────────────────────────────
  company: {
    supportEmail: "support@getmyjob.com",
    contactEmail: "hello@getmyjob.com",
    legal: {
      privacyPolicyUrl: "/privacy",
      termsOfServiceUrl: "/terms",
    },
    socials: {
      twitter: "https://twitter.com/getmyjob",
      linkedin: "https://linkedin.com/company/getmyjob",
    },
  },
};
