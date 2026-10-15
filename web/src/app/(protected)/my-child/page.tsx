"use client";

import { useState } from "react";
import { goalRate } from "@/components/residents/detail-tabs";
import { Field, Select } from "@/components/ui/form";
import { Avatar, Bar, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import type { ResidentStatus } from "@/data/types";
import {
  getDevelopment,
  getResidentDetail,
  listCalendarSlots,
  listResidents,
  useQuery,
} from "@/lib/data-source";
import { DOMAIN_LABELS, ROLE_LABELS, trajectorySentence } from "@/lib/domain/labels";
import { ageFrom, formatTime, formatWeekday, fullName, initials, percent } from "@/lib/format";

/** What each stage means, said to a parent rather than a clinician. */
const PLAIN_STATUS: Record<ResidentStatus, string> = {
  IMPORTED: "We've received the referral and are reviewing it.",
  ENROLLED: "Enrolment is confirmed. A coordinator will be assigned soon.",
  CSC_ASSIGNED: "A care coordinator is now looking after the next steps.",
  MDT_ASSIGNED: "The care team is in place and will plan the first assessments.",
  ASSESSMENTS_SCHEDULED: "First assessments are booked.",
  ASSESSMENTS_IN_PROGRESS: "Assessments are under way so we can understand strengths and needs.",
  ASSESSMENTS_COMPLETED: "Assessments are complete. The care plan will be written next.",
  IEP_IN_PROGRESS: "The care plan and its goals are being prepared and reviewed.",
  IEP_APPROVED: "The care plan has been approved and will start shortly.",
  ACTIVE: "The care plan is active and daily support is under way.",
  INACTIVE: "Support is currently paused. The coordinator will be in touch.",
};

function mondayOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export default function MyChildPage() {
  const children = useQuery(listResidents, {});
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const detail = useQuery(getResidentDetail, childId);
  const trends = useQuery(getDevelopment, childId) ?? [];
  const week = useQuery(listCalendarSlots, mondayOfThisWeek());

  if (!detail) {
    return (
      <>
        <PageHeader title="My child" />
        <EmptyState title="No child linked to your account" body="Please contact the care coordinator." />
      </>
    );
  }

  const r = detail.resident;
  const activePlan = detail.plans.find((p) => p.plan.status === "ACTIVE_IEP");
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentAdl = detail.recentAdl.filter((row) => new Date(`${row.log.logDate}T00:00:00`) >= weekAgo);
  const adlRate = recentAdl.length ? recentAdl.filter((row) => row.log.status === "DONE").length / recentAdl.length : null;
  const upcoming = week.filter((s) => new Date(s.slot.endsAt) >= new Date());

  return (
    <div className="mx-auto max-w-3xl">
      {children.length > 1 && (
        <div className="mb-4 max-w-xs">
          <Field label="Child" htmlFor="child">
            <Select id="child" value={childId} onChange={(e) => setChildId(e.target.value)}>
              {children.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
            </Select>
          </Field>
        </div>
      )}

      <div className="mb-5 flex items-center gap-4">
        <Avatar name={initials(r)} size="lg" />
        <div>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{r.firstName} {r.lastName}</h1>
          <p className="text-sm text-ink-500">Age {ageFrom(r.dateOfBirth)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardTitle>Where things are</CardTitle>
          <p className="text-sm text-ink-900">{PLAIN_STATUS[r.status]}</p>
        </Card>

        {trends.length > 0 && (
          <Card>
            <CardTitle>How {r.firstName} is doing</CardTitle>
            <ul className="space-y-2">
              {trends.map((t) => (
                <li key={t.domain} className="text-sm text-ink-900">
                  {trajectorySentence(t.latest.trajectory, t.domain)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">Based on the care team&apos;s daily notes. Sample data in this demo.</p>
          </Card>
        )}

        <Card>
          <CardTitle>Goals</CardTitle>
          {!activePlan ? (
            <p className="text-sm text-ink-500">Goals will appear here once the care plan is active.</p>
          ) : (
            <ul className="space-y-4">
              {activePlan.goals
                .filter((g) => g.goal.approvalStatus === "APPROVED_MDT")
                .map(({ goal, progress }) => {
                  const rate = goalRate(progress);
                  return (
                    <li key={goal.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium text-ink-900">{goal.title}</p>
                        <span className="shrink-0 text-xs text-ink-500">{DOMAIN_LABELS[goal.domain]}</span>
                      </div>
                      <Bar value={rate ?? 0} tone="brand" />
                      <p className="mt-1 text-xs text-ink-500">
                        {rate === null ? "Just started" : `Achieved in ${percent(rate)} of recent sessions`}
                      </p>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>

        {adlRate !== null && (
          <Card>
            <CardTitle>Daily living this week</CardTitle>
            <Bar value={adlRate} tone="success" />
            <p className="mt-2 text-sm text-ink-700">
              {percent(adlRate)} of daily activities (washing, dressing, meals…) were completed in the last 7 days.
            </p>
          </Card>
        )}

        <Card>
          <CardTitle>This week&apos;s sessions</CardTitle>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-500">No more sessions scheduled this week.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 8).map(({ slot, room }) => (
                <li key={slot.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink-900">{slot.title}</span>
                  <span className="shrink-0 text-xs text-ink-500">
                    {formatWeekday(new Date(slot.startsAt))} · {formatTime(slot.startsAt)}
                    {room && ` · ${room.name}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Care team</CardTitle>
          {detail.careTeam.length === 0 ? (
            <p className="text-sm text-ink-500">The care team will be introduced soon.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {detail.careTeam.map(({ assignment, user }) => (
                <li key={assignment.id} className="flex items-center gap-3">
                  <Avatar name={user ? initials(user) : "?"} size="sm" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-medium text-ink-900">{fullName(user)}</span>
                    <span className="block truncate text-xs text-ink-500">{ROLE_LABELS[assignment.role]}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
