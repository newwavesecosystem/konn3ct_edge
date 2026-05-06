"use client";

import React from "react";
import { MeetingProvider } from "@/lib/meeting-context";
import { MeetingShell } from "@/components/meeting/MeetingShell";

export default function MeetingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = React.use(params);

  return (
    <MeetingProvider roomSlug={resolvedParams.roomId}>
      <MeetingShell />
    </MeetingProvider>
  );
}
