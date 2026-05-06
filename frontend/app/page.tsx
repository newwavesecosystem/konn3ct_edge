"use client"

import { PublicNavbar } from "@/components/layout/PublicNavbar"
import { PublicFooter } from "@/components/layout/PublicFooter"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { motion } from "framer-motion"
import { 
  CheckCircle, Shield, Zap, Users, ArrowRight, Video, 
  MessageSquare, Layout, Lock, Globe, MonitorPlay, Sparkles, PieChart, Star
} from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans overflow-hidden">
      <PublicNavbar />

      <main className="flex-1 pt-32 pb-16">
        {/* HERO SECTION */}
        <div className="absolute top-0 left-0 w-full h-[80vh] bg-gradient-to-b from-[#E0ECE4]/40 to-transparent -z-10" />
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-brand-green/10 blur-[100px] -z-10" />
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-blue/5 blur-[120px] -z-10" />

        <section className="w-full relative z-10 pb-24">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8 pt-10 md:pt-20">
              <motion.div
                className="flex-1 space-y-8 text-center lg:text-left"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <div className="inline-flex items-center rounded-full border border-brand-green/20 bg-brand-green/5 px-3 py-1 text-sm font-medium text-brand-green">
                  <Zap className="mr-2 h-4 w-4 text-[#FFD400]" />
                  <span className="text-sm">konn3ct version 2.0 is live</span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-[4.5rem] leading-[1.1]">
                  Premium Video <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                    Collaboration.
                  </span>
                </h1>

                <p className="mx-auto lg:mx-0 max-w-[600px] text-lg text-text-secondary leading-relaxed">
                  Connect, record, and collaborate securely with modern tools built for enterprise and beyond. Experience crystal-clear audio and video that brings your team together, anywhere.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                  <Link href="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto text-base h-14 px-8 rounded-xl bg-brand-green hover:bg-[#287854] shadow-[0_8px_24px_rgba(32,116,80,0.25)] hover:shadow-[0_12px_32px_rgba(32,116,80,0.35)] transition-all">
                      Start for free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/demo" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto text-base h-14 px-8 rounded-xl border-border-strong/20 hover:border-brand-blue hover:text-brand-blue transition-colors">
                      Book a demo
                    </Button>
                  </Link>
                </div>

                <div className="pt-6 flex items-center justify-center lg:justify-start gap-6 text-sm text-text-muted">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-brand-green" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-brand-blue" />
                    <span>End-to-end encrypted</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="flex-1 w-full max-w-2xl lg:max-w-none relative"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                <div className="relative rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl shadow-brand-blue/10">
                  <div className="absolute top-0 left-0 w-full h-12 bg-[#F8F8F8] border-b border-border flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#CC505C]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#FFD400]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#207450]"></div>
                  </div>
                  <div className="w-full h-auto mt-12 bg-gradient-to-br from-brand-blue to-brand-green aspect-video flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="grid grid-cols-3 gap-4 p-6 w-full h-full relative z-10">
                       <div className="bg-white/10 rounded-xl backdrop-blur-md border border-white/20 flex items-center justify-center relative overflow-hidden">
                         <div className="absolute bottom-2 left-2 text-white text-xs font-semibold bg-black/40 px-2 py-0.5 rounded">You</div>
                       </div>
                       <div className="bg-white/10 rounded-xl backdrop-blur-md border border-white/20 flex items-center justify-center relative overflow-hidden">
                         <div className="absolute bottom-2 left-2 text-white text-xs font-semibold bg-black/40 px-2 py-0.5 rounded">Sarah K.</div>
                         <div className="absolute top-2 right-2 bg-[#FFD400] text-black text-xs px-1.5 py-0.5 rounded shadow">👏</div>
                       </div>
                       <div className="bg-white/10 rounded-xl backdrop-blur-md border border-white/20 flex items-center justify-center relative overflow-hidden">
                         <div className="absolute bottom-2 left-2 text-white text-xs font-semibold bg-black/40 px-2 py-0.5 rounded">Alex D.</div>
                       </div>
                    </div>
                  </div>
                  <motion.div
                    className="absolute bottom-6 right-6 bg-surface p-4 rounded-xl border border-border shadow-xl flex items-center gap-4"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1, duration: 0.5 }}
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-blue flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">Weekly Sync</p>
                      <p className="text-xs text-text-muted">12 Participants</p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* TRUSTED BY SECTION */}
        <section className="w-full py-12 border-y border-border bg-black/[0.01]">
          <div className="container mx-auto px-4 md:px-6">
            <p className="text-center text-sm font-semibold text-text-muted mb-8 uppercase tracking-widest">
              Trusted by innovative teams worldwide
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale">
              <div className="text-2xl font-bold flex items-center gap-2"><Globe className="h-6 w-6"/> TechFlow</div>
              <div className="text-2xl font-bold flex items-center gap-2"><PieChart className="h-6 w-6"/> DataCorp</div>
              <div className="text-2xl font-bold flex items-center gap-2"><Layout className="h-6 w-6"/> DesignSyndicate</div>
              <div className="text-2xl font-bold flex items-center gap-2"><MonitorPlay className="h-6 w-6"/> MediaPulse</div>
            </div>
          </div>
        </section>

        {/* FEATURE HIGHLIGHTS */}
        <section className="w-full py-24 relative">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
                Everything you need for productive meetings
              </h2>
              <p className="mt-4 text-lg text-text-secondary">
                konn3ct is built to make collaboration seamless, whether you're hosting a 1:1, a large webinar, or sharing a recorded session.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: Video,
                  title: "Secure Video Meetings",
                  desc: "Crystal clear 1080p HD video with noise cancellation and seamless screen sharing."
                },
                {
                  icon: MessageSquare,
                  title: "Interactive Webinars",
                  desc: "Host up to 10,000 attendees with Q&A, live polls, and hand-raising features."
                },
                {
                  icon: Users,
                  title: "Teams & Rooms",
                  desc: "Dedicated permanent rooms for your projects. Jump in and out without generating new links."
                },
                {
                  icon: Layout,
                  title: "In-Meeting Docs",
                  desc: "Collaborate on documents and whiteboards live during your calls without switching tabs."
                },
                {
                  icon: Sparkles,
                  title: "AI Captions & Summaries",
                  desc: "Get real-time translated captions and automatic AI-generated meeting minutes sent to your email."
                },
                {
                  icon: MonitorPlay,
                  title: "eCinema Recordings",
                  desc: "Host and monetize your past webinars or training sessions with built-in paywalls."
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-surface border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-green/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-6 w-6 text-brand-green" />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-3">{feature.title}</h3>
                  <p className="text-text-muted leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* eCINEMA SHOWCASE */}
        <section className="w-full py-24 bg-gradient-to-br from-[#001c57] to-brand-blue text-white overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
          <div className="container mx-auto px-4 md:px-6 max-w-6xl relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium">
                  <MonitorPlay className="mr-2 h-4 w-4 text-[#FFD400]" />
                  <span>Introducing eCinema</span>
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                  Monetize your knowledge.
                </h2>
                <p className="text-lg text-white/80 leading-relaxed">
                  Turn your recorded webinars and training sessions into an evergreen revenue stream. Upload recordings, set a price, and accept global payments via Paystack natively within konn3ct.
                </p>
                <ul className="space-y-3 pt-4">
                  <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-brand-green-muted" /> Secure, non-downloadable playback</li>
                  <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-brand-green-muted" /> Built-in Paystack billing</li>
                  <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-brand-green-muted" /> Engagement analytics</li>
                </ul>
              </div>
              <div className="flex-1 w-full relative">
                <div className="aspect-video bg-black rounded-2xl border border-white/20 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/40 to-black/60 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-brand-green/90 text-white flex items-center justify-center cursor-pointer group-hover:scale-110 transition-transform shadow-xl">
                      <MonitorPlay className="h-8 w-8 ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black to-transparent">
                    <h4 className="text-xl font-bold">Advanced React Patterns - Masterclass</h4>
                    <p className="text-sm text-white/70">1h 45m • ₦15,000</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ENTERPRISE SECURITY */}
        <section className="w-full py-24 relative">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="bg-surface border border-border rounded-3xl p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 shadow-sm relative overflow-hidden">
              <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] rounded-full bg-brand-green/5 blur-[80px] pointer-events-none" />
              
              <div className="flex-1 space-y-6 relative z-10">
                <h2 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
                  Enterprise-grade security, by default.
                </h2>
                <p className="text-lg text-text-secondary leading-relaxed">
                  Your conversations are your business. konn3ct secures all meetings with end-to-end encryption, robust access controls, and compliance with global data protection standards.
                </p>
                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div className="flex flex-col gap-2">
                    <Lock className="h-6 w-6 text-brand-blue" />
                    <span className="font-semibold text-text-primary">E2E Encryption</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Shield className="h-6 w-6 text-brand-blue" />
                    <span className="font-semibold text-text-primary">SSO & SAML</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Globe className="h-6 w-6 text-brand-blue" />
                    <span className="font-semibold text-text-primary">Data Residency</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Users className="h-6 w-6 text-brand-blue" />
                    <span className="font-semibold text-text-primary">Role-based Access</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full flex justify-center relative z-10">
                <div className="w-64 h-64 bg-gradient-to-br from-brand-blue to-brand-green rounded-full flex items-center justify-center p-1 shadow-2xl relative">
                  <div className="absolute inset-0 rounded-full border border-white/20 animate-[spin_10s_linear_infinite]" />
                  <div className="w-full h-full bg-surface rounded-full flex items-center justify-center flex-col gap-3">
                    <Shield className="h-16 w-16 text-brand-green" />
                    <span className="font-bold text-brand-blue">100% Secure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="w-full py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-green -z-20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0,transparent_100%)] -z-10" />
          <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl mb-6">
              Ready to elevate your meetings?
            </h2>
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              Join thousands of teams who have already upgraded their collaboration experience. Get started for free today.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 rounded-xl bg-white text-brand-green hover:bg-white/90 text-base font-bold shadow-xl hover:shadow-2xl transition-all">
                  Create Free Account
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="h-14 px-8 rounded-xl border-white/30 text-white hover:bg-white/10 text-base font-semibold">
                  View Pricing
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
