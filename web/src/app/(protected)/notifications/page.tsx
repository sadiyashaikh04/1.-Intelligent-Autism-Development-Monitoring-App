"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, Chip, EmptyState, PageHeader } from "@/components/ui/primitives";
import type { Notification, UserRole } from "@/data/types";
import { listNotifications, useActions, useQuery, useRequiredViewer } from "@/lib/data-source";
import { severityTone } from "@/lib/domain/labels";
import { canAccessRoute, homeFor } from "@/lib/domain/permissions";
import { relativeTime } from "@/lib/format";

const ENTITY_ROUTES: Record<string, string> = {
  Resident: "/service-user",
  Incident: "/incidents",
  Assessment: "/assessment",
  IepPlan: "/iep",
};

/** Where a notification leads — only to pages the role may open. */
function targetFor(n: Notification, role: UserRole): string {
  const base = n.entityType ? ENTITY_ROUTES[n.entityType] : undefined;
  const href = base && n.entityId ? `${base}/${n.entityId}` : undefined;
  return href && canAccessRoute(role, href) ? href : homeFor(role);
}

export default function NotificationsPage() {
  const router = useRouter();
  const viewer = useRequiredViewer();
  const actions = useActions();
  const items = useQuery(listNotifications);
  const unread = items.filter((n) => !n.readAt).length;

  function open(n: Notification) {
    actions.markNotificationRead({ notificationId: n.id });
    router.push(targetFor(n, viewer.role));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up"}
        actions={
          unread > 0 ? (
            <Button variant="secondary" onClick={() => actions.markAllNotificationsRead({})}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet" />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={() => open(n)} className={`flex w-full gap-3 p-4 text-left hover:bg-slate-50 ${n.readAt ? "" : "bg-brand-50/40"}`}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand-600"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm ${n.readAt ? "font-medium text-ink-700" : "font-semibold text-ink-900"}`}>{n.title}</span>
                      {n.severity !== "NORMAL" && (
                        <Chip tone={severityTone(n.severity)}>{n.severity === "CRITICAL_INTERRUPT" ? "Critical" : "High"}</Chip>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-500">{n.body}</span>
                    <span className="mt-1 block text-xs text-ink-400">{relativeTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
