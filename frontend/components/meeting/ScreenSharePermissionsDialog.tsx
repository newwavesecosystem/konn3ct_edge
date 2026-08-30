import React, { useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ShieldAlert, Info } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreenSharePermissionsDialog({ open, onOpenChange }: Props) {
  const {
    screenSharePolicyMode,
    setScreenSharePolicy,
    stopAllParticipantScreenShares,
  } = useMeeting();

  const [localMode, setLocalMode] = useState<'EVERYONE' | 'HOSTS_ONLY'>(
    screenSharePolicyMode === "HOSTS_ONLY" ? "HOSTS_ONLY" : "EVERYONE"
  );

  // Sync when opened
  React.useEffect(() => {
    if (open) {
      setLocalMode(screenSharePolicyMode === "HOSTS_ONLY" ? "HOSTS_ONLY" : "EVERYONE");
    }
  }, [open, screenSharePolicyMode]);

  const handleSave = () => {
    setScreenSharePolicy(localMode, false);
    onOpenChange(false);
    toast.success(
      localMode === "EVERYONE" 
        ? "Screen sharing is now enabled for all participants" 
        : "Screen sharing is now restricted to hosts & co-hosts"
    );
  };

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
            <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="localMode"
                checked={localMode === "EVERYONE"}
                onChange={() => setLocalMode("EVERYONE")}
                className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)] focus:ring-brand-green"
              />
              <div>
                <span className="text-sm font-medium">Everyone</span>
                <p className="text-xs text-[var(--mt-text-muted)]">All participants in the meeting can share their screen</p>
              </div>
            </label>
            <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="localMode"
                checked={localMode === "HOSTS_ONLY"}
                onChange={() => setLocalMode("HOSTS_ONLY")}
                className="w-4 h-4 text-brand-green bg-transparent border-[var(--mt-border)] focus:ring-brand-green"
              />
              <div>
                <span className="text-sm font-medium">Host & co-hosts only</span>
                <p className="text-xs text-[var(--mt-text-muted)]">Only hosts and co-hosts can share their screen</p>
              </div>
            </label>
          </div>
        </div>

        <div className="p-3 bg-[var(--mt-bg-hover)]/40 border border-[var(--mt-border)] rounded-lg text-xs flex items-start gap-2.5 text-[var(--mt-text-secondary)] mb-4">
          <Info className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
          <span>
            <strong>Individual permissions:</strong> You can still allow or block screen sharing for specific attendees at any time from the <strong>Participants</strong> panel (click the <strong>...</strong> menu on their name).
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--mt-border)] pb-2">
          <Button
            variant="destructive"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              stopAllParticipantScreenShares();
              toast.info("Stopped active screen shares for all non-hosts");
            }}
          >
            <ShieldAlert className="w-4 h-4" />
            Stop all non-host/co-host screen shares
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
