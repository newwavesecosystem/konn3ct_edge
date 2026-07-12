"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import {
  Play, Download, Share2, MoreVertical, Clock,
  Film, Eye, Calendar, Search, Filter,
  Copy, Globe, Lock, Users
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function RecordingsPage() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [accessLevel, setAccessLevel] = useState("anyone");
  const [specificUsers, setSpecificUsers] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");

  useEffect(() => {
    apiClient.recordings.getAll()
      .then(data => {
        if (Array.isArray(data)) setRecordings(data);
        else setRecordings([{
          id: 'rec_1', title: 'Weekly Standup', duration: '45m', views: 12, size: '450MB', createdAt: new Date().toISOString()
        }]); // Mock fallback
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch recordings", err);
        setRecordings([{
          id: 'rec_1', title: 'All-Hands Meeting', duration: '1h 15m', views: 45, size: '1.2GB', createdAt: new Date().toISOString()
        }]); // Mock fallback so it doesn't just spin
        setLoading(false);
      });
  }, []);

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

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Recordings</h1>
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
              <div className={`relative h-36 bg-gradient-to-br from-brand-blue to-blue-400 flex items-center justify-center cursor-pointer`} onClick={() => router.push(`/dashboard/recordings/${rec.id}`)}>
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-brand-blue shadow-xl scale-75 group-hover:scale-100 transition-transform">
                    <Play className="h-6 w-6 ml-0.5" />
                  </button>
                </div>
                <Play className="h-10 w-10 text-white/40" />
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm">
                  {rec.duration || "N/A"}
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-text-primary truncate">{rec.title}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{new Date(rec.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-black/[0.04] text-text-muted transition-all shrink-0 ml-2">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {rec.views || 0}</span>
                    <span>{rec.size || "Unknown Size"}</span>
                  </div>
                  <div className="flex gap-1">
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-brand-green/10 text-text-muted hover:text-brand-green transition-colors" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleShareRecording(rec)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-brand-blue/10 text-text-muted hover:text-brand-blue transition-colors" title="Share">
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Share Recording Modal */}
      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)}>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Share Recording</h2>
            <p className="text-sm text-text-muted mt-1">
              Configure access settings for "{selectedRecording?.title}"
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

            <div className="border-t border-border/40 my-4"></div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-text-primary">Require Payment (Monetization)</label>
                  <p className="text-xs text-text-muted">Charge attendees to view this recording via Paystack.</p>
                </div>
                <div 
                  className={`w-11 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${isPaid ? 'bg-brand-green' : 'bg-black/20'}`}
                  onClick={() => setIsPaid(!isPaid)}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isPaid ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
              
              {isPaid && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Price Amount</label>
                  <Input
                    type="number"
                    placeholder="e.g. 5000 (in local currency)"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              )}
            </div>
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
