"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus, Clock, Users, Copy, CalendarDays,
  ChevronLeft, ChevronRight, Play, Trash2
} from "lucide-react";
import { MOCK_SESSIONS } from "@/lib/mock/schedule";
import { toast } from "sonner";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dates = [4, 5, 6, 7, 8, 9, 10];
const today = 5; // Simulating Tuesday, May 5, 2026

export default function SchedulePage() {
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const upcomingSessions = sessions.filter(s => s.status === "upcoming" || s.status === "live");

  const cancelSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    toast.success("Meeting canceled successfully.");
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Schedule</h1>
          <p className="text-text-muted mt-1">Plan and manage your upcoming meetings and webinars.</p>
        </div>
        <Link href="/dashboard/schedule/new">
          <Button className="h-11 rounded-xl px-5 bg-brand-green hover:bg-[#287854] shadow-[0_6px_20px_rgba(32,116,80,0.2)] transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Session
          </Button>
        </Link>
      </div>

      {/* Calendar Week Picker */}
      <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-blue" />
              <h2 className="text-lg font-bold text-text-primary">May 2026</h2>
            </div>
            <div className="flex items-center gap-1">
              <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/[0.04] text-text-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Button size="sm" variant="outline" className="h-8 rounded-lg px-3 text-xs font-semibold">Today</Button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/[0.04] text-text-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => (
              <div
                key={i}
                className={`flex flex-col items-center py-4 cursor-pointer transition-all ${dates[i] === today
                    ? "bg-brand-green/10"
                    : "hover:bg-black/[0.02]"
                  }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{day}</span>
                <span className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${dates[i] === today
                    ? "bg-brand-green text-white shadow-sm"
                    : "text-text-primary hover:bg-black/[0.04]"
                  }`}>
                  {dates[i]}
                </span>
                {dates[i] === today && (
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-brand-green" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary">Upcoming Sessions</h2>
          <span className="text-sm text-text-muted">{upcomingSessions.length} total</span>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {upcomingSessions.map((session, i) => {
            const startDate = new Date(session.startTime);
            const timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, type: "spring" as const, stiffness: 300, damping: 24 }}
              >
                <Card className={`rounded-xl border-border/60 bg-surface overflow-hidden border-l-4 ${session.mode === 'webinar' ? 'border-l-brand-blue' : 'border-l-brand-green'} hover:shadow-md transition-all group`}>
                  <CardContent className="p-0">
                    <div className="flex items-center p-4 gap-4">
                      {/* Time */}
                      <div className="w-24 shrink-0 text-center">
                        <span className="text-sm font-bold text-text-primary">{timeString.split(' ')[0]}</span>
                        <br />
                        <span className="text-[11px] font-semibold text-text-muted">{timeString.split(' ')[1]}</span>
                        <div className="text-[10px] text-text-muted mt-1 uppercase">
                          {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/dashboard/schedule/${session.id}`} className="hover:underline">
                          <h3 className="text-[15px] font-semibold text-text-primary truncate">{session.title}</h3>
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-black/5 text-[10px] font-bold uppercase tracking-wider">
                            {session.mode}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-border-strong" />
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {session.timezone}</span>
                          <span className="w-1 h-1 rounded-full bg-border-strong" />
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {session.mode === 'webinar' ? `${session.registrationCount || 0} Registered` : `${session.inviteCount || 0} Invited`}
                          </span>
                        </div>
                      </div>

                      {/* Actionss */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/[0.04] text-text-muted transition-colors" title="Copy link">
                          <Copy className="h-4 w-4" />
                        </button>
                        <Link href={`/dashboard/schedule/${session.id}`}>
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/[0.04] text-text-muted transition-colors" title="Details">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </Link>
                        <button 
                          onClick={() => cancelSession(session.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-danger/10 text-danger transition-colors" title="Cancel Meeting">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Button size="sm" className="h-8 rounded-lg bg-brand-green hover:bg-[#287854] text-xs font-semibold px-3">
                          <Play className="h-3.5 w-3.5 mr-1" /> Join
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}

          {upcomingSessions.length === 0 && (
            <div className="text-center py-10 bg-surface border border-border/60 rounded-xl">
              <CalendarDays className="h-10 w-10 text-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-text-primary font-semibold">No upcoming sessions</p>
              <p className="text-sm text-text-muted mt-1">Schedule a new meeting or webinar.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
