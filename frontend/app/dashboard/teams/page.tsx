"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Users, Search, MoreVertical, Shield,
  Mail, Crown, UserCheck, ChevronDown, Edit2, Trash2,
  Key, LogOut, UserCircle, Check, Video, Play, CalendarDays, ArrowLeft, Clock
} from "lucide-react";
import { toast } from "sonner";
import { InviteMemberModal, InviteFormValues } from "@/components/teams/InviteMemberModal";
import { Modal } from "@/components/ui/Modal";

const initialMembers = [
  { id: 1, name: "Alex Doe", email: "alex@konn3ct.io", role: "Owner", avatar: "AD", status: "Active", joined: "Jan 2026", gradient: "from-brand-blue to-brand-green" },
  { id: 2, name: "Sarah Kim", email: "sarah@konn3ct.io", role: "Admin", avatar: "SK", status: "Active", joined: "Feb 2026", gradient: "from-purple-500 to-pink-400" },
  { id: 3, name: "James Obi", email: "james@konn3ct.io", role: "Member", avatar: "JO", status: "Active", joined: "Mar 2026", gradient: "from-amber-500 to-orange-400" },
];

const roleColors: Record<string, string> = {
  Owner: "bg-amber-500/10 text-amber-600",
  Admin: "bg-brand-blue/10 text-brand-blue",
  Member: "bg-brand-green/10 text-brand-green",
};

