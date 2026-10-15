"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useViewer } from "@/lib/data-source";
import { homeFor } from "@/lib/domain/permissions";
import { useDemoAuth } from "@/stores/demo-auth-store";

export default function Home() {
  const router = useRouter();
  const hydrated = useDemoAuth((s) => s.hydrated);
  const viewer = useViewer();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(viewer ? homeFor(viewer.role) : "/login");
  }, [hydrated, viewer, router]);

  return null;
}
