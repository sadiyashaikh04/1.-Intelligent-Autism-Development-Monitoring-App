"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { useViewer } from "@/lib/data-source";
import { canAccessRoute, homeFor } from "@/lib/domain/permissions";
import { useDemoAuth } from "@/stores/demo-auth-store";

/**
 * Demo auth guard. Renders nothing until the session store has hydrated,
 * so a refresh never flashes the login page or another role's menu.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const hydrated = useDemoAuth((s) => s.hydrated);
  const viewer = useViewer();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !viewer) router.replace("/login");
  }, [hydrated, viewer, router]);

  if (!hydrated || !viewer) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-ink-500">Loading…</div>
    );
  }

  return (
    <AppShell>
      {canAccessRoute(viewer.role, pathname) ? (
        children
      ) : (
        <EmptyState
          title="You don't have access to this page"
          body="This section isn't part of your role. Your menu shows everything you can use."
          action={
            <Link href={homeFor(viewer.role)} className={buttonClasses("primary")}>
              Go to my home page
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
