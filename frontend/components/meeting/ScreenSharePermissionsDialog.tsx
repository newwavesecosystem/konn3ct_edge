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
    }
  }, [open, screenSharePolicyMode]);

  const nonHosts = participants.filter(p => p.role !== "host" && p.role !== "co-host" && p.id !== currentUser.id);
  const filteredParticipants = nonHosts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

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
      <Modal isOpen={open} onClose={() => onOpenChange(false)} className="sm:max-w-[425px] bg-[var(--mt-bg-elevated)] text-[var(--mt-text)] border-[var(--mt-border)]">
        <div>
          <h2 className="text-lg font-semibold mb-4">Change screen sharing permissions</h2>
          <div className="py-4 space-y-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="stopExisting"
                checked={!stopExisting}
                onChange={() => setStopExisting(false)}
                className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
              />
              <span>Prevent new screen shares only</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="stopExisting"
                checked={stopExisting}
                onChange={() => setStopExisting(true)}
                className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
              />
              <span>Prevent new shares and stop current non-host shares</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={() => commitChanges(stopExisting)}>Apply</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} className="sm:max-w-[450px] bg-[var(--mt-bg-elevated)] text-[var(--mt-text)] border-[var(--mt-border)] flex flex-col max-h-[85vh]">
      <div>
        <h2 className="text-lg font-semibold mb-4">Screen sharing permissions</h2>
        
        <div className="flex-1 overflow-y-auto pr-2 py-2">
          <div className="mb-6">
            <h4 className="font-semibold mb-3">Who can share?</h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="localMode"
                  checked={localMode === "EVERYONE"}
                  onChange={() => setLocalMode("EVERYONE")}
                  className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
                />
                <span>Everyone</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="localMode"
                  checked={localMode === "HOSTS_ONLY"}
                  onChange={() => setLocalMode("HOSTS_ONLY")}
                  className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
                />
                <span>Host & co-hosts only</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="localMode"
                  checked={localMode === "SELECTED"}
                  onChange={() => setLocalMode("SELECTED")}
                  className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)]"
                />
                <span>Selected participants</span>
              </label>
            </div>
          </div>

          {localMode === "SELECTED" && (
            <div className="mb-6 pl-6 border-l-2 border-[var(--mt-border)]">
              <h4 className="font-medium text-sm text-[var(--mt-text-muted)] mb-2">Selected participants</h4>
              <div className="relative mb-3">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-[var(--mt-text-muted)]" />
                <Input
                  placeholder="Search participants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 bg-[var(--mt-bg)] border-[var(--mt-border)]"
                />
              </div>
              <div className="max-h-[150px] overflow-y-auto space-y-3 mt-4">
                {filteredParticipants.map(p => (
                  <label key={p.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={participantScreenSharePermissions[p.id] === 'ALLOW'}
                      onChange={(e) => {
                        setParticipantScreenSharePermission(p.userId, e.target.checked ? 'ALLOW' : 'DEFAULT');
                      }}
                      className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)] rounded"
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
                {filteredParticipants.length === 0 && (
                  <div className="text-sm text-center text-[var(--mt-text-muted)] mt-2">No matching participants</div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-[var(--mt-border)]">
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

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}
