"use client";

import React, { useState, useEffect } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { Copy, Download, X, Bug, RefreshCw, Trash2, ShieldAlert, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function QADiagnosticsOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [isQAEnabled, setIsQAEnabled] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>({});
  const [issueNote, setIssueNote] = useState("");
  const [snapshots, setSnapshots] = useState<any[]>([]);
  
  const meeting = useMeeting();

  useEffect(() => {
    // Only enable if environment variable is true
    if (process.env.NEXT_PUBLIC_QA_DIAGNOSTICS === "true") {
      setIsQAEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeviceInfo({
        userAgent: window.navigator.userAgent,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        isMobile: /Mobi|Android/i.test(window.navigator.userAgent),
        networkType: (navigator as any).connection?.effectiveType || "unknown"
      });
    }
  }, [isOpen]);

  if (!isQAEnabled) return null;

  const truncateId = (id?: string) => id ? `${id.substring(0, 6)}...${id.substring(id.length - 4)}` : "unknown";

  const getDiagnostics = () => {
    const webrtcInfo = (meeting.webrtcClientRef?.current?.getDiagnostics?.() || {}) as any;
    
    return {
      timestamp: new Date().toISOString(),
      issueNote: issueNote || undefined,
      session: {
        roomId: meeting.meetingInfo?.roomSlug || "unknown",
        userId: truncateId(meeting.currentUser?.id),
        role: meeting.currentUser?.role || "unknown",
        isBot: meeting.currentUser?.role === 'bot',
        status: meeting.webrtcStatus
      },
      browserDevice: deviceInfo,
      media: {
        micEnabled: !meeting.isMuted,
        cameraEnabled: meeting.isCameraOn,
        screenShareActive: meeting.isScreenSharing,
        selectedAudioInput: meeting.selectedDevices?.audioInput,
        selectedVideoInput: meeting.selectedDevices?.videoInput,
        audioTrackState: webrtcInfo.audioTrack || "unavailable",
        audioOnlyMode: webrtcInfo.isAudioOnlyMode || false,
        videoProducerPaused: webrtcInfo.producers?.video?.paused ?? false,
        videoProducerClosed: webrtcInfo.producers?.video?.closed ?? true,
      },
      participants: meeting.participants.map(p => ({
        id: truncateId(p.id),
        isCameraOn: p.isCameraOn,
        audioOnlyMode: p.audioOnlyMode,
        networkQuality: p.networkQuality
      })),
      webrtc: {
        wsState: webrtcInfo.wsState,
        sendTransport: webrtcInfo.sendTransportState,
        recvTransport: webrtcInfo.recvTransportState,
        reconnectAttempts: webrtcInfo.reconnectAttempts,
        producers: webrtcInfo.producers,
        consumers: webrtcInfo.consumersCount
      },
      cameraFallback: webrtcInfo.camera,
      virtualBackground: {
        mode: meeting.vbMode || webrtcInfo.videoProcessor?.mode || "none",
        isActive: webrtcInfo.videoProcessor?.active,
        degradations: webrtcInfo.videoProcessor?.degradations || 0,
        lastDegradationReason: webrtcInfo.videoProcessor?.lastDegradation || "none",
        hasFallenBack: webrtcInfo.videoProcessor?.fallbackMode || false
      },
      layout: {
        mode: meeting.layoutMode,
        eCinemaActive: !!meeting.eCinemaLink,
        sidePanel: meeting.activePanel,
        horizontalOverflow: deviceInfo.scrollWidth > deviceInfo.viewportWidth
      },
      recording: {
        active: meeting.isRecording,
        duration: meeting.meetingDuration
      },
      paystack: {
        mockMode: process.env.NEXT_PUBLIC_PAYSTACK_MOCK_MODE || "false"
      }
    };
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert("Diagnostics copied to clipboard");
  };

  const downloadJSON = (data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const markIssue = () => {
    const snap = getDiagnostics();
    setSnapshots(prev => [...prev, snap]);
    setIssueNote("");
    alert("Issue marked! You can now download the snapshot.");
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-24 right-4 z-[9999]">
        <Button 
          onClick={() => setIsOpen(true)}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12 shadow-lg flex items-center justify-center p-0 border-2 border-white/20"
          title="QA Diagnostics"
        >
          <Bug className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  const currentDiagnostics = getDiagnostics();

  return (
    <div className="fixed bottom-24 right-4 z-[9999] w-80 max-h-[80vh] bg-black/90 border border-red-500/50 rounded-xl shadow-2xl flex flex-col font-mono text-xs text-green-400">
      {/* Header */}
      <div className="bg-red-500/20 border-b border-red-500/50 p-2 flex items-center justify-between shrink-0 text-white">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span className="font-bold">QA Diagnostics</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <h3 className="text-white font-bold border-b border-white/20 mb-1">Session</h3>
          <div>User: {currentDiagnostics.session.userId} ({currentDiagnostics.session.role})</div>
          <div>Status: {currentDiagnostics.session.status}</div>
        </div>

        <div>
          <h3 className="text-white font-bold border-b border-white/20 mb-1">WebRTC & VB</h3>
          <div>Producers: A:{currentDiagnostics.webrtc.producers?.audio?1:0} V:{currentDiagnostics.webrtc.producers?.video?1:0} S:{currentDiagnostics.webrtc.producers?.screen?1:0}</div>
          <div>Consumers: {currentDiagnostics.webrtc.consumers}</div>
          <div>VB Mode: {currentDiagnostics.virtualBackground.mode}</div>
          {currentDiagnostics.virtualBackground.degradations > 0 && (
            <div className="text-red-400">VB Degraded: {currentDiagnostics.virtualBackground.lastDegradationReason}</div>
          )}
        </div>

        <div>
          <h3 className="text-white font-bold border-b border-white/20 mb-1">Layout & Device</h3>
          <div>Size: {currentDiagnostics.browserDevice.viewportWidth}x{currentDiagnostics.browserDevice.viewportHeight}</div>
          <div className={currentDiagnostics.layout.horizontalOverflow ? "text-red-400 font-bold" : ""}>
            Overflow: {currentDiagnostics.layout.horizontalOverflow ? "YES" : "NO"}
          </div>
          <div>Layout: {currentDiagnostics.layout.mode}</div>
        </div>

        {/* Issue Marker */}
        <div className="mt-4 border border-yellow-500/50 rounded bg-yellow-500/10 p-2">
          <h3 className="text-yellow-400 font-bold flex items-center gap-1 mb-2"><Flag className="w-3 h-3"/> Mark Issue Snapshot</h3>
          <input 
            type="text" 
            placeholder="Short note (optional)"
            className="w-full bg-black border border-white/20 rounded p-1 mb-2 text-white placeholder:text-white/30"
            value={issueNote}
            onChange={e => setIssueNote(e.target.value)}
          />
          <Button onClick={markIssue} className="w-full h-8 text-xs bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
            Mark Issue Now
          </Button>
          
          {snapshots.length > 0 && (
            <div className="mt-2 text-yellow-300">
              {snapshots.length} snapshot(s) captured!
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-white/20 p-2 grid grid-cols-2 gap-2 shrink-0 bg-black">
        <Button onClick={() => copyToClipboard(snapshots.length > 0 ? snapshots : currentDiagnostics)} variant="outline" className="h-8 text-xs bg-white/5 border-white/20 hover:bg-white/10 hover:text-white">
          <Copy className="w-3 h-3 mr-1" /> Copy JSON
        </Button>
        <Button onClick={() => downloadJSON(snapshots.length > 0 ? snapshots : currentDiagnostics)} variant="outline" className="h-8 text-xs bg-white/5 border-white/20 hover:bg-white/10 hover:text-white">
          <Download className="w-3 h-3 mr-1" /> Download
        </Button>
      </div>
    </div>
  );
}
