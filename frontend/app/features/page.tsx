"use client"

import { PublicNavbar } from "@/components/layout/PublicNavbar"
import { PublicFooter } from "@/components/layout/PublicFooter"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { motion } from "framer-motion"
import { 
  Video, MessageSquare, Layout, Sparkles, MonitorPlay, Users,
  Globe, Lock, Hand, CheckCircle, Smartphone
} from "lucide-react"

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans overflow-hidden">
      <PublicNavbar />

      <main className="flex-1 pt-32 pb-16">
        {/* Header */}
        <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-[#E0ECE4]/40 to-transparent -z-10" />
        
        <section className="w-full relative z-10 pb-16">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl md:text-6xl"
            >
              Powerful features for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                meaningful connections
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto"
            >
              Everything you need to host, record, and monetize your meetings, webinars, and classes. Built securely for the modern workforce.
            </motion.p>
          </div>
        </section>

        {/* Feature grid */}
        <section className="w-full py-16">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {[
                {
                  icon: Video,
                  title: "High-Fidelity Video & Audio",
                  desc: "Experience 1080p HD video and crystal-clear audio with built-in background noise suppression."
                },
                {
                  icon: Users,
                  title: "Persistent Rooms",
                  desc: "Create dedicated URLs for your team or specific projects. The room, chat history, and shared files stay forever."
                },
                {
                  icon: MonitorPlay,
                  title: "eCinema Recording & Monetization",
                  desc: "Record sessions to the cloud and instantly publish them. Set up paywalls via Paystack to charge for access."
                },
                {
                  icon: Layout,
                  title: "In-Meeting Whiteboards",
                  desc: "Collaborate on unlimited digital canvases in real-time. Save and export when the meeting ends."
                },
                {
                  icon: Hand,
                  title: "Reactions & Engagement",
                  desc: "Live polls, hand raising, and emoji reactions keep large audiences engaged and interactive."
                },
                {
                  icon: Sparkles,
                  title: "AI Meeting Assistant",
                  desc: "Automatically transcribe conversations, generate meeting summaries, and extract action items."
                },
                {
                  icon: MessageSquare,
                  title: "Rich Team Chat",
                  desc: "Send messages, share files, and mention teammates inside the meeting or in persistent channels."
                },
                {
                  icon: Lock,
                  title: "Enterprise Security",
                  desc: "End-to-end encryption, meeting passwords, waiting rooms, and comprehensive host controls."
                },
                {
                  icon: Smartphone,
                  title: "Join from Anywhere",
                  desc: "Works perfectly in modern web browsers with no downloads required. Fully responsive mobile experience."
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: (i % 3) * 0.1 }}
                  className="space-y-4 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-brand-blue/5 border border-brand-blue/10 flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-colors duration-300">
                    <feature.icon className="h-7 w-7 text-brand-blue group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary">{feature.title}</h3>
                  <p className="text-text-secondary leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Deep Dive Section */}
        <section className="w-full py-24 bg-surface border-y border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 space-y-6">
                <h2 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
                  Built for Webinars & Large Events
                </h2>
                <p className="text-lg text-text-secondary leading-relaxed">
                  Host up to 10,000 view-only attendees or up to 1,000 interactive participants. Manage your event with powerful host controls.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "Registration pages with custom branding",
                    "Automated reminder emails",
                    "Q&A moderation with upvoting",
                    "Breakout rooms for small group discussions",
                    "Detailed post-event analytics and attendee reports"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-brand-green shrink-0" />
                      <span className="text-text-primary font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 w-full">
                <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#E0ECE4] to-[#B8C8C0] border border-border flex items-center justify-center relative shadow-xl overflow-hidden">
                   {/* Abstract illustration for webinars */}
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-64 h-64 bg-brand-green/10 rounded-full blur-3xl" />
                      <div className="w-48 h-48 bg-brand-blue/10 rounded-full blur-2xl absolute" />
                   </div>
                   <div className="relative z-10 w-3/4 h-3/4 bg-white rounded-xl shadow-lg border border-border/50 flex flex-col overflow-hidden">
                      <div className="h-8 border-b border-border/50 bg-black/[0.02] flex items-center px-3 gap-2">
                        <div className="w-2 h-2 rounded-full bg-border-strong/30" />
                        <div className="w-2 h-2 rounded-full bg-border-strong/30" />
                        <div className="w-2 h-2 rounded-full bg-border-strong/30" />
                      </div>
                      <div className="flex-1 flex p-4 gap-4">
                        <div className="w-2/3 bg-black/5 rounded-lg border border-black/5 flex items-center justify-center">
                          <Video className="w-12 h-12 text-black/20" />
                        </div>
                        <div className="w-1/3 flex flex-col gap-2">
                           <div className="h-1/3 bg-black/5 rounded-lg" />
                           <div className="h-1/3 bg-black/5 rounded-lg" />
                           <div className="h-1/3 bg-black/5 rounded-lg" />
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-20 text-center">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-text-primary mb-6">Experience it yourself</h2>
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-lg text-base font-bold">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
