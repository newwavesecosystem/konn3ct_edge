"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiClient, MeetingSummary, Transcription, Room } from "@/lib/api-client";
import { ArrowLeft, Brain, FileText, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function MeetingIntelligencePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId) return;

    Promise.all([
      apiClient.rooms.getAll().then(rooms => rooms.find(r => r.id === roomId)),
      apiClient.ai.getSummary(roomId).catch(() => null),
      apiClient.ai.getTranscription(roomId).catch(() => [])
    ])
    .then(([r, s, t]) => {
      setRoom(r || null);
      setSummary(s);
      setTranscriptions(t || []);
    })
    .catch((err) => {
      console.error(err);
      setError("Failed to load meeting intelligence.");
    })
    .finally(() => {
      setIsLoading(false);
    });
  }, [roomId]);

  let parsedActionItems: string[] = [];
  try {
    if (summary?.actionItems) {
      parsedActionItems = JSON.parse(summary.actionItems);
    }
  } catch (e) {}

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard')} className="h-10 w-10 p-0 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {room?.name || "Meeting Details"}
          </h1>
          <p className="text-text-muted">Post-Meeting Intelligence</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-500 p-4 rounded-xl border border-red-500/20">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: AI Summary & Actions */}
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-2xl border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] bg-surface">
            <CardHeader className="border-b border-border p-6 flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Summary</CardTitle>
                <p className="text-sm text-text-muted">Generated automatically by AI</p>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {summary ? (
                <div className="prose prose-invert max-w-none text-text-primary">
                  <p className="whitespace-pre-wrap leading-relaxed">{summary.summary}</p>
                </div>
              ) : (
                <div className="text-center py-10 text-text-muted">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No summary available for this meeting.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] bg-surface">
            <CardHeader className="border-b border-border p-6 flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Action Items</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {parsedActionItems.length > 0 ? (
                <ul className="space-y-3">
                  {parsedActionItems.map((item, i) => (
                    <motion.li 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={i} 
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="mt-0.5 min-w-[20px]">
                        <input type="checkbox" className="w-4 h-4 rounded border-border-strong text-brand-green focus:ring-brand-green" />
                      </div>
                      <span className="text-text-primary leading-snug">{item}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6 text-text-muted">
                  No action items identified.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Transcript */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] bg-surface h-full min-h-[500px] flex flex-col">
            <CardHeader className="border-b border-border p-6 flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <FileText className="w-5 h-5" />
              </div>
              <CardTitle className="text-xl">Full Transcript</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
              {transcriptions.length > 0 ? (
                <div className="divide-y divide-border">
                  {transcriptions.map((t, i) => (
                    <div key={i} className="p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm">
                      <p className="text-text-primary whitespace-pre-wrap">{t.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-text-muted">
                  No transcript available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
