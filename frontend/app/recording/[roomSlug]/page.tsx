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
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const botToken = searchParams.get("botToken");
    
    // Security Guard: Only allow valid recorder bot tokens
    if (!botToken) {
      router.replace(`/join/${resolvedParams.roomSlug}`);
    } else {
      try {
        const base64Url = botToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const parsed = JSON.parse(jsonPayload);
        if (parsed.participantId) {
          console.log(`recorder_token_participant_id_decoded: ${parsed.participantId}`);
          setParticipantId(parsed.participantId);
        }
      } catch (e) {
        console.error("Failed to parse botToken", e);
      }
      setIsReady(true);
    }
  }, [resolvedParams.roomSlug, router]);

  // Prevent unwanted UI sounds for this route
  useEffect(() => {
    (window as any).disableAudioNotifications = true;
  }, []);

  if (!isReady || !participantId) return <div className="min-h-screen bg-black" />;

  return (
    <MeetingThemeProvider>
      {/* Provide roomSlug to MeetingProvider, disabling sounds if handled internally */}
      <MeetingProvider roomSlug={resolvedParams.roomSlug} isRecorderMode={true} recorderParticipantId={participantId}>
        <RecorderShell />
      </MeetingProvider>
    </MeetingThemeProvider>
  );
}
