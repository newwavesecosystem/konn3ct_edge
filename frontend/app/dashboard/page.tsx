"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { 
  Video, Calendar, Users, Clock, 
  ArrowRight, Play, MoreVertical, 
  Link2, Copy, CalendarDays
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

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
            Welcome back, Alex 👋
          </h1>
          <p className="text-text-muted mt-1 text-lg">
            Here's what's happening with your meetings today.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none h-12 rounded-xl px-4 border-border-strong/20 hover:border-brand-blue hover:text-brand-blue transition-colors bg-surface shadow-sm">
            <Link2 className="w-5 h-5 mr-2" />
            Copy Personal Link
          </Button>
          <Button 
            onClick={() => router.push(`/meeting/demo-room-${Math.floor(Math.random() * 1000)}`)}
            className="flex-1 md:flex-none h-12 rounded-xl px-6 bg-brand-green hover:bg-[#287854] shadow-[0_8px_24px_rgba(32,116,80,0.25)] hover:shadow-[0_12px_32px_rgba(32,116,80,0.35)] transition-all">
            <Video className="w-5 h-5 mr-2" />
            New Meeting
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
          { title: "Total Rooms", value: "12", icon: Users, color: "text-brand-blue", bg: "bg-brand-blue/10" },
          { title: "Upcoming Meetings", value: "3", icon: Calendar, color: "text-brand-green", bg: "bg-brand-green/10" },
          { title: "Recordings", value: "24", icon: Play, color: "text-[#CC505C]", bg: "bg-[#CC505C]/10" },
          { title: "Total Minutes", value: "1,240", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" }
        ].map((stat, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="rounded-2xl border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 overflow-hidden relative group h-full">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-muted mb-1">{stat.title}</p>
                    <h3 className="text-3xl font-bold text-text-primary">{stat.value}</h3>
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
            <h2 className="text-xl font-bold text-text-primary">Today's Schedule</h2>
            <Button variant="ghost" className="text-brand-green hover:text-brand-green-soft hover:bg-brand-green/10 rounded-lg">
              View Calendar <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
          
          <Card className="rounded-2xl border-border bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="divide-y divide-border">
              {[
                { time: "10:00 AM", title: "Product Sync", type: "Internal", duration: "45m", dot: "bg-brand-blue" },
                { time: "01:30 PM", title: "Client Pitch: Acme Corp", type: "External", duration: "1h", dot: "bg-brand-green" },
                { time: "04:00 PM", title: "Design Review", type: "Internal", duration: "30m", dot: "bg-amber-400" }
              ].map((meeting, i) => (
                <div key={i} className="flex items-center p-5 hover:bg-black/[0.02] transition-colors group">
                  <div className="flex flex-col items-center justify-center w-20 text-center shrink-0">
                    <span className="text-sm font-bold text-text-primary">{meeting.time.split(' ')[0]}</span>
                    <span className="text-xs font-semibold text-text-muted">{meeting.time.split(' ')[1]}</span>
                  </div>
                  <div className={`w-1 h-12 rounded-full mx-4 opacity-70 ${meeting.dot}`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-text-primary truncate">{meeting.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                      <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {meeting.duration}</span>
                      <span className="w-1 h-1 rounded-full bg-border-strong"></span>
                      <span>{meeting.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="outline" className="rounded-lg h-9">
                      <Copy className="w-4 h-4 mr-2" />
                      Link
                    </Button>
                    <Button size="sm" className="rounded-lg h-9 bg-brand-green hover:bg-[#287854]">
                      Join
                    </Button>
                  </div>
                </div>
              ))}
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
                  onClick={() => router.push(`/meeting/demo-room-${Math.floor(Math.random() * 1000)}`)}
                  className="w-full bg-white text-brand-blue hover:bg-gray-100 h-12 rounded-xl font-bold transition-transform active:scale-95">
                  Start Now
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
              <h2 className="text-lg font-bold text-text-primary">Recent Recordings</h2>
            </div>
            <div className="space-y-3">
              {[
                { title: "Q3 Planning Session", date: "Today, 11:00 AM", duration: "1h 15m" },
                { title: "Weekly All Hands", date: "Yesterday", duration: "45m" },
                { title: "Design Sync", date: "Mon, 2:00 PM", duration: "30m" }
              ].map((rec, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-surface hover:border-brand-blue/40 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-lg bg-meeting-bg flex items-center justify-center shrink-0 group-hover:bg-brand-blue/10 transition-colors">
                    <Play className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-text-primary truncate">{rec.title}</h4>
                    <p className="text-xs text-text-muted mt-0.5">{rec.date} • {rec.duration}</p>
                  </div>
                  <MoreVertical className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
