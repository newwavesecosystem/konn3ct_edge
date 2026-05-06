"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { 
  ArrowLeft, Calendar as CalendarIcon, Clock, Users, 
  Video, MonitorPlay, Copy, Mail, CalendarPlus, Settings,
  Link as LinkIcon, Trash2, Edit
} from "lucide-react";
import { MOCK_SESSIONS } from "@/lib/mock/schedule";

export default function ScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const session = useMemo(() => {
    return MOCK_SESSIONS.find(s => s.id === sessionId) || MOCK_SESSIONS[0]; // fallback to first if not found for mock
  }, [sessionId]);

  const startDate = new Date(session.startTime);
  const endDate = new Date(session.endTime);
  const isWebinar = session.mode === "webinar";

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/schedule">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <ArrowLeft className="h-5 w-5 text-text-muted" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">{session.title}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                session.status === 'live' ? 'bg-danger/10 text-danger' :
                session.status === 'upcoming' ? 'bg-brand-green/10 text-brand-green' :
                'bg-black/5 text-text-muted'
              }`}>
                {session.status}
              </span>
            </div>
            <p className="text-text-muted mt-1 flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1">
                {isWebinar ? <MonitorPlay className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                {session.mode}
              </span>
              <span>•</span>
              <span>Room: /{session.roomSlug}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-10 rounded-xl px-4 border-border/60">
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" className="h-10 rounded-xl px-4 border-danger/20 text-danger hover:bg-danger/5 hover:border-danger/30">
            <Trash2 className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border-border/60 bg-surface">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-black/[0.02] border border-border/40">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  isWebinar ? 'bg-brand-blue/10 text-brand-blue' : 'bg-brand-green/10 text-brand-green'
                }`}>
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary">
                    {startDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-text-secondary mt-0.5 font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-muted" />
                    {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    {" - "} 
                    {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    <span className="text-text-muted text-xs">({session.timezone})</span>
                  </p>
                </div>
              </div>

              {session.description && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Description</h4>
                  <p className="text-text-secondary leading-relaxed">{session.description}</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-border/40">
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Room</h4>
                  <p className="font-medium text-text-primary">{session.roomName}</p>
                </div>
                {isWebinar && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Capacity</h4>
                    <p className="font-medium text-text-primary">{session.capacity} attendees</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Invites List (Mock) */}
          <Card className="rounded-2xl border-border/60 bg-surface">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-blue" />
                  {isWebinar ? 'Registered Attendees' : 'Invited Participants'}
                </h3>
                <span className="text-sm text-text-muted">
                  {isWebinar ? session.registrationCount : (session.inviteEmails?.length || session.inviteCount)} total
                </span>
              </div>
              <div className="p-2">
                {session.inviteEmails && session.inviteEmails.length > 0 ? (
                  <div className="space-y-1">
                    {session.inviteEmails.map((email, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-green/10 text-brand-green font-bold text-xs flex items-center justify-center uppercase">
                            {email.substring(0, 2)}
                          </div>
                          <span className="text-sm font-medium text-text-primary">{email}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded">Invited</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-muted">No specific individuals invited yet.</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border/40 bg-black/[0.01]">
                <Button variant="outline" className="w-full border-dashed border-border/80 text-text-secondary h-10 rounded-xl">
                  <Mail className="w-4 h-4 mr-2" /> Add more invites
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Actions */}
        <div className="space-y-6">
          {/* Join / Start Action */}
          <Card className="rounded-2xl border-brand-green/30 bg-brand-green/5 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <CardContent className="p-6 space-y-6 relative z-10">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-extrabold text-text-primary">Ready to join?</h3>
                <p className="text-sm text-text-secondary">Join the room early to prep, or start the session now.</p>
              </div>
              
              <Link href={`/meeting/${session.roomSlug}`} className="block">
                <Button className="w-full h-14 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-lg shadow-brand-green/20 text-base font-bold transition-all">
                  <Video className="w-5 h-5 mr-2" />
                  {session.status === 'upcoming' ? 'Join Early' : 'Enter Room'}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Sharing Links */}
          <Card className="rounded-2xl border-border/60 bg-surface">
            <CardContent className="p-6 space-y-6">
              <h3 className="font-bold text-text-primary border-b border-border/40 pb-3">Share & Add</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Join Link</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/[0.03] border border-border/60 rounded-lg px-3 py-2 text-sm text-text-secondary truncate select-all">
                      {session.joinUrl || `https://konn3ct.io/join/${session.roomSlug}`}
                    </div>
                    <Button variant="outline" size="icon" className="shrink-0 h-9 w-9 rounded-lg border-border/60" title="Copy Link">
                      <Copy className="w-4 h-4 text-text-primary" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button variant="outline" className="w-full h-11 rounded-xl border-border/60 bg-surface hover:bg-black/[0.02] justify-start">
                    <CalendarPlus className="w-4 h-4 mr-3 text-brand-blue" />
                    Download ICS Calendar File
                  </Button>
                  <Button variant="outline" className="w-full h-11 rounded-xl border-border/60 bg-surface hover:bg-black/[0.02] justify-start">
                    <LinkIcon className="w-4 h-4 mr-3 text-text-primary" />
                    Copy Invitation Text
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings Snippet */}
          <div className="px-1">
            <Link href={`/dashboard/rooms`} className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-brand-blue transition-colors">
              <Settings className="w-4 h-4" /> Room settings & defaults
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
