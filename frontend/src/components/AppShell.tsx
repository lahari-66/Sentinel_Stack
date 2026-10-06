"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/lib/auth";
import { mockMode } from "@/lib/config";
import { useAuth } from "./AuthProvider";
import { cx } from "./ui";

const NAV = [
  { href: "/accounts/", label: "Accounts" },
  { href: "/findings/", label: "Findings" },
  { href: "/scans/", label: "Scans" },
  { href: "/audit/", label: "Audit log" },
  { href: "/settings/", label: "Settings" },
];

function Logo() {
  return (
    <Link href="/accounts/" className="flex items-center gap-2 font-semibold text-slate-900">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      SentinelStack
    </Link>
  );
}

function UserBox() {
  const { session } = useAuth();
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{session?.email}</p>
        <p className="text-xs capitalize text-slate-500">{session?.role}</p>
      </div>
      <button onClick={logout} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
        Sign out
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href.replace(/\/$/, ""));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cx(
              "rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <Logo />
        <div className="mt-8 flex-1">{nav}</div>
        <UserBox />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Logo />
        <button onClick={() => setOpen((o) => !o)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Toggle navigation">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      {open && (
        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          {nav}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <UserBox />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        {mockMode && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 sm:px-8">
            Demo mode — showing mock data. Set <code>NEXT_PUBLIC_API_URL</code> to connect to the API.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
