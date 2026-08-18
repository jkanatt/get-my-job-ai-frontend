import { create } from 'zustand';

/**
 * Global application store using Zustand.
 * Manages UI state, notifications, and user preferences.
 */

// ===== UI Store =====
export const useUIStore = create((set, get) => ({
  // Sidebar
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // Command palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // Active modal
  activeModal: null, // 'apply' | 'jobDetails' | 'scanConfig' | 'compose' | null
  modalData: null,
  openModal: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // View preferences (persisted per-page)
  viewModes: { jobs: 'card', tracker: 'kanban' },
  setViewMode: (page, mode) =>
    set((s) => ({ viewModes: { ...s.viewModes, [page]: mode } })),
}));

// ===== Notification Store =====
export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) =>
    set((s) => ({
      notifications: [
        {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: new Date().toISOString(),
          read: false,
          ...notification,
        },
        ...s.notifications,
      ].slice(0, 50), // Keep max 50 notifications
      unreadCount: s.unreadCount + 1,
    })),

  markAsRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));

// ===== Theme Store =====
export const useThemeStore = create((set) => ({
  theme: 'dark', // 'dark' | 'light'
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('getmyjob-theme', theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const newTheme = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('getmyjob-theme', newTheme);
      return { theme: newTheme };
    }),
  initTheme: () => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('getmyjob-theme') : null;
    const theme = saved || 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },
}));
