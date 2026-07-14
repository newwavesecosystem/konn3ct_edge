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
    const storedToken = typeof window !== 'undefined' ? sessionStorage.getItem("conn3ct_session_token") : null;
    const botToken = searchParams.get("botToken");
    
    // If there is no name, no token in URL, no token in storage, and it's not a bot, redirect to join
    if (!name && !token && !storedToken && !botToken) {
      router.replace(`/join/${resolvedParams.roomId}`);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReady(true);
    }
  }, [resolvedParams.roomId, router]);

  // Protect against accidental navigation (back button, refresh, close tab)
  useEffect(() => {
    if (!isReady) return;

    // 1. Prevent tab close / refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Shows standard browser dialog
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 2. Prevent back button
    // Push a dummy state so the first 'back' action just pops this state, keeping us on the same URL.
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = () => {
      const confirmLeave = window.confirm("Are you sure you want to leave the meeting?");
      if (!confirmLeave) {
        // User wants to stay. Push the state again to trap the next 'back' action.
        window.history.pushState(null, '', window.location.href);
      } else {
        // User wants to leave. Call history.back() again to actually go back.
        window.history.back();
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isReady]);

  if (!isReady) return <div className="min-h-screen bg-[#0d0d1a]" />;

  return (
    <MeetingThemeProvider>
      <MeetingProvider roomSlug={resolvedParams.roomId}>
        <MeetingShell />
      </MeetingProvider>
    </MeetingThemeProvider>
  );
}
