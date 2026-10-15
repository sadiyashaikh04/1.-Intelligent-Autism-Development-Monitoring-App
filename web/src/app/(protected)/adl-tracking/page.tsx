"use client";

import { AdlApprovalQueue } from "@/components/logging/adl-approval-queue";
import { AdlLogging } from "@/components/logging/adl-logging";
import { useRequiredViewer } from "@/lib/data-source";
import { can } from "@/lib/domain/permissions";

/** One route, two jobs: a PSS logs activities; a CSC approves them. */
export default function AdlTrackingPage() {
  const viewer = useRequiredViewer();
  return can(viewer.role, "adl.log") ? <AdlLogging /> : <AdlApprovalQueue />;
}
