"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import {
  Play, Download, Share2, MoreVertical, Clock,
  Film, Eye, Calendar, Search, Filter
} from "lucide-react";
import { Input } from "@/components/ui/Input";

const recordings = [
  { id: 1, title: "Q3 Planning Session", date: "Today, 11:00 AM", duration: "1h 15m", views: 12, size: "840 MB", thumbnail: "bg-gradient-to-br from-brand-blue to-blue-400" },
  { id: 2, title: "Weekly All Hands", date: "Yesterday, 10:00 AM", duration: "45m", views: 32, size: "520 MB", thumbnail: "bg-gradient-to-br from-brand-green to-emerald-400" },
  { id: 3, title: "Design Sync", date: "Mon, 2:00 PM", duration: "30m", views: 8, size: "380 MB", thumbnail: "bg-gradient-to-br from-purple-500 to-pink-400" },
  { id: 4, title: "Client Pitch: Acme Corp", date: "Last Friday", duration: "1h 02m", views: 5, size: "780 MB", thumbnail: "bg-gradient-to-br from-amber-500 to-orange-400" },
  { id: 5, title: "Onboarding Walkthrough", date: "Apr 28, 2026", duration: "22m", views: 48, size: "280 MB", thumbnail: "bg-gradient-to-br from-cyan-500 to-blue-400" },
  { id: 6, title: "Sprint Retrospective", date: "Apr 25, 2026", duration: "38m", views: 15, size: "440 MB", thumbnail: "bg-gradient-to-br from-rose-500 to-red-400" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function RecordingsPage() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Recordings & eCinema</h1>
          <p className="text-text-muted mt-1">View, share, and manage your recorded sessions.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-11 rounded-xl px-4 border-border/60">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Recordings", value: "24", icon: Film },
          { label: "Total Duration", value: "18h 42m", icon: Clock },
          { label: "Total Views", value: "120", icon: Eye },
          { label: "This Month", value: "6", icon: Calendar },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10">
              <s.icon className="h-5 w-5 text-brand-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <Input
        type="search"
        placeholder="Search recordings..."
        leftIcon={<Search className="h-4 w-4" />}
        className="max-w-md h-10 bg-black/[0.02] border-border/60"
      />

      {/* Recording Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {recordings.map((rec) => (
          <motion.div key={rec.id} variants={itemVariants}>
            <Card className="rounded-2xl border-border/60 bg-surface hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300 overflow-hidden group">
              {/* Thumbnail */}
              <div className={`relative h-36 ${rec.thumbnail} flex items-center justify-center`}>
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-brand-blue shadow-xl scale-75 group-hover:scale-100 transition-transform">
                    <Play className="h-6 w-6 ml-0.5" />
                  </button>
                </div>
                <Play className="h-10 w-10 text-white/40" />
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm">
                  {rec.duration}
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-text-primary truncate">{rec.title}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{rec.date}</p>
                  </div>
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-black/[0.04] text-text-muted transition-all shrink-0 ml-2">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {rec.views}</span>
                    <span>{rec.size}</span>
                  </div>
                  <div className="flex gap-1">
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-brand-green/10 text-text-muted hover:text-brand-green transition-colors" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-brand-blue/10 text-text-muted hover:text-brand-blue transition-colors" title="Share">
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
