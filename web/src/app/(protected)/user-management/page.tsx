"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Chip, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import type { ClinicalDomain, User, UserRole } from "@/data/types";
import { listUsers, useActions, useQuery, useRequiredViewer } from "@/lib/data-source";
import { DOMAIN_LABELS, ROLE_LABELS } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDate, fullName } from "@/lib/format";

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
const EMPTY = { email: "", firstName: "", lastName: "", role: "PSS" as UserRole, clinicalDomain: "PSYCHOLOGY" as ClinicalDomain };

export default function UserManagementPage() {
  const viewer = useRequiredViewer();
  const actions = useActions();
  const users = useQuery((db) => listUsers(db));
  const [role, setRole] = useState<UserRole | "">("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const manage = can(viewer.role, "user.manage");
  const rows = users.filter((u) => !role || u.role === role);
  const clinical = form.role === "JR_PSYCHOLOGIST" || form.role === "MDT_HEAD";

  function create() {
    const r = actions.createUser({ ...form, clinicalDomain: clinical ? form.clinicalDomain : null });
    if (!r.ok) return setError(r.error ?? "Could not add the user.");
    setNotice(`${form.firstName} ${form.lastName} can now sign in from the login page.`);
    setAdding(false);
    setForm(EMPTY);
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={manage ? "Create accounts and control who can sign in." : "Read-only directory of staff and parents."}
        actions={manage ? <Button onClick={() => { setAdding(true); setError(null); }}>Add user</Button> : undefined}
      />
      {notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
      <div className="mb-4 max-w-xs">
        <Field label="Role" htmlFor="um-role">
          <Select id="um-role" value={role} onChange={(e) => setRole(e.target.value as UserRole | "")}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </Field>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No users with this role" />
      ) : (
        <DataTable<User>
          rows={rows}
          rowKey={(u) => u.id}
          mobileTitle={(u) => fullName(u)}
          columns={[
            { header: "Name", cell: (u) => <span className="font-medium">{fullName(u)}</span>, desktopOnly: true },
            { header: "Email", cell: (u) => <span className="text-ink-700">{u.email}</span>, wide: true },
            { header: "Role", cell: (u) => ROLE_LABELS[u.role] },
            { header: "Domain", cell: (u) => (u.clinicalDomain ? DOMAIN_LABELS[u.clinicalDomain] : "—"), desktopOnly: true },
            { header: "Joined", cell: (u) => <span className="whitespace-nowrap">{formatDate(u.createdAt)}</span>, desktopOnly: true },
            { header: "Status", cell: (u) => <Chip tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Deactivated"}</Chip> },
            ...(manage
              ? [{
                  header: "",
                  cell: (u: User) =>
                    u.id === viewer.id ? (
                      <span className="text-xs text-ink-400">You</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={u.isActive ? "secondary" : "success"}
                        onClick={() => actions.setUserActive({ userId: u.id, isActive: !u.isActive })}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    ),
                }]
              : []),
          ]}
        />
      )}

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a user"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={create}>Add user</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="um-first">
            <Input id="um-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name" htmlFor="um-last">
            <Input id="um-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
        </div>
        <Field label="Email" htmlFor="um-email">
          <Input id="um-email" type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role" htmlFor="um-new-role">
          <Select id="um-new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </Field>
        {clinical && (
          <Field label="Clinical domain" htmlFor="um-domain">
            <Select id="um-domain" value={form.clinicalDomain} onChange={(e) => setForm({ ...form, clinicalDomain: e.target.value as ClinicalDomain })}>
              {(Object.keys(DOMAIN_LABELS) as ClinicalDomain[]).map((d) => <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>)}
            </Select>
          </Field>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </Dialog>
    </>
  );
}
