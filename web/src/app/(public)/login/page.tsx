"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Wordmark } from "@/components/layout/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Avatar, Notice } from "@/components/ui/primitives";
import type { User, UserRole } from "@/data/types";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { homeFor } from "@/lib/domain/permissions";
import { initials } from "@/lib/format";
import { useDemoAuth } from "@/stores/demo-auth-store";
import { useDemoData } from "@/stores/demo-data-store";

/** One quick-pick account per role, in the order a demo walks through them. */
const QUICK_PICK: Array<{ role: UserRole; email: string }> = [
  { role: "SUPER_ADMIN", email: "admin@iadm.local" },
  { role: "CSC", email: "csc1@iadm.local" },
  { role: "JR_PSYCHOLOGIST", email: "psych1@iadm.local" },
  { role: "MDT_HEAD", email: "mdthead@iadm.local" },
  { role: "PSS", email: "pss1@iadm.local" },
  { role: "PARENT", email: "parent1@iadm.local" },
];

export default function LoginPage() {
  const router = useRouter();
  const users = useDemoData((s) => s.db.users);
  const { userId, hydrated, signIn } = useDemoAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Already signed in (e.g. back button) → straight to the right home.
  useEffect(() => {
    const current = users.find((u) => u.id === userId);
    if (hydrated && current) router.replace(homeFor(current.role));
  }, [hydrated, userId, users, router]);

  function enter(user: User | undefined) {
    if (!user) {
      setError("No demo account with that email. Pick one of the accounts below.");
      return;
    }
    if (!user.isActive) {
      setError("This account is deactivated.");
      return;
    }
    signIn(user.id);
    router.replace(homeFor(user.role));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    enter(users.find((u) => u.email === email.trim().toLowerCase()));
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Wordmark />
          <p className="mt-3 text-sm text-ink-500">Intelligent Autism Development Monitoring</p>
        </div>

        <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line">
          <h1 className="text-lg font-semibold text-ink-900">Sign in</h1>
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="name@iadm.local"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                required
              />
            </Field>
            <Field label="Password" htmlFor="password" hint="Any password works in demo mode.">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" className="w-full" size="lg">
              Sign in
            </Button>
          </form>

          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
              Or try a demo account
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUICK_PICK.map(({ role, email: pickEmail }) => {
                const user = users.find((u) => u.email === pickEmail);
                if (!user) return null;
                return (
                  <li key={role}>
                    <button
                      onClick={() => enter(user)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left ring-1 ring-inset ring-line hover:bg-brand-50 hover:ring-brand-200"
                    >
                      <Avatar name={initials(user)} size="sm" />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-sm font-medium text-ink-900">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {role === "CSC" ? "Care Coordinator (CSC)" : ROLE_LABELS[role]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-500">
          Demo mode — real authentication arrives in Phase 1. All data is synthetic.
        </p>
      </div>
    </div>
  );
}
