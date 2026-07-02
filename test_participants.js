const prev = [
  { id: "local_uuid", userId: "local_user_id", name: "Local User" }
];
const backendParticipants = [
  { participantId: "local_uuid", userId: "local_user_id", name: "Local User" },
  { participantId: "remote_uuid", userId: "remote_user_id", name: "Remote User" }
];

const nextParticipants = [];
let duplicatesDetected = false;

// Add local user
const localUser = prev.find(p => p.id === "local_uuid");
if (localUser) nextParticipants.push(localUser);

const seenParticipantIds = new Set();
if (localUser) seenParticipantIds.add(localUser.id);

for (const p of backendParticipants) {
  if (seenParticipantIds.has(p.participantId)) {
    duplicatesDetected = true;
    continue;
  }
  seenParticipantIds.add(p.participantId);

  const existing = prev.find(existing => existing.id === p.participantId);
  if (existing) {
    nextParticipants.push({ ...existing, ...p });
  } else {
    nextParticipants.push({ id: p.participantId, ...p });
  }
}

console.log(nextParticipants);