export default function TeamsPage() {
  const [membersList, setMembersList] = useState(initialMembers);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [activityView, setActivityView] = useState<"profile" | "rooms" | "recordings" | "meetings">("profile");

  const openProfile = (member: any) => {
    setSelectedProfile(member);
    setActivityView("profile");
    setActiveDropdown(null);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleInviteSuccess = (data: InviteFormValues) => {
    const newMember = {
      id: Date.now(),
      name: data.email.split('@')[0] || "New Member",
      email: data.email,
      role: data.role,
      avatar: (data.email[0] || "N").toUpperCase(),
      status: "Pending",
      joined: "—",
      gradient: "from-brand-blue to-purple-500", // A premium gradient
    };

    setMembersList([newMember, ...membersList]);
    toast.success(`Invite sent to ${data.email}`);
  };

  const handleRemoveMember = (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the team?`)) return;
    setMembersList(membersList.filter(m => m.id !== id));
    toast.success(`${name} has been removed.`);
  };

  const handleSuspendMember = (id: number, name: string) => {
    setMembersList(membersList.map(m => m.id === id ? { ...m, status: "Suspended" } : m));
    setActiveDropdown(null);
    toast.success(`${name} has been suspended.`);
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Teams</h1>
          <p className="text-text-muted mt-1">Manage your organization and team members.</p>
        </div>
        <Button 
          onClick={() => {
            if (membersList.length >= 3) {
              setIsPaywallOpen(true);
            } else {
              setIsInviteModalOpen(true);
            }
          }}
          className="h-11 rounded-xl px-5 bg-brand-green hover:bg-[#287854] shadow-[0_6px_20px_rgba(32,116,80,0.2)] transition-all"
        >
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: membersList.length.toString(), icon: Users },
          { label: "Active", value: membersList.filter(m => m.status === "Active").length.toString(), icon: UserCheck },
          { label: "Pending Invites", value: membersList.filter(m => m.status === "Pending").length.toString(), icon: Mail },
          { label: "Admins", value: membersList.filter(m => m.role === "Admin" || m.role === "Owner").length.toString(), icon: Shield },
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
        placeholder="Search team members..."
        leftIcon={<Search className="h-4 w-4" />}
        className="max-w-md h-10 bg-black/[0.02] border-border/60"
      />

      {/* Members List */}
      <Card className="rounded-2xl border-border/60 bg-surface">
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <div className="col-span-4">Member</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Joined</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Members */}
          {membersList.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: "spring" as const, stiffness: 300, damping: 24 }}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center px-6 py-4 border-b border-border/30 hover:bg-black/[0.015] transition-colors group last:border-b-0"
            >
              {/* Member */}
              <div className="col-span-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${member.gradient} text-white text-xs font-bold shadow-sm`}>
                  {member.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{member.name}</p>
                  <p className="text-xs text-text-muted truncate">{member.email}</p>
                </div>
              </div>

              {/* Role */}
              <div className="col-span-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColors[member.role]}`}>
                  {member.role === "Owner" && <Crown className="h-3 w-3" />}
                  {member.role === "Admin" && <Shield className="h-3 w-3" />}
                  {member.role}
                </span>
              </div>

              {/* Status */}
              <div className="col-span-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${member.status === "Active" ? "text-brand-green" : "text-amber-500"
                  }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${member.status === "Active" ? "bg-brand-green" : "bg-amber-500"
                    }`} />
                  {member.status}
                </span>
              </div>

              {/* Joined */}
              <div className="col-span-2">
                <span className="text-sm text-text-muted">{member.joined}</span>
              </div>

              {/* Actions */}
              <div className={`action-dropdown-container col-span-2 flex justify-end gap-1 transition-opacity relative ${activeDropdown === member.id ? 'opacity-100 z-50' : 'opacity-0 group-hover:opacity-100 z-10'}`}>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand-blue/10 hover:text-brand-blue text-text-muted transition-colors" title="Edit Role">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.id, member.name); }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-500 text-text-muted transition-colors" title="Remove Member">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === member.id ? null : member.id);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${activeDropdown === member.id ? 'bg-black/[0.08] text-text-primary' : 'hover:bg-black/[0.04] text-text-muted'}`} 
                  title="More Options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                <AnimatePresence>
                  {activeDropdown === member.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-10 w-48 rounded-xl border border-border/60 bg-surface p-1.5 shadow-xl z-[100]"
                    >
                      <button 
                        onClick={(e) => { e.stopPropagation(); openProfile(member); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] transition-colors"
                      >
                        <UserCircle className="h-4 w-4 text-text-muted" /> View Profile
                      </button>
                      <button 
                        onClick={() => { setActiveDropdown(null); toast.info(`Password reset link sent to ${member.email}`); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] transition-colors"
                      >
                        <Key className="h-4 w-4 text-text-muted" /> Reset Password
                      </button>
                      <div className="my-1 border-t border-border/40" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSuspendMember(member.id, member.name); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-amber-600 hover:bg-amber-500/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Suspend User
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      <InviteMemberModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        onSuccess={handleInviteSuccess} 
      />

      {/* Profile Modal */}
      <Modal isOpen={!!selectedProfile} onClose={() => setSelectedProfile(null)}>
        {selectedProfile && activityView === "profile" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${selectedProfile.gradient} text-white text-xl font-bold shadow-md`}>
                {selectedProfile.avatar}
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">{selectedProfile.name}</h2>
                <p className="text-sm text-text-muted">{selectedProfile.email}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border/60 bg-surface shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Role</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColors[selectedProfile.role]}`}>
                      {selectedProfile.role === "Owner" && <Crown className="h-3 w-3" />}
                      {selectedProfile.role === "Admin" && <Shield className="h-3 w-3" />}
                      {selectedProfile.role}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${selectedProfile.status === "Active" ? "text-brand-green" : "text-amber-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedProfile.status === "Active" ? "bg-brand-green" : "bg-amber-500"}`} />
                      {selectedProfile.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Joined Date</p>
                  <p className="font-medium text-text-primary mt-1">{selectedProfile.joined}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total Hosted Sessions</p>
                  <p className="font-medium text-text-primary mt-1">12</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text-primary border-b border-border/40 pb-2">Workspace Activity</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] border border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-blue/10 text-brand-blue">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Rooms Created</p>
                      <p className="text-xs text-text-muted">3 Active Rooms</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setActivityView("rooms")}>View All</Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] border border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-green/10 text-brand-green">
                      <Play className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Recordings</p>
                      <p className="text-xs text-text-muted">14 Hours of content</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setActivityView("recordings")}>Manage</Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] border border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Meetings Hosted</p>
                      <p className="text-xs text-text-muted">Last hosted: 2 days ago</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setActivityView("meetings")}>View Logs</Button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedProfile(null)}>
                Close
              </Button>
              <Button 
                onClick={() => { toast.success(`Email sent to ${selectedProfile.email}`); setSelectedProfile(null); }}
                className="flex-1 bg-brand-blue hover:bg-[#0047E1] text-white">
                <Mail className="w-4 h-4 mr-2" /> Message
              </Button>
            </div>
          </div>
        )}

        {selectedProfile && activityView !== "profile" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <button onClick={() => setActivityView("profile")} className="p-2 -ml-2 rounded-lg hover:bg-black/[0.04] text-text-muted transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-text-primary">
                {activityView === "rooms" && "Active Rooms"}
                {activityView === "recordings" && "Recordings"}
                {activityView === "meetings" && "Meetings Hosted"}
              </h2>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {activityView === "rooms" && [1, 2, 3].map(i => (
                <div key={i} className="p-3 rounded-xl border border-border/60 bg-black/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-blue/10 text-brand-blue"><Video className="w-4 h-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Weekly Sync Room {i}</p>
                      <p className="text-xs text-text-muted">ID: 894-234-11{i}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">Join</Button>
                </div>
              ))}
              
              {activityView === "recordings" && [1, 2].map(i => (
                <div key={i} className="p-3 rounded-xl border border-border/60 bg-black/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-green/10 text-brand-green"><Play className="w-4 h-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Client Demo 0{i}</p>
                      <p className="text-xs text-text-muted">45 mins • 120 MB</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">Play</Button>
                </div>
              ))}

              {activityView === "meetings" && [1, 2, 3].map(i => (
                <div key={i} className="p-3 rounded-xl border border-border/60 bg-black/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500"><Clock className="w-4 h-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Standup {i}</p>
                      <p className="text-xs text-text-muted">{i} day(s) ago • 14 Attendees</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">Details</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Upgrade Paywall Modal */}
      <Modal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)}>
        <div className="flex flex-col gap-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <Shield className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-text-primary">Team Limit Reached</h2>
            <p className="text-text-muted mt-2">
              The Basic plan includes up to 3 team members. Upgrade to unlock larger teams and advanced admin controls.
            </p>
          </div>

          <div className="text-left p-5 rounded-2xl border-2 border-brand-blue bg-brand-blue/5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brand-blue text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">RECOMMENDED</div>
            <h3 className="font-bold text-brand-blue flex items-center gap-2"><Crown className="w-4 h-4" /> Lite Plan</h3>
            <div className="flex items-baseline gap-1 text-text-primary">
              <span className="text-3xl font-extrabold">₦66,000</span>
              <span className="text-sm font-semibold text-text-muted">/ year</span>
            </div>
            <ul className="space-y-2 text-sm font-medium text-text-primary">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-green" /> Unlimited Team Members</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-green" /> 500 Participants per session</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-green" /> Cloud Recording & AI Transcripts</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => {
                setIsProcessingPayment(true);
                setTimeout(() => {
                  setIsProcessingPayment(false);
                  setIsPaywallOpen(false);
                  setIsInviteModalOpen(true);
                  toast.success("Successfully upgraded to Lite Plan!");
                }, 1500);
              }}
              disabled={isProcessingPayment}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-500/20"
            >
              {isProcessingPayment ? "Processing..." : "Upgrade via Paystack"}
            </Button>
            <Button variant="ghost" onClick={() => setIsPaywallOpen(false)} className="text-text-muted">
              Maybe Later
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
