"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, MessageSquare, FileText, Download, Share2, Lock } from "lucide-react";

export default function RecordingPlaybackPage() {
  const params = useParams();
  const router = useRouter();
  const recordingId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    recording: any;
    chatMessages: any[];
    summary: any;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "summary">("chat");

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [fetchingPlaybackUrl, setFetchingPlaybackUrl] = useState(false);

  useEffect(() => {
    fetch(`/api/recordings/${recordingId}/details`)
      .then(res => res.json())
      .then(resData => {
        if (!resData.error) {
          setData(resData);
          if (resData.recording && resData.recording.status === 'completed') {
            fetchPlaybackUrl();
          }
        } else {
          setPlaybackError(resData.error);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load recording details", err);
        setLoading(false);
      });
  }, [recordingId]);

  const fetchPlaybackUrl = async () => {
    setFetchingPlaybackUrl(true);
    setPlaybackError(null);
    try {
      const res = await fetch(`/api/recordings/${recordingId}/play`);
      const data = await res.json();
      if (res.ok) {
        setPlaybackUrl(data.playbackUrl);
      } else {
        setPlaybackError(data.error || 'Failed to authorize playback.');
      }
    } catch (error) {
      setPlaybackError('Network error connecting to playback service.');
    } finally {
      setFetchingPlaybackUrl(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading recording details...</div>;
  }

  if (!data || !data.recording) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-400">Recording Not Found</h2>
        <Button onClick={() => router.push('/dashboard/recordings')} className="mt-4">Back to Recordings</Button>
      </div>
    );
  }

  const { recording, chatMessages, summary } = data;

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-80px)] pb-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="px-2" onClick={() => router.push('/dashboard/recordings')}>
            <ArrowLeft className="w-5 h-5 text-text-muted" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{recording.title}</h1>
            <p className="text-sm text-text-muted">
              Recorded on {new Date(recording.createdAt).toLocaleDateString()}
              {recording.room && ` in ${recording.room.name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border/60">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button variant="outline" className="border-border/60">
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface rounded-2xl border border-border/60 overflow-hidden shadow-sm">
          <div className="flex-1 bg-black flex flex-col items-center justify-center relative">
            {playbackError ? (
              <div className="text-center p-6 text-white max-w-md">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Playback Unavailable</h3>
                <p className="text-text-muted text-sm mb-6">{playbackError}</p>
                {playbackError.includes('Payment') && (
                  <Button className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white shadow-lg">
                    Purchase Access
                  </Button>
                )}
                {!playbackError.includes('Payment') && (
                   <Button onClick={fetchPlaybackUrl} className="w-full">
                     Retry Access
                   </Button>
                )}
              </div>
            ) : fetchingPlaybackUrl ? (
               <div className="text-text-muted text-sm flex items-center gap-2">
                 <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                 Authorizing Playback...
               </div>
            ) : playbackUrl ? (
              <video
                controls
                src={playbackUrl}
                className="w-full h-full max-h-full object-contain"
                poster={`https://picsum.photos/seed/${recording.id}/1920/1080`}
                onError={() => {
                  setPlaybackError("Session expired or playback failed. Please request access again.");
                  setPlaybackUrl(null);
                }}
              />
            ) : recording.status !== 'completed' ? (
              <div className="text-text-muted text-sm">Video is still processing...</div>
            ) : null}
          </div>
        </div>

        {/* Sidebar (Chat / Summary) */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col bg-surface rounded-2xl border border-border/60 overflow-hidden">
          {/* Tabs */}
          <div className="flex p-2 gap-1 border-b border-border/60 shrink-0 bg-black/[0.02]">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === "chat" 
                  ? "bg-white text-brand-blue shadow-sm" 
                  : "text-text-muted hover:bg-black/5"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat Log
            </button>
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === "summary" 
                  ? "bg-white text-brand-blue shadow-sm" 
                  : "text-text-muted hover:bg-black/5"
              }`}
            >
              <FileText className="w-4 h-4" />
              AI Summary
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "chat" && (
              <div className="space-y-4">
                {chatMessages && chatMessages.length > 0 ? (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary">{msg.senderName}</span>
                        <span className="text-[10px] text-text-faint">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary bg-black/[0.03] p-2 rounded-xl rounded-tl-none">
                        {msg.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-text-muted mt-10 text-sm">
                    No chat messages found for this recording.
                  </div>
                )}
              </div>
            )}

            {activeTab === "summary" && (
              <div className="space-y-6">
                {summary ? (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-text-primary">Executive Summary</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {summary.content}
                      </p>
                    </div>
                    {summary.actionItems && summary.actionItems.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-text-primary">Action Items</h3>
                        <ul className="space-y-2">
                          {(summary.actionItems as any[]).map((item: any, i: number) => (
                            <li key={i} className="flex gap-2 text-sm bg-brand-blue/5 p-3 rounded-xl border border-brand-blue/10">
                              <span className="text-brand-blue mt-0.5">•</span>
                              <div>
                                <p className="font-medium text-brand-blue">{item.assignee || "Unassigned"}</p>
                                <p className="text-text-secondary mt-0.5">{item.task}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-text-muted mt-10 text-sm">
                    AI Summary is not available for this meeting.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
