/* eslint-disable react-refresh/only-export-components -- co-locating hooks with their Provider is intentional */
// AuthProvider — owner of WHO is signed in.
//
// Phase 2 refactor: pull session + login + claim out of the monolithic
// AppContext into a focused provider. The provider exposes:
//   • currentUser / currentRole       — the active person
//   • signIn / signOut                — single sign-in/out path
//   • lookupClaim / claimIdentity     — roster-first claim
//   • bootstrapCC                     — CC self-registration
//   • restoreSession                  — runs on mount, restores from
//                                       localStorage today; reads from
//                                       Supabase auth.getSession when
//                                       USE_SUPABASE=true.
//
// Today this is implemented as a facade over AppContext (the actual
// state still lives there) so the existing 33+ pages don't break. The
// public surface, however, is final — when AppContext is fully gutted,
// no consumer of useAuth() needs to change.

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { MockUser, UserRole } from '../types';
import { useApp } from '../context/AppContext';
import { USE_SUPABASE, supabase } from '../api/_supabase';
import { queryClient, qk } from '../api/queryClient';

export interface AuthApi {
  currentUser: MockUser | null;
  currentRole: UserRole;
  isAuthenticated: boolean;

  signIn:        (phone: string, password: string) => { user: MockUser | null; error?: string };
  signOut:       () => void;
  lookupClaim:   (phone: string, idLast4: string) => ReturnType<ReturnType<typeof useApp>['lookupClaim']>;
  claimIdentity: (phone: string, idLast4: string, password: string, confirmTransfer?: boolean)
                 => ReturnType<ReturnType<typeof useApp>['claimIdentity']>;
  bootstrapCC:   (data: { name: string; phone: string; idLast4: string; password: string })
                 => ReturnType<ReturnType<typeof useApp>['bootstrapCC']>;
}

const AuthCtx = createContext<AuthApi | null>(null);

const MOCK_SESSION_KEY = 'ha-pluga-sheli/mock-session-phone';

export function AuthProvider({ children }: { children: ReactNode }) {
  const app = useApp();

  // ── Mock-mode session persistence ─────────────────────────────────
  // When USE_SUPABASE=false the demo still has to survive a refresh.
  // We persist the signed-in phone and re-sign on mount with the same
  // mock password convention. NOT a security mechanism — purely for the
  // demo UX. When USE_SUPABASE=true this is a no-op (Supabase Auth
  // handles session restore via its own storage).
  useEffect(() => {
    if (USE_SUPABASE || app.currentUser) return;
    try {
      const phone = localStorage.getItem(MOCK_SESSION_KEY);
      if (!phone) return;
      // All mock users share the same demo password.
      app.signIn(phone, 'Test@1234');
    } catch {
      // localStorage unavailable (incognito, etc.) — silently skip.
    }
    // Run once on mount when not authenticated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the active user's phone to localStorage so the effect above
  // can restore it next mount.
  useEffect(() => {
    if (USE_SUPABASE) return;
    try {
      if (app.currentUser) {
        localStorage.setItem(MOCK_SESSION_KEY, app.currentUser.phone);
      } else {
        localStorage.removeItem(MOCK_SESSION_KEY);
      }
    } catch { /* ignore */ }
  }, [app.currentUser]);

  // ── Supabase session restore ──────────────────────────────────────
  useEffect(() => {
    if (!USE_SUPABASE) return;
    let cancelled = false;
    void supabase().auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        queryClient.setQueryData(qk.session(), data.session);
      }
    });
    const sub = supabase().auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(qk.session(), session);
      if (!session) queryClient.clear();
    });
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const value: AuthApi = {
    currentUser: app.currentUser,
    currentRole: app.currentRole,
    isAuthenticated: !!app.currentUser,
    signIn: app.signIn,
    signOut: () => {
      if (USE_SUPABASE) void supabase().auth.signOut();
      try { localStorage.removeItem(MOCK_SESSION_KEY); } catch { /* ignore */ }
      app.logout();
      queryClient.clear();
    },
    lookupClaim: app.lookupClaim,
    claimIdentity: app.claimIdentity,
    bootstrapCC: app.bootstrapCC,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthApi {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

/** Tight helper for the common case. */
export function useCurrentUser(): MockUser | null {
  return useAuth().currentUser;
}
