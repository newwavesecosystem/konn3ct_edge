"use client"

import { PublicNavbar } from "@/components/layout/PublicNavbar"
import { PublicFooter } from "@/components/layout/PublicFooter"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { motion } from "framer-motion"
import { 
  Video, MessageSquare, Layout, Sparkles, MonitorPlay, Users,
  Globe, Lock, Hand, CheckCircle, Smartphone, ArrowRight, Mic, FileText, BarChart3, Wifi
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-4 pt-2"
            >
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 rounded-xl text-base font-bold" style={{ backgroundColor: '#207450' }}>
                  Get started free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="h-14 px-8 rounded-xl text-base font-semibold border-border-strong/20 hover:border-brand-blue hover:text-brand-blue">
                  View pricing
                </Button>
              </Link>
            </motion.div>
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
                },
                {
                  icon: Mic,
                  title: "Real-time Captions",
                  desc: "AI-powered captions in 30+ languages let every participant follow along, regardless of language."
                },
                {
                  icon: FileText,
                  title: "Meeting Notes & Docs",
                  desc: "Collaborative documents sync live during meetings. Attach agendas beforehand, take notes in real-time."
                },
                {
                  icon: BarChart3,
                  title: "Analytics Dashboard",
                  desc: "Track attendance, engagement scores, and recording performance across your organization."
                },
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
                      <CheckCircle className="h-6 w-6 shrink-0" style={{ color: '#207450' }} />
                      <span className="text-text-primary font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 w-full">
                <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#E0ECE4] to-[#B8C8C0] border border-border flex items-center justify-center relative shadow-xl overflow-hidden">
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

        {/* eCinema Deep Dive */}
        <section className="w-full py-24 relative overflow-hidden" style={{ backgroundColor: '#002C88' }}>
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
          <div className="container mx-auto px-4 md:px-6 max-w-6xl relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 w-full">
                <div className="aspect-video bg-black rounded-2xl border border-white/20 shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/40 to-black/60 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full text-white flex items-center justify-center shadow-xl" style={{ backgroundColor: '#207450' }}>
                      <MonitorPlay className="h-8 w-8 ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black to-transparent">
                    <h4 className="text-xl font-bold text-white">Advanced React Patterns</h4>
                    <p className="text-sm text-white/70">1h 45m • ₦15,000</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-6 text-white">
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium">
                  <MonitorPlay className="mr-2 h-4 w-4 text-[#FFD400]" />
                  <span>eCinema Platform</span>
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                  Monetize your expertise
                </h2>
                <p className="text-lg text-white/80 leading-relaxed">
                  Turn webinar recordings into a passive income stream. Upload content, set your price, and let konn3ct handle secure playback and Paystack-powered payments.
                </p>
                <ul className="space-y-3 pt-2">
                  {[
                    "DRM-protected, non-downloadable playback",
                    "Integrated Paystack billing (NGN, USD, GHS, KES)",
                    "Viewer engagement analytics & heatmaps",
                    "Coupon codes and bundle pricing",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/90">
                      <CheckCircle className="h-5 w-5" style={{ color: '#84B09C' }} /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations / Compatibility */}
        <section className="w-full py-24">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
                Works with your stack
              </h2>
              <p className="mt-4 text-lg text-text-secondary">
                konn3ct integrates seamlessly with the tools your team already uses.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { name: "Google Calendar", icon: Globe },
                { name: "Slack", icon: MessageSquare },
                { name: "Microsoft Teams", icon: Users },
                { name: "Notion", icon: FileText },
                { name: "Zapier", icon: Wifi },
                { name: "HubSpot", icon: BarChart3 },
                { name: "Jira", icon: Layout },
                { name: "Paystack", icon: Lock },
              ].map((tool, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 4) * 0.08 }}
                  className="bg-surface border border-border rounded-2xl p-6 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/5 flex items-center justify-center">
                    <tool.icon className="h-5 w-5 text-brand-blue" />
                  </div>
                  <span className="font-semibold text-text-primary">{tool.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-24 text-center relative overflow-hidden" style={{ backgroundColor: '#207450' }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,transparent_70%)]" />
          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl mb-6">Experience it yourself</h2>
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              Start collaborating in minutes. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 rounded-xl bg-white text-[#207450] hover:bg-white/90 text-base font-bold shadow-md transition-all">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg" className="h-14 px-8 rounded-xl border-white/30 text-white hover:bg-white/10 text-base font-semibold">
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
