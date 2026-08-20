import { create } from "zustand";

export interface User {
  id: number;
  email?: string;
  username: string;
  role: "user" | "owner";
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  hydrated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
}

/**
 * Browser authentication is stored only in an HttpOnly session cookie. This store
 * retains display state in memory; a page reload always rehydrates identity from
 * the server-authoritative /api/me endpoint.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  setAuth: (user) => set({ user, hydrated: true }),
  clearAuth: () => set({ user: null, hydrated: true }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
