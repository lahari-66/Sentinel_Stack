"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSession, type Session } from "@/lib/auth";

interface AuthState {
  session: Session | null;
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false });
  // Session lives in sessionStorage, which only exists in the browser — read it after mount.
  useEffect(() => setState({ session: getSession(), ready: true }), []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const useIsAdmin = () => useAuth().session?.role === "admin";
