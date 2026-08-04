"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Radio, Plus, Trash2, StopCircle, RefreshCw } from "lucide-react";
import { useMeeting } from "@/lib/meeting-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export default function StreamingPanel() {
  const { meetingInfo, currentUser } = useMeeting();
  const [rtmpUrls, setRtmpUrls] = useState<string[]>([""]);
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStreams = useCallback(async () => {
    if (!meetingInfo?.roomSlug || currentUser?.role !== 'host') return;
    try {
      const streams = await apiClient.streaming.getStreams(meetingInfo.roomSlug);
      setActiveStreams(streams.filter(s => s.status === 'live' || s.status === 'processing'));
    } catch (err) {
      console.error("Failed to fetch streams", err);
    } finally {
      setIsLoading(false);
    }
  }, [meetingInfo, currentUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStreams();
    // Poll every 10 seconds to update status
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  const addUrlField = () => {
    if (rtmpUrls.length >= 5) {
      toast.error("Maximum 5 simultaneous streams allowed.");
      return;
    }
    setRtmpUrls([...rtmpUrls, ""]);
  };

  const removeUrlField = (index: number) => {
    setRtmpUrls(rtmpUrls.filter((_, i) => i !== index));
  };

  const handleUrlChange = (index: number, val: string) => {
    const newUrls = [...rtmpUrls];
    newUrls[index] = val;
    setRtmpUrls(newUrls);
  };

  const handleStartStream = async () => {
    const validUrls = rtmpUrls.filter(u => u.trim().length > 0);
    if (validUrls.length === 0) {
      toast.error("Please enter at least one valid RTMP URL.");
      return;
    }

    try {
      setIsStarting(true);
      await apiClient.streaming.startStream({
        roomId: meetingInfo!.roomSlug,
        rtmpUrls: validUrls
      });
      toast.success("Streaming process started! It may take a minute to go live.");
      setRtmpUrls([""]); // Reset form
      fetchStreams();
    } catch (err: any) {
      toast.error(err.message || "Failed to start streaming");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopStream = async (streamId: string) => {
    try {
      await apiClient.streaming.stopStream(streamId);
      toast.success("Stop signal sent to stream.");
      fetchStreams();
    } catch (err: any) {
      toast.error(err.message || "Failed to stop stream");
    }
  };

  if (currentUser?.role !== 'host') {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="p-4 border-b border-border/40 flex items-center gap-2">
          <Radio className="w-5 h-5 text-brand-green" />
          <h2 className="text-lg font-bold text-text-primary">Live Streaming</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-text-muted">Only the meeting host can manage live streams.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-brand-green" />
          <h2 className="text-lg font-bold text-text-primary">Live Streaming</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchStreams} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 text-text-muted ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Active Streams Section */}
        {activeStreams.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Broadcasts</h3>
            {activeStreams.map(stream => (
              <div key={stream.id} className="p-4 rounded-xl border border-brand-green/30 bg-brand-green/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      {stream.status === 'live' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${stream.status === 'processing' ? 'bg-amber-400' : 'bg-red-500'}`}></span>
                    </span>
                    <span className="text-sm font-bold text-text-primary capitalize">{stream.status}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => handleStopStream(stream.id)}
                  >
                    <StopCircle className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                </div>
                <div className="text-xs text-text-muted break-all">
                  <p>Broadcasting to {stream.rtmpUrls.length} destination(s)</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Stream Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Start New Broadcast</h3>
            <Button variant="ghost" size="sm" onClick={addUrlField} className="h-7 text-brand-green hover:bg-brand-green/10 px-2">
              <Plus className="w-3 h-3 mr-1" /> Add Destination
            </Button>
          </div>

          <div className="space-y-3">
            {rtmpUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input 
                  placeholder="rtmp://a.rtmp.youtube.com/live2/YOUR_KEY"
                  value={url}
                  onChange={(e) => handleUrlChange(i, e.target.value)}
                  className="bg-black/[0.02]"
                />
                {rtmpUrls.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeUrlField(i)} className="shrink-0 text-red-400 hover:text-red-500 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          <p className="text-xs text-text-muted leading-relaxed">
            Enter the RTMP URLs and Stream Keys for platforms like YouTube, Facebook, or Twitch. 
            <strong> Ensure your stream key is included in the URL.</strong>
          </p>

          <Button 
            className="w-full bg-brand-green hover:bg-[#287854] text-white" 
            onClick={handleStartStream}
            disabled={isStarting}
          >
            {isStarting ? "Initializing Broadcast..." : "Go Live"}
          </Button>
        </div>
      </div>
    </div>
  );
}
