"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Calendar, Users, DollarSign,
  Plus, Search, MoreVertical, CreditCard,
  Mail, MessageSquare
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";

export default function VirtualEventsPage() {
  const router = useRouter();
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [selectedAttendee, setSelectedAttendee] = useState<any>(null);
  const [events] = useState([
    { id: 1, title: "Tech Founder Masterclass", type: "Paid", price: "₦15,000", registered: 145, revenue: "₦2,175,000", date: "June 25, 2026" },
    { id: 2, title: "Q3 Community Townhall", type: "Free", price: "—", registered: 420, revenue: "—", date: "July 10, 2026" },
  ]);

  const [participants] = useState([
    { id: 1, name: "Chioma Adeyemi", email: "chioma@example.com", status: "Paid", event: "Tech Founder Masterclass" },
    { id: 2, name: "David Osei", email: "david@example.com", status: "Paid", event: "Tech Founder Masterclass" },
    { id: 3, name: "Sarah Johnson", email: "sarah@example.com", status: "Pending", event: "Tech Founder Masterclass" },
  ]);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Virtual Events</h1>
          <p className="text-text-muted mt-1">Host paid webinars and manage registered attendees.</p>
        </div>
        <Button 
          onClick={() => router.push('/dashboard/rooms/new?type=webinar')}
          className="h-11 rounded-xl px-5 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="w-4 h-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active Events", value: "2", icon: Globe, color: "text-brand-blue" },
          { label: "Total Registrations", value: "565", icon: Users, color: "text-brand-green" },
          { label: "Revenue (30d)", value: "₦2.1M", icon: DollarSign, color: "text-amber-500" },
          { label: "Payouts", value: "Ready", icon: CreditCard, color: "text-purple-500" },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color.replace('text-', 'bg-')}/10`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Events List */}
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-4">Your Events</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map(event => (
            <Card 
              key={event.id} 
              onClick={() => router.push(`/dashboard/events/${event.id}`)}
              className="rounded-2xl border-border/60 bg-surface hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-text-primary">{event.title}</h3>
                    <p className="text-sm text-text-muted flex items-center gap-1 mt-1">
                      <Calendar className="w-4 h-4" /> {event.date}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${event.type === 'Paid' ? 'bg-amber-500/10 text-amber-600' : 'bg-brand-green/10 text-brand-green'}`}>
                    {event.type}
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-border/40">
                  <div className="text-sm">
                    <p className="text-text-muted text-xs">Registrations</p>
                    <p className="font-semibold">{event.registered}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-text-muted text-xs">Price</p>
                    <p className="font-semibold">{event.price}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-text-muted text-xs">Revenue</p>
                    <p className="font-semibold text-brand-green">{event.revenue}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Participants Dashboard */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary">Recent Registrations</h2>
          <Button 
            onClick={() => toast.success("Reminders sent successfully to all registered participants!")}
            variant="outline" size="sm" className="h-9">
            <Mail className="w-4 h-4 mr-2" />
            Send Reminder
          </Button>
        </div>
        <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-black/[0.02]">
              <div className="col-span-4">Attendee</div>
              <div className="col-span-4">Event</div>
              <div className="col-span-2">Payment</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            
            {participants.map(p => (
              <div key={p.id} className="grid grid-cols-12 gap-4 items-center px-6 py-4 border-b border-border/30 last:border-0 hover:bg-black/[0.01]">
                <div className="col-span-4 min-w-0">
                  <p className="font-semibold text-sm text-text-primary truncate">{p.name}</p>
                  <p className="text-xs text-text-muted truncate">{p.email}</p>
                </div>
                <div className="col-span-4 text-sm text-text-muted truncate">
                  {p.event}
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${p.status === "Paid" ? "text-brand-green" : "text-amber-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${p.status === "Paid" ? "bg-brand-green" : "bg-amber-500"}`} />
                    {p.status}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === p.id ? null : p.id); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/[0.04] text-text-muted">
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  <AnimatePresence>
                    {activeDropdown === p.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-8 w-48 rounded-xl border border-border/60 bg-surface shadow-xl z-50 overflow-hidden"
                        >
                          <div className="p-1.5 space-y-0.5">
                            <button 
                              onClick={() => { setActiveDropdown(null); setSelectedAttendee(p); }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] transition-colors">
                              View Details
                            </button>
                            <button 
                              onClick={() => { setActiveDropdown(null); toast.success(`Confirmation resent to ${p.email}`); }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] transition-colors">
                              Resend Confirmation
                            </button>
                            <div className="h-px w-full bg-border/60 my-1" />
                            <button 
                              onClick={() => { setActiveDropdown(null); toast.error(`${p.name} removed from event.`); }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors">
                              Remove Attendee
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Attendee Details Modal */}
      <Modal isOpen={!!selectedAttendee} onClose={() => setSelectedAttendee(null)}>
        {selectedAttendee && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Attendee Details</h2>
              <p className="text-sm text-text-muted mt-1">
                Registration information for {selectedAttendee.name}.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-border/60 bg-surface shadow-sm space-y-4">
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Full Name</p>
                <p className="font-bold text-text-primary mt-1">{selectedAttendee.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email Address</p>
                <p className="font-medium text-text-primary mt-1">{selectedAttendee.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Event</p>
                  <p className="font-medium text-text-primary mt-1">{selectedAttendee.event}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Payment Status</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${selectedAttendee.status === "Paid" ? "text-brand-green" : "text-amber-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedAttendee.status === "Paid" ? "bg-brand-green" : "bg-amber-500"}`} />
                      {selectedAttendee.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedAttendee(null)}>
                Close
              </Button>
              <Button 
                onClick={() => { toast.success(`Email sent to ${selectedAttendee.email}`); setSelectedAttendee(null); }}
                className="flex-1 bg-brand-blue hover:bg-[#0047E1] text-white">
                <Mail className="w-4 h-4 mr-2" /> Message
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
