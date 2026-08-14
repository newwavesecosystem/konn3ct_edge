"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import {
  Video, Calendar, Users, Clock,
  ArrowRight, Play, MoreVertical,
  Link2, Copy, CalendarDays, Share2, Globe, Lock, Brain
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { apiClient, DashboardStats, ScheduledMeeting, Room } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [pastRooms, setPastRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{name: string} | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<{id: string, title: string, date: string, duration: string} | null>(null);
  const [accessLevel, setAccessLevel] = useState("anyone");
  const [specificUsers, setSpecificUsers] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const handleShareRecording = (rec: any) => {
    setSelectedRecording(rec);
    setIsShareModalOpen(true);
    setAccessLevel("anyone");
    setSpecificUsers("");
    setGeneratedLink("");
  };

  const handleGenerateLink = () => {
    if (selectedRecording?.id) {
      const link = `${window.location.origin}/recordings/${selectedRecording.id}`;
      setGeneratedLink(link);
    } else {
      const link = `${window.location.origin}/recordings/rec_${Math.random().toString(36).substr(2, 9)}`;
      setGeneratedLink(link);
    }
  };

  const handleCopyPersonalLink = () => {
    if (currentUser) {
      const link = `${window.location.origin}/meeting/${currentUser.name.toLowerCase().replace(/\s+/g, '-')}`;
      navigator.clipboard.writeText(link);
      alert("Personal link copied!"); // using alert for simplicity, could use toast
    }
  };

  const handleStartInstantMeeting = async () => {
    try {
      setIsCreatingRoom(true);
      const room = await apiClient.rooms.create({ name: "Instant Meeting" });
      router.push(`/meeting/${room.slug}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  useEffect(() => {
    Promise.all([
      apiClient.auth.getMe().catch(() => null),
      apiClient.dashboard.getStats().catch(() => null),
      apiClient.scheduling.getUpcoming().catch(() => []),
      apiClient.rooms.getAll().catch(() => [])
    ]).then(([u, s, m, r]) => {
      setCurrentUser(u);
      setStats(s);
      setMeetings(m);
      setPastRooms(r.slice(0, 5)); // Just take the latest 5 rooms for the dashboard
      setIsLoading(false);
    });
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-text-primary">
            Welcome back, {currentUser?.name || "Alex"} 👋
          </h1>
          <p className="text-text-muted mt-1 text-lg">
            Here&apos;s what&apos;s happening with your meetings today.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button onClick={handleCopyPersonalLink} variant="outline" className="flex-1 md:flex-none h-12 rounded-xl px-4 border-border-strong/20 hover:border-brand-blue hover:text-brand-blue transition-colors bg-surface shadow-sm">
            <Link2 className="w-5 h-5 mr-2" />
            Copy Personal Link
          </Button>
          <Button
            disabled={isCreatingRoom}
            onClick={handleStartInstantMeeting}
            className="flex-1 md:flex-none h-12 rounded-xl px-6 bg-brand-green hover:bg-[#287854] shadow-[0_8px_24px_rgba(32,116,80,0.25)] hover:shadow-[0_12px_32px_rgba(32,116,80,0.35)] transition-all">
            <Video className="w-5 h-5 mr-2" />
            {isCreatingRoom ? "Starting..." : "New Meeting"}
          </Button>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {/* Stat Cards */}
        {[
          { title: "Total Rooms", value: stats?.totalRooms || "0", icon: Users, color: "text-brand-blue", bg: "bg-brand-blue/10" },
          { title: "Upcoming Meetings", value: stats?.upcomingMeetings || "0", icon: Calendar, color: "text-brand-green", bg: "bg-brand-green/10" },
          { title: "Recordings", value: stats?.totalRecordings || "0", icon: Play, color: "text-[#CC505C]", bg: "bg-[#CC505C]/10" },
          { title: "Virtual Events", value: "0", icon: Globe, color: "text-amber-500", bg: "bg-amber-500/10" }
        ].map((stat, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="rounded-2xl border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 overflow-hidden relative group h-full">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-muted mb-1">{stat.title}</p>
                    {isLoading ? (
                      <div className="h-9 w-16 bg-black/[0.05] rounded animate-pulse" />
                    ) : (
                      <h3 className="text-3xl font-bold text-text-primary">{stat.value}</h3>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions / Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Today&apos;s Schedule</h2>
            <Button variant="ghost" className="text-brand-green hover:text-brand-green-soft hover:bg-brand-green/10 rounded-lg">
              View Calendar <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>

          <Card className="rounded-2xl border-border bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="p-5 flex justify-center text-text-muted text-sm">Loading schedule...</div>
              ) : meetings.length === 0 ? (
                <div className="p-5 flex justify-center text-text-muted text-sm">No upcoming meetings scheduled.</div>
              ) : meetings.map((meeting, i) => {
                const date = new Date(meeting.startTime);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dotColor = ["bg-brand-blue", "bg-brand-green", "bg-amber-400"][i % 3];

                return (
                  <div key={i} className="flex items-center p-5 hover:bg-black/[0.02] transition-colors group">
                    <div className="flex flex-col items-center justify-center w-20 text-center shrink-0">
                      <span className="text-sm font-bold text-text-primary">{timeStr.split(' ')[0]}</span>
                      <span className="text-xs font-semibold text-text-muted">{timeStr.split(' ')[1]}</span>
                    </div>
                    <div className={`w-1 h-12 rounded-full mx-4 opacity-70 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-text-primary truncate">{meeting.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {meeting.durationMin}m</span>
                        <span className="w-1 h-1 rounded-full bg-border-strong"></span>
                        <span>Scheduled</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="outline" className="rounded-lg h-9">
                        <Copy className="w-4 h-4 mr-2" />
                        Link
                      </Button>
                      <Button onClick={() => router.push(`/meeting/${meeting.roomId}`)} size="sm" className="rounded-lg h-9 bg-brand-green hover:bg-[#287854]">
                        Join
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>

        {/* Right Column: Quick Start & Recent */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          <Card className="rounded-2xl border-none bg-gradient-to-br from-brand-blue to-[#001D5C] text-white overflow-hidden relative shadow-xl">
            <div className="absolute top-[-20%] right-[-10%] w-[200px] h-[200px] rounded-full bg-white/10 blur-[40px] z-0" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[150px] h-[150px] rounded-full bg-brand-green/30 blur-[40px] z-0" />

            <CardContent className="p-6 relative z-10">
              <h3 className="text-lg font-bold mb-2">Instant Meeting</h3>
              <p className="text-white/80 text-sm mb-6">
                Start a new meeting immediately with your personal room link.
              </p>

              <div className="space-y-3">
                <Button
                  disabled={isCreatingRoom}
                  onClick={handleStartInstantMeeting}
                  className="w-full bg-white text-brand-blue hover:bg-gray-100 h-12 rounded-xl font-bold transition-transform active:scale-95">
                  {isCreatingRoom ? "Starting..." : "Start Now"}
                </Button>
                <Button
                  onClick={() => router.push('/dashboard/schedule/new')}
                  variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 h-12 rounded-xl border-t">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Schedule for later
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">Past Meetings Intelligence</h2>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="p-3 text-center text-text-muted text-sm">Loading past meetings...</div>
              ) : pastRooms.length === 0 ? (
                <div className="p-3 text-center text-text-muted text-sm border border-border rounded-xl">No past meetings found.</div>
              ) : (
                pastRooms.map((room, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-surface hover:border-brand-blue/40 hover:shadow-sm transition-all group cursor-pointer" onClick={() => router.push(`/dashboard/meetings/${room.id}`)}>
                    <div className="w-12 h-12 rounded-lg bg-meeting-bg flex items-center justify-center shrink-0 group-hover:bg-brand-blue/10 transition-colors">
                      <Brain className="w-5 h-5 text-brand-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary truncate">{room.name}</h4>
                      <p className="text-xs text-text-muted mt-0.5">ID: {room.slug}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-brand-blue"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Virtual Events & eCinema Promo */}
          <Card className="rounded-2xl border-border bg-surface mt-6">
            <CardContent className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-bold text-text-primary text-sm">Monetize with Virtual Events</h4>
                  <p className="text-xs text-text-muted">Host paid webinars and collect payments via Paystack.</p>
                </div>
              </div>
              <Button onClick={() => router.push('/dashboard/rooms/new?type=webinar')} className="w-full h-10 bg-surface border border-border text-text-primary hover:bg-black/[0.02]">
                Create Webinar
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Share Recording Modal */}
      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)}>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Share Recording</h2>
            <p className="text-sm text-text-muted mt-1">
              Configure access settings for &quot;{selectedRecording?.title}&quot;
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Access Settings</label>
              <Select
                value={accessLevel}
                onChange={setAccessLevel}
                options={[
                  { value: "anyone", label: "Anyone with the link", icon: <Globe className="w-4 h-4" />, description: "No sign-in required" },
                  { value: "participants", label: "Meeting participants", icon: <Users className="w-4 h-4" />, description: "Only people who were in the meeting" },
                  { value: "specific", label: "Specific users", icon: <Lock className="w-4 h-4" />, description: "Restrict by email address" }
                ]}
              />
            </div>

            {accessLevel === "specific" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Email Addresses</label>
                <Input
                  placeholder="name@example.com, another@example.com"
                  value={specificUsers}
                  onChange={(e) => setSpecificUsers(e.target.value)}
                />
              </div>
            )}
          </div>

          {generatedLink ? (
            <div className="p-4 rounded-xl border border-brand-green/20 bg-brand-green/5 space-y-3">
              <p className="text-sm font-medium text-brand-green">Link generated successfully!</p>
              <div className="flex gap-2">
                <input 
                  value={generatedLink} 
                  readOnly 
                  className="flex-1 px-4 py-2 rounded-xl border outline-none bg-white text-slate-900 border-brand-green/20" 
                />
                <Button 
                  onClick={() => navigator.clipboard.writeText(generatedLink)}
                  className="h-10 bg-brand-green hover:bg-[#287854] shrink-0"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleGenerateLink}
              className="w-full h-12 bg-brand-blue hover:bg-[#0047E1] text-white rounded-xl shadow-md transition-all"
            >
              Generate Link
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
