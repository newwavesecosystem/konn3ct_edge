"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Calendar, CreditCard, Video, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function EventRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [event, setEvent] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", email: "" });

  useEffect(() => {
    // Mock fetch event info
    setTimeout(() => {
      if (eventId === "1") {
        setEvent({
          id: "1",
          title: "Tech Founder Masterclass",
          type: "Paid",
          price: "₦15,000",
          date: "June 25, 2026",
          description: "Learn the secrets of scaling a tech startup from zero to one million users in this exclusive masterclass."
        });
      } else {
        setEvent({
          id: eventId,
          title: "Q3 Community Townhall",
          type: "Free",
          price: "Free",
          date: "July 10, 2026",
          description: "Join us for our quarterly townhall where we discuss upcoming features and community initiatives."
        });
      }
      setIsLoading(false);
    }, 600);
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setIsSubmitting(true);
    
    // Simulate payment / registration delay
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      toast.success("Registration successful!");
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="animate-pulse text-brand-blue font-semibold">Loading Event Details...</div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full rounded-3xl border-border/60 bg-surface shadow-2xl">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary">You're Registered!</h1>
            <p className="text-text-muted">
              We've sent a calendar invite and join link to <strong>{formData.email}</strong>.
            </p>
            <div className="p-4 rounded-xl bg-black/[0.02] border border-border/40 w-full text-left mt-4">
              <p className="font-semibold text-text-primary">{event.title}</p>
              <p className="text-sm text-text-muted mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {event.date}
              </p>
            </div>
            <Link href="/" className="w-full mt-4">
              <Button variant="outline" className="w-full h-12 rounded-xl">
                Return to konn3ct
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Top Navbar */}
      <div className="h-16 flex items-center px-6 border-b border-border/40 bg-surface">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-green shadow-md shadow-brand-green/20">
            <Video className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-text-primary">konn3ct</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-start">
          
          {/* Event Details Left Side */}
          <div className="space-y-6">
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 ${event.type === 'Paid' ? 'bg-amber-500/10 text-amber-600' : 'bg-brand-green/10 text-brand-green'}`}>
                {event.type} Event
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-text-primary tracking-tight leading-tight">
                {event.title}
              </h1>
              <p className="text-lg text-text-muted mt-4 leading-relaxed">
                {event.description}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Date & Time</p>
                  <p className="text-text-muted">{event.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Registration Fee</p>
                  <p className="text-text-muted font-medium">{event.price}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Registration Form Right Side */}
          <Card className="rounded-3xl border-border/60 bg-surface shadow-2xl md:ml-auto w-full max-w-md">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Reserve your spot</h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-primary">Full Name</label>
                  <Input 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Jane Doe" 
                    className="h-12 bg-black/[0.02]" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-primary">Email Address</label>
                  <Input 
                    required 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="jane@example.com" 
                    className="h-12 bg-black/[0.02]" 
                  />
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className={`w-full h-12 rounded-xl text-white font-bold shadow-lg transition-all ${event.type === 'Paid' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-brand-green hover:bg-[#287854] shadow-brand-green/20'}`}
                  >
                    {isSubmitting 
                      ? "Processing..." 
                      : event.type === 'Paid' 
                        ? `Pay ${event.price} via Paystack` 
                        : "Register for Free"
                    }
                  </Button>
                  {event.type === 'Paid' && (
                    <p className="text-center text-xs text-text-muted mt-3 flex items-center justify-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> Secured by Paystack
                    </p>
                  )}
                </div>
              </form>

            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
