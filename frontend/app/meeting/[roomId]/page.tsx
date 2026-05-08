"use client";

import React from "react";
import { MeetingProvider } from "@/lib/meeting-context";
import { MeetingThemeProvider } from "@/lib/meeting-theme-context";
import { MeetingShell } from "@/components/meeting/MeetingShell";

export default function MeetingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = React.use(params);

  return (
    <MeetingThemeProvider>
      <MeetingProvider roomSlug={resolvedParams.roomId}>
        <MeetingShell />
      </MeetingProvider>
    </MeetingThemeProvider>
  );
}
