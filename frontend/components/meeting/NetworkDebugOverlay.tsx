import React, { useEffect, useState } from 'react';
import { useMeeting } from '../../lib/meeting-context';
import type { NetworkDebugSnapshot } from '../../lib/webrtc';

export const NetworkDebugOverlay = () => {
  const { webrtcClientRef } = useMeeting();
  const [snapshot, setSnapshot] = useState<NetworkDebugSnapshot | null>(null);

  useEffect(() => {
    // Only show if QA flag is enabled AND url param is present
    const isQADiagnostics = process.env.NEXT_PUBLIC_QA_DIAGNOSTICS === 'true';
    const params = new URLSearchParams(window.location.search);
    const hasDebugParam = params.get('debugNetwork') === 'true';

    if (!isQADiagnostics || !hasDebugParam) return;

    if (webrtcClientRef?.current) {
      webrtcClientRef.current.onNetworkDebugSnapshot = (data: NetworkDebugSnapshot) => {
        setSnapshot(data);
      };
    }
  }, [webrtcClientRef]);

  if (!snapshot) return null;

  const labelColors: Record<string, string> = {
    good: 'bg-green-500/20 text-green-400 border-green-500/50',
    unstable_network: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    poor_network: 'bg-red-500/20 text-red-400 border-red-500/50',
    reconnecting: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    connecting_to_media_server: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    device_performance_issue: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    remote_receiver_issue: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    screen_share_performance_issue: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
  };

  const colorClass = labelColors[snapshot.label] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-[var(--mt-bg-elevated)] border border-[var(--mt-border)] rounded-lg shadow-2xl p-4 text-xs font-mono text-[var(--mt-text)] overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold uppercase tracking-wider text-[var(--mt-text-muted)] text-[10px] flex items-center gap-2">
          Network Diagnostics
          <button 
            onClick={() => navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))}
            className="px-1.5 py-0.5 bg-[var(--mt-bg-control)] hover:bg-[var(--mt-bg-hover)] rounded border border-[var(--mt-border)] transition-colors"
            title="Export JSON snapshot to clipboard"
          >
            Copy
          </button>
        </h3>
        <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${colorClass}`}>
          {snapshot.label.replace(/_/g, ' ')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">RTT (ms)</span>
          <span className="font-semibold">{Math.round(snapshot.rtt)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">Jitter (ms)</span>
          <span className="font-semibold">{Math.round(snapshot.jitter)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">Packet Loss</span>
          <span className="font-semibold">{snapshot.packetLoss.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">ICE State</span>
          <span className="font-semibold text-blue-400">{snapshot.iceState}</span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">Send Bitrate</span>
          <span className="font-semibold">{(snapshot.sendBitrate / 1000).toFixed(1)} kbps</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">Recv Bitrate</span>
          <span className="font-semibold">{(snapshot.recvBitrate / 1000).toFixed(1)} kbps</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">Avail Out Bitrate</span>
          <span className="font-semibold">{snapshot.availableOutgoingBitrate ? (snapshot.availableOutgoingBitrate / 1000).toFixed(1) + ' kbps' : 'N/A'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">FPS</span>
          <span className="font-semibold">{Math.round(snapshot.fps)}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">Frames Dropped</span>
          <span className="font-semibold text-red-400">{snapshot.framesDropped}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--mt-text-muted)]">Reconnects</span>
          <span className="font-semibold">{snapshot.reconnectCount}</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-[var(--mt-border)]">
        <span className="text-[10px] text-[var(--mt-text-muted)] uppercase tracking-wider block mb-1">Root Cause Diagnosis</span>
        <span className="font-semibold text-[11px] text-yellow-400">{snapshot.diagnosticType.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
};
