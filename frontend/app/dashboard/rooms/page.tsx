"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Video, Plus, Copy, Link2, MoreVertical,
  Users, Globe, Lock, Settings, Trash2, ExternalLink, Edit
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { apiClient, Room } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Extended interface for UI properties not in API schema
interface UIRoom extends Room {
  participants: number;
  type: string;
  isLocked: boolean;
  lastUsed: string;
  color: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function RoomsPage() {
  const router = useRouter();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<UIRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{name: string} | null>(null);

  useEffect(() => {
    apiClient.auth.getMe().then(user => setCurrentUser(user)).catch(() => {});
  }, []);

  const colors = [
    "from-brand-blue to-blue-500",
    "from-brand-green to-emerald-400",
    "from-amber-500 to-orange-400",
    "from-purple-500 to-pink-400"
  ];

  const handleDeleteRoom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this room?")) return;
    try {
      await apiClient.rooms.delete(id);
      setRooms(prev => prev.filter(r => r.id !== id));
      toast.success("Room deleted successfully");
    } catch (err) {
      toast.error("Failed to delete room");
    }
  };

  const handleDuplicateRoom = async (room: UIRoom, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newRoom = await apiClient.rooms.create({ name: `${room.name} (Copy)`, mode: room.mode });
      const formatted: UIRoom = {
        ...newRoom,
        participants: 0,
        type: newRoom.mode === 'webinar' ? 'Webinar' : 'Meeting',
        isLocked: false,
        lastUsed: new Date(newRoom.createdAt).toLocaleDateString(),
        color: colors[rooms.length % colors.length]
      };
      setRooms(prev => [formatted, ...prev]);
      toast.success("Room duplicated successfully");
    } catch (err) {
      toast.error("Failed to duplicate room");
    }
  };

  useEffect(() => {
    apiClient.rooms.getAll()
      .then(data => {
        // Map missing UI fields until API is updated to support them
        const formatted = data.map((r, i) => ({
          ...r,
          participants: Math.floor(Math.random() * 5),
          type: r.mode === 'webinar' ? 'Webinar' : 'Meeting',
          isLocked: false,
          lastUsed: new Date(r.createdAt).toLocaleDateString(),
          color: colors[i % colors.length]
        }));
        setRooms(formatted);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Rooms</h1>
          <p className="text-text-muted mt-1">Create and manage your meeting rooms.</p>
        </div>
        <Link href="/dashboard/rooms/new">
          <Button className="h-11 rounded-xl px-5 bg-brand-green hover:bg-[#287854] shadow-[0_6px_20px_rgba(32,116,80,0.2)] transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Rooms", value: rooms.length.toString(), icon: Video },
          { label: "Active Now", value: "0", icon: Users },
          { label: "Public", value: rooms.length.toString(), icon: Globe },
          { label: "Private", value: "0", icon: Lock },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10">
              <s.icon className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Room Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {rooms.map((room) => (
          <motion.div key={room.id} variants={itemVariants}>
            <Card className="rounded-2xl border-border/60 bg-surface hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300 group relative">
              {/* Gradient stripe */}
              <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${room.color}`} />

              <CardContent className="p-5 space-y-4">
                {/* Title row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${room.color} shadow-sm`}>
                      <Video className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-text-primary truncate">{room.name}</h3>
                      <p className="text-xs text-text-muted truncate">/{room.slug}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === room.id ? null : room.id);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/[0.04] text-text-muted transition-all ${openDropdownId === room.id ? 'opacity-100 bg-black/[0.04]' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    
                    <AnimatePresence>
                      {openDropdownId === room.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(null);
                            }}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-8 w-40 rounded-xl border border-border/60 bg-surface shadow-lg shadow-black/5 z-50 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-1.5 space-y-0.5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/rooms/${room.id}`); }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] transition-colors">
                              <Edit className="h-4 w-4 text-text-muted" /> Edit Room
                            </button>
                            <button 
                              onClick={(e) => handleDuplicateRoom(room, e)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] transition-colors">
                              <Copy className="h-4 w-4 text-text-muted" /> Duplicate
                            </button>
                            <div className="h-px w-full bg-border/60 my-1" />
                            <button 
                              onClick={(e) => handleDeleteRoom(room.id, e)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors">
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {room.participants}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border-strong" />
                  <span>{room.type}</span>
                  <span className="w-1 h-1 rounded-full bg-border-strong" />
                  {room.isLocked ? (
                    <span className="flex items-center gap-1 text-amber-500"><Lock className="h-3 w-3" /> Locked</span>
                  ) : (
                    <span className="flex items-center gap-1 text-brand-green"><Globe className="h-3 w-3" /> Open</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-[11px] text-text-muted">Last used: {room.lastUsed}</span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => {
                        const link = `${window.location.origin}/meeting/${room.slug}`;
                        navigator.clipboard.writeText(link);
                        toast.success("Meeting link copied to clipboard");
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-brand-green/10 text-text-muted hover:text-brand-green transition-colors" 
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        const hostName = currentUser?.name || "Host";
                        router.push(`/meeting/${room.slug}?name=${encodeURIComponent(hostName)}&role=host`);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-brand-blue/10 text-text-muted hover:text-brand-blue transition-colors" 
                      title="Open room"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
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
