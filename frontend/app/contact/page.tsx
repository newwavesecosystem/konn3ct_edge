"use client"

import { PublicNavbar } from "@/components/layout/PublicNavbar"
import { PublicFooter } from "@/components/layout/PublicFooter"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import Link from "next/link"
import { motion } from "framer-motion"
import { Mail, MessageSquare, MapPin, Phone, ArrowRight, Send } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans overflow-hidden">
      <PublicNavbar />

      <main className="flex-1 pt-32 pb-16">
        {/* Header */}
        <section className="w-full relative z-10 pb-16">
          <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-[#E0ECE4]/40 to-transparent -z-10" />
          <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl md:text-6xl"
            >
              Let's build something <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                great together
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto"
            >
              Have questions about Enterprise pricing, custom integrations, or just want to say hi? We'd love to hear from you.
            </motion.p>
          </div>
        </section>

        <section className="w-full pb-24 relative z-10">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="flex flex-col lg:flex-row gap-16">
              
              {/* Contact Form */}
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 bg-surface rounded-3xl border border-border p-8 md:p-10 shadow-xl shadow-brand-blue/5"
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-text-primary mb-2">Send us a message</h3>
                  <p className="text-text-secondary">We'll get back to you within 24 hours.</p>
                </div>

                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="text-sm font-semibold text-text-primary">First Name</label>
                      <Input id="firstName" placeholder="John" className="h-12 bg-black/[0.02] border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="lastName" className="text-sm font-semibold text-text-primary">Last Name</label>
                      <Input id="lastName" placeholder="Doe" className="h-12 bg-black/[0.02] border-border/60" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-semibold text-text-primary">Work Email</label>
                    <Input id="email" type="email" placeholder="john@company.com" className="h-12 bg-black/[0.02] border-border/60" />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-semibold text-text-primary">Subject</label>
                    <select id="subject" className="flex h-12 w-full rounded-xl border border-border/60 bg-black/[0.02] px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:border-transparent transition-all">
                      <option value="">Select a topic</option>
                      <option value="sales">Sales & Enterprise Pricing</option>
                      <option value="support">Technical Support</option>
                      <option value="partnership">Partnership Inquiry</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-semibold text-text-primary">Message</label>
                    <textarea 
                      id="message" 
                      rows={5} 
                      placeholder="Tell us how we can help..."
                      className="flex w-full rounded-xl border border-border/60 bg-black/[0.02] px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:border-transparent transition-all resize-none"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full h-14 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-lg text-base font-bold">
                    Send Message
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </motion.div>

              {/* Contact Info */}
              <motion.div 
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex-1 space-y-10"
              >
                <div>
                  <h3 className="text-2xl font-bold text-text-primary mb-6">Other ways to connect</h3>
                  
                  <div className="space-y-8">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                        <Mail className="h-6 w-6 text-brand-blue" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-text-primary mb-1">Email us</h4>
                        <p className="text-text-secondary mb-2">For general inquiries and support.</p>
                        <a href="mailto:hello@konn3ct.io" className="text-brand-green font-semibold hover:underline">hello@konn3ct.io</a>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-6 w-6 text-brand-blue" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-text-primary mb-1">Live Chat</h4>
                        <p className="text-text-secondary mb-2">Available Mon-Fri, 9am-5pm WAT.</p>
                        <button className="text-brand-green font-semibold hover:underline">Open chat bubble</button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-6 w-6 text-brand-blue" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-text-primary mb-1">HQ Address</h4>
                        <p className="text-text-secondary">
                          12 Innovation Drive<br />
                          Victoria Island, Lagos<br />
                          Nigeria
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-green/5 border border-brand-green/20 rounded-2xl p-6">
                  <h4 className="text-lg font-bold text-brand-green mb-2">Looking for a demo?</h4>
                  <p className="text-text-secondary mb-4">Schedule a 1-on-1 walkthrough of konn3ct with our product experts.</p>
                  <Button variant="outline" className="w-full h-12 rounded-xl border-brand-green text-brand-green hover:bg-brand-green hover:text-white transition-all">
                    Book a demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

              </motion.div>

            </div>
          </div>
        </section>

        {/* Trust Badges */}
        <section className="w-full py-16 border-t border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { value: "< 2 hrs", label: "Average response time" },
                { value: "98%", label: "Customer satisfaction" },
                { value: "24/7", label: "Emergency support (Enterprise)" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="space-y-2"
                >
                  <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">{stat.value}</p>
                  <p className="text-sm text-text-muted font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-20 text-center relative overflow-hidden" style={{ backgroundColor: '#207450' }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,transparent_70%)]" />
          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl mb-4">
              Want to try before you talk?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              Start with a free account and explore konn3ct at your own pace.
            </p>
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 rounded-xl bg-white text-[#207450] hover:bg-white/90 text-base font-bold shadow-md transition-all">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
