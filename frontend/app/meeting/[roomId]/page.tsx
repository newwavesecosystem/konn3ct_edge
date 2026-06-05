"use client";

import React, { useEffect, useState } from "react";
import { MeetingProvider } from "@/lib/meeting-context";
import { MeetingThemeProvider } from "@/lib/meeting-theme-context";
import { MeetingShell } from "@/components/meeting/MeetingShell";
import { useRouter } from "next/navigation";

export default function MeetingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const name = searchParams.get("name");
    const token = searchParams.get("t");
    const bot = searchParams.get("bot");
    const storedToken = typeof window !== 'undefined' ? sessionStorage.getItem("conn3ct_session_token") : null;
    
    // If there is no name, no token in URL, no token in storage, and it's not a bot, redirect to join
    if (!name && !token && !storedToken && bot !== "true") {
      router.replace(`/join/${resolvedParams.roomId}`);
    } else {
      setIsReady(true);
    }
  }, [resolvedParams.roomId, router]);

  if (!isReady) return <div className="min-h-screen bg-[#0d0d1a]" />;

  return (
    <MeetingThemeProvider>
      <MeetingProvider roomSlug={resolvedParams.roomId}>
        <MeetingShell />
      </MeetingProvider>
    </MeetingThemeProvider>
  );
}
