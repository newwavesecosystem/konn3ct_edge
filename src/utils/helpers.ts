export function calculateSubscriptionEndDate(currentEnd: Date | null, plan: any | null): Date {
  const baseDate = currentEnd && currentEnd > new Date() ? currentEnd : new Date();
  const endDate = new Date(baseDate);
  const durationDays = plan && 'durationDays' in plan && typeof plan.durationDays === 'number' ? plan.durationDays : 30;
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
}

export function determineRecordingAccess(
  recording: { ownerId: string; isPrivate: boolean; priceKobo?: number | null },
  userId: string | null,
  hasPaid: boolean
): boolean {
  if (recording.ownerId === userId) return true;
  if (!recording.isPrivate) {
    if (!recording.priceKobo) return true; // free and public
    if (recording.priceKobo > 0 && hasPaid) return true; // paid and purchased
  }
  return false;
}

export function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const transitions: Record<string, string[]> = {
    pending: ['starting', 'failed'],
    starting: ['recording', 'failed'],
    recording: ['stopping', 'failed'],
    stopping: ['processing', 'completed', 'failed'],
    processing: ['completed', 'failed'],
    completed: [],
    failed: []
  };
  return transitions[currentStatus]?.includes(newStatus) ?? false;
}
