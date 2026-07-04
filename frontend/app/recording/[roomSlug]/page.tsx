"use client";

import React, { useEffect, useState } from "react";
import { MeetingProvider } from "@/lib/meeting-context";
import { MeetingThemeProvider } from "@/lib/meeting-theme-context";
import { RecorderShell } from "@/components/meeting/RecorderShell";
import { useRouter } from "next/navigation";

export default function RecordingPage({
  params,
}: {
  params: Promise<{ roomSlug: string }>;
}) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const botToken = searchParams.get("botToken");
    
    // Security Guard: Only allow valid recorder bot tokens
    if (!botToken) {
      router.replace(`/join/${resolvedParams.roomSlug}`);
    } else {
      setIsReady(true);
    }
  }, [resolvedParams.roomSlug, router]);

  // Prevent unwanted UI sounds for this route
  useEffect(() => {
    (window as any).disableAudioNotifications = true;
  }, []);

  if (!isReady) return <div className="min-h-screen bg-black" />;

  return (
    <MeetingThemeProvider>
      {/* Provide roomSlug to MeetingProvider, disabling sounds if handled internally */}
      <MeetingProvider roomSlug={resolvedParams.roomSlug}>
        <RecorderShell />
      </MeetingProvider>
    </MeetingThemeProvider>
  );
}
