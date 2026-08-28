import React, { useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldAlert, Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreenSharePermissionsDialog({ open, onOpenChange }: Props) {
  const {
    screenSharePolicyMode,
    setScreenSharePolicy,
    participantScreenSharePermissions,
    setParticipantScreenSharePermission,
    stopAllParticipantScreenShares,
    participants,
    currentUser
  } = useMeeting();

  const [localMode, setLocalMode] = useState(screenSharePolicyMode);
  const [search, setSearch] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [stopExisting, setStopExisting] = useState(false);

  // Sync when opened
  React.useEffect(() => {
    if (open) {
      setLocalMode(screenSharePolicyMode);
      setShowConfirm(false);
      setStopExisting(false);
      setSearch("");
    }
  }, [open, screenSharePolicyMode]);

  // Deduplicate and filter non-hosts
  const nonHosts = React.useMemo(() => {
    const map = new Map<string, typeof participants[0]>();
    for (const p of participants) {
      const pId = p.userId || p.id;
      if (
        p.role !== "host" &&
        p.role !== "co-host" &&
        p.id !== currentUser.id &&
        p.userId !== currentUser.userId &&
        pId
      ) {
        if (!map.has(pId)) {
          map.set(pId, p);
        }
      }
    }
    return Array.from(map.values());
  }, [participants, currentUser.id, currentUser.userId]);

  const filteredParticipants = nonHosts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (localMode !== "EVERYONE" && screenSharePolicyMode === "EVERYONE") {
      // Prompt confirmation
      setShowConfirm(true);
      return;
    }
    commitChanges(false);
  };

  const commitChanges = (stopActive: boolean) => {
    setScreenSharePolicy(localMode, stopActive);
    onOpenChange(false);
  };

  if (showConfirm) {
    return (
      <Modal
        isOpen={open}
        onClose={() => onOpenChange(false)}
        className="sm:max-w-[425px] bg-[var(--mt-bg-elevated)] text-[var(--mt-text)] border-[var(--mt-border)] p-0 flex flex-col overflow-hidden"
      >
        <div className="px-6 pt-6 pb-2 shrink-0">
          <h2 className="text-lg font-semibold">Change screen sharing permissions</h2>
        </div>
        <div className="px-6 py-4 space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="stopExisting"
              checked={!stopExisting}
              onChange={() => setStopExisting(false)}
              className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
            />
            <span className="text-sm">Prevent new screen shares only</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="stopExisting"
              checked={stopExisting}
              onChange={() => setStopExisting(true)}
              className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
            />
            <span className="text-sm">Prevent new shares and stop current non-host shares</span>
          </label>
        </div>
        <div className="px-6 py-4 shrink-0 border-t border-[var(--mt-border)] flex justify-end gap-2 bg-[var(--mt-bg-elevated)]">
          <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button onClick={() => commitChanges(stopExisting)}>Apply</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      className="sm:max-w-[450px] bg-[var(--mt-bg-elevated)] text-[var(--mt-text)] border-[var(--mt-border)] p-0 flex flex-col max-h-[85vh] overflow-hidden"
    >
      {/* Fixed Header */}
      <div className="px-6 pt-6 pb-2 shrink-0">
        <h2 className="text-lg font-semibold">Screen sharing permissions</h2>
      </div>
      
      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 meeting-scrollbar">
        <div className="mb-5">
          <h4 className="font-semibold mb-3 text-sm">Who can share?</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="radio"
                name="localMode"
                checked={localMode === "EVERYONE"}
                onChange={() => setLocalMode("EVERYONE")}
                className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
              />
              <span className="text-sm">Everyone</span>
            </label>
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="radio"
                name="localMode"
                checked={localMode === "HOSTS_ONLY"}
                onChange={() => setLocalMode("HOSTS_ONLY")}
                className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
              />
              <span className="text-sm">Host & co-hosts only</span>
            </label>
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="radio"
                name="localMode"
                checked={localMode === "SELECTED"}
                onChange={() => setLocalMode("SELECTED")}
                className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
              />
              <span className="text-sm">Selected participants</span>
            </label>
          </div>
        </div>

        {localMode === "SELECTED" && (
          <div className="mb-5 pl-4 border-l-2 border-[var(--mt-border)]">
            <h4 className="font-medium text-xs uppercase tracking-wider text-[var(--mt-text-muted)] mb-2">
              Selected participants
            </h4>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--mt-text-muted)]" />
              <Input
                placeholder="Search participants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[var(--mt-bg)] border-[var(--mt-border)] text-sm h-9"
              />
            </div>
            <div className="max-h-[170px] overflow-y-auto space-y-2 pr-1 meeting-scrollbar">
              {filteredParticipants.map(p => {
                const targetParticipantId = p.id;
                const isAllowed =
                  participantScreenSharePermissions[targetParticipantId] === 'ALLOW' ||
                  (p.userId ? participantScreenSharePermissions[p.userId] === 'ALLOW' : false);

                return (
                  <label
                    key={targetParticipantId}
                    className="flex items-center space-x-2.5 py-1 px-1.5 rounded hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isAllowed}
                      onChange={(e) => {
                        setParticipantScreenSharePermission(
                          targetParticipantId,
                          e.target.checked ? 'ALLOW' : 'DEFAULT'
                        );
                      }}
                      className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)] rounded focus:ring-brand-green"
                    />
                    <span className="text-sm truncate">{p.name}</span>
                  </label>
                );
              })}
              {filteredParticipants.length === 0 && (
                <div className="text-sm text-center text-[var(--mt-text-muted)] py-3">
                  No matching participants
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--mt-border)] pb-2">
          <Button
            variant="destructive"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => stopAllParticipantScreenShares()}
          >
            <ShieldAlert className="w-4 h-4" />
            Stop all non-host screen shares
          </Button>
        </div>
      </div>

      {/* Sticky Fixed Footer */}
      <div className="px-6 py-4 shrink-0 border-t border-[var(--mt-border)] flex justify-end gap-2 bg-[var(--mt-bg-elevated)]">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </Modal>
  );
}
