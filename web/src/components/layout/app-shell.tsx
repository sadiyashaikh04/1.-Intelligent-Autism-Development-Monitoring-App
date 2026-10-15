"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/primitives";
import { useDemoAuth } from "@/stores/demo-auth-store";
import { unreadCount, useQuery, useRequiredViewer, useResetDemo } from "@/lib/data-source";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { navFor } from "@/lib/domain/permissions";
import { initials } from "@/lib/format";
import { Icon, Wordmark } from "./icons";

export function DemoBanner() {
  return (
    <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
      Demo — sample data, not connected to the database.
    </div>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const viewer = useRequiredViewer();
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-1">
      {navFor(viewer.role).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
              active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-slate-100"
            }`}
          >
            <Icon name={item.key} className={`size-5 ${active ? "text-brand-600" : "text-ink-400"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const viewer = useRequiredViewer();
  const signOut = useDemoAuth((s) => s.signOut);
  const reset = useResetDemo();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-slate-100 sm:px-2"
      >
        <Avatar name={initials(viewer)} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-ink-900">
            {viewer.firstName} {viewer.lastName}
          </span>
          <span className="block text-xs text-ink-500">{ROLE_LABELS[viewer.role]}</span>
        </span>
      </button>
      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl bg-surface p-2 shadow-lg ring-1 ring-line">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-ink-900">
                {viewer.firstName} {viewer.lastName}
              </p>
              <p className="text-xs text-ink-500">{viewer.email}</p>
              <p className="text-xs text-ink-500">{ROLE_LABELS[viewer.role]}</p>
            </div>
            <button
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-ink-700 hover:bg-slate-100"
            >
              <Icon name="reset" className="size-4" /> Reset demo data
            </button>
            <button
              onClick={() => {
                signOut();
                router.replace("/login");
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-rose-700 hover:bg-rose-50"
            >
              <Icon name="logout" className="size-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Bell() {
  const count = useQuery(unreadCount);
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications, ${count} unread`}
      className="relative inline-flex size-11 items-center justify-center rounded-lg text-ink-700 hover:bg-slate-100"
    >
      <Icon name="bell" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[11px] font-semibold leading-5 text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="min-h-dvh">
      <DemoBanner />
      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-5">
        <button
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          className="inline-flex size-11 items-center justify-center rounded-lg text-ink-700 hover:bg-slate-100 lg:hidden"
        >
          <Icon name="menu" />
        </button>
        <Link href="/" className="mr-auto">
          <Wordmark />
        </Link>
        <Bell />
        <UserMenu />
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-surface p-3 lg:block">
          <SideNav />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink-900/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-surface p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between px-1">
              <Wordmark />
              <button
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
                className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <Icon name="close" />
              </button>
            </div>
            <SideNav onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
