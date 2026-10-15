"use client";

import { PageHeader } from "@/components/ui/primitives";
import { useRequiredViewer } from "@/lib/data-source";

export default function DashboardPage() {
  const viewer = useRequiredViewer();
  return <PageHeader title={`Welcome, ${viewer.firstName}`} subtitle="Your dashboard is being built." />;
}
