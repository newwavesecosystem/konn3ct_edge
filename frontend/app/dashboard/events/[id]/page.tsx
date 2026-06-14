"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Share2, Users, DollarSign, Calendar, Mail, 
  MoreVertical, CheckCircle, Clock
} from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";

export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [selectedAttendee, setSelectedAttendee] = useState<any>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const [event, setEvent] = useState<any>(null);
  
  const [participants] = useState([
    { id: 1, name: "Chioma Adeyemi", email: "chioma@example.com", status: "Paid", date: "June 12, 2026" },
    { id: 2, name: "David Osei", email: "david@example.com", status: "Paid", date: "June 12, 2026" },
    { id: 3, name: "Sarah Johnson", email: "sarah@example.com", status: "Pending", date: "June 13, 2026" },
  ]);

  useEffect(() => {
    // Mocking an API call to get event details
    setTimeout(() => {
      setEvent({
        id: eventId,
        title: eventId === "1" ? "Tech Founder Masterclass" : "Q3 Community Townhall",
        type: eventId === "1" ? "Paid" : "Free",
        price: eventId === "1" ? "₦15,000" : "Free",
        date: eventId === "1" ? "June 25, 2026" : "July 10, 2026",
        registered: eventId === "1" ? 145 : 420,
        revenue: eventId === "1" ? "₦2,175,000" : "—",
        conversionRate: eventId === "1" ? "12%" : "45%"
      });
      setIsLoading(false);
    }, 500);
  }, [eventId]);

  const handleShareClick = () => {
    const link = `${window.location.origin}/event/${eventId}/register`;
    setGeneratedLink(link);
    setIsShareModalOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-10 text-text-muted">Loading event details...</div>;
  }

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/events">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <ArrowLeft className="h-5 w-5 text-text-muted" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">{event.title}</h1>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${event.type === 'Paid' ? 'bg-amber-500/10 text-amber-600' : 'bg-brand-green/10 text-brand-green'}`}>
                {event.type}
              </span>
            </div>
            <p className="text-text-muted mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Scheduled for {event.date}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleShareClick} className="h-11 rounded-xl px-5 bg-brand-blue hover:bg-[#0047E1] text-white shadow-lg shadow-brand-blue/20 transition-all">
            <Share2 className="w-4 h-4 mr-2" />
            Share Registration Link
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Registrations", value: event.registered.toString(), icon: Users, color: "text-brand-blue" },
          { label: "Ticket Price", value: event.price, icon: DollarSign, color: "text-amber-500" },
          { label: "Total Revenue", value: event.revenue, icon: CheckCircle, color: "text-brand-green" },
          { label: "Page Conversion", value: event.conversionRate, icon: Clock, color: "text-purple-500" },
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

      {/* Participants Dashboard */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary">Attendees</h2>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setIsMessageModalOpen(true)}>
            <Mail className="w-4 h-4 mr-2" />
            Message Attendees
          </Button>
        </div>
        <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-black/[0.02]">
              <div className="col-span-5">Attendee</div>
              <div className="col-span-3">Registration Date</div>
              <div className="col-span-2">Payment</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            
            {participants.map(p => (
              <div key={p.id} className="grid grid-cols-12 gap-4 items-center px-6 py-4 border-b border-border/30 last:border-0 hover:bg-black/[0.01]">
                <div className="col-span-5 min-w-0">
                  <p className="font-semibold text-sm text-text-primary truncate">{p.name}</p>
                  <p className="text-xs text-text-muted truncate">{p.email}</p>
                </div>
                <div className="col-span-3 text-sm text-text-muted">
                  {p.date}
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

      {/* Share Modal */}
      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)}>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Share Registration Link</h2>
            <p className="text-sm text-text-muted mt-1">
              Share this link to allow people to register for {event.title}.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-brand-blue/20 bg-brand-blue/5 space-y-3">
            <div className="flex gap-2">
              <Input value={generatedLink} readOnly className="h-10 bg-white" />
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  toast.success("Link copied!");
                }}
                className="h-10 bg-brand-blue hover:bg-[#0047E1] shrink-0"
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-text-muted">Anyone with this link can view the event details and register.</p>
          </div>
          
          <Button variant="outline" className="w-full" onClick={() => router.push(`/event/${eventId}/register`)}>
            Preview Registration Page
          </Button>
        </div>
      </Modal>

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
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Date Registered</p>
                  <p className="font-medium text-text-primary mt-1">{selectedAttendee.date}</p>
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

      {/* Message Attendees Modal */}
      <Modal isOpen={isMessageModalOpen} onClose={() => setIsMessageModalOpen(false)}>
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Message Attendees</h2>
            <p className="text-sm text-text-muted mt-1">
              Send an email to all {event?.registered} registered attendees.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Subject</label>
              <Input 
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="e.g. Important Update for Tomorrow's Masterclass"
                className="h-11 bg-black/[0.02]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Message</label>
              <textarea 
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type your message here..."
                className="w-full min-h-[120px] rounded-xl border border-border/60 bg-black/[0.02] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsMessageModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => { 
                toast.success(`Message sent to ${event?.registered} attendees!`); 
                setIsMessageModalOpen(false);
                setMessageSubject("");
                setMessageBody("");
              }}
              disabled={!messageSubject.trim() || !messageBody.trim()}
              className="flex-1 bg-brand-blue hover:bg-[#0047E1] text-white disabled:opacity-50"
            >
              <Mail className="w-4 h-4 mr-2" /> Send Message
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
