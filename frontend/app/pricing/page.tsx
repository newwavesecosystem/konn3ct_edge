"use client"

import { PublicNavbar } from "@/components/layout/PublicNavbar"
import { PublicFooter } from "@/components/layout/PublicFooter"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check, X, Zap, Crown, Shield } from "lucide-react"

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "₦0",
      period: "forever",
      description: "Perfect for personal use and small meetups",
      features: [
        "Up to 40 minutes per meeting",
        "100 participants max",
        "3 permanent rooms",
        "720p HD Video",
        "Basic team chat",
        "5 cloud recordings (7 days expiry)",
      ],
      notIncluded: [
        "eCinema monetization",
        "AI Meeting Assistant",
        "Custom branding",
        "SSO & SAML",
      ],
      icon: Zap,
      color: "border-border",
      buttonText: "Start for free",
      buttonVariant: "outline" as const,
      popular: false
    },
    {
      name: "Pro",
      price: "₦4,900",
      period: "per user/month",
      description: "Best for growing teams and creators",
      features: [
        "Unlimited meeting duration",
        "300 participants max",
        "Unlimited rooms",
        "1080p HD Video",
        "Advanced team chat & file sharing",
        "Unlimited cloud recordings",
        "eCinema monetization (5% fee)",
        "AI Meeting Assistant",
        "Custom branding",
      ],
      notIncluded: [
        "SSO & SAML",
        "Dedicated Account Manager",
      ],
      icon: Crown,
      color: "border-brand-green",
      buttonText: "Start 14-day trial",
      buttonVariant: "default" as const,
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "annual billing",
      description: "For large organizations with strict security",
      features: [
        "Unlimited meeting duration",
        "10,000+ webinar attendees",
        "Unlimited rooms",
        "4K Video support",
        "Advanced team chat & file sharing",
        "Unlimited cloud recordings (never expire)",
        "eCinema monetization (0% fee)",
        "Advanced AI features",
        "White-label branding",
        "SSO & SAML integration",
        "Dedicated Account Manager",
        "99.99% Uptime SLA",
      ],
      notIncluded: [],
      icon: Shield,
      color: "border-brand-blue",
      buttonText: "Contact Sales",
      buttonVariant: "outline" as const,
      popular: false
    }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans overflow-hidden">
      <PublicNavbar />

      <main className="flex-1 pt-32 pb-16">
        {/* Header */}
        <section className="w-full relative z-10 pb-16">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-brand-green/10 blur-[100px] -z-10" />
          <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl md:text-6xl"
            >
              Simple, transparent <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                pricing for everyone
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto"
            >
              Whether you're hosting quick 1:1s or large-scale paid webinars, we have a plan that scales with your needs.
            </motion.p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="w-full pb-24 relative z-10">
          <div className="container mx-auto px-4 md:px-6 max-w-7xl">
            <div className="grid md:grid-cols-3 gap-8">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className={`relative flex flex-col bg-surface rounded-3xl border ${plan.color} p-8 shadow-sm ${plan.popular ? 'shadow-xl shadow-brand-green/10 md:-translate-y-4' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-green text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.popular ? 'bg-brand-green text-white' : 'bg-black/[0.04] text-text-primary'}`}>
                      <plan.icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-2xl font-bold text-text-primary">{plan.name}</h3>
                  </div>

                  <p className="text-sm text-text-secondary mb-6 h-10">{plan.description}</p>

                  <div className="mb-8">
                    <span className="text-4xl font-extrabold text-text-primary">{plan.price}</span>
                    {plan.period && <span className="text-text-muted ml-1">/{plan.period}</span>}
                  </div>

                  <Link href={plan.name === "Enterprise" ? "/contact" : "/signup"} className="w-full mt-auto mb-8">
                    <Button 
                      variant={plan.buttonVariant} 
                      className={`w-full h-12 rounded-xl text-base font-bold ${plan.popular ? 'bg-brand-green hover:bg-[#287854] shadow-lg' : ''}`}
                    >
                      {plan.buttonText}
                    </Button>
                  </Link>

                  <div className="space-y-4 flex-1">
                    <p className="text-sm font-semibold text-text-primary uppercase tracking-wider">What's included</p>
                    <ul className="space-y-3">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm text-text-secondary">
                          <Check className="w-5 h-5 text-brand-green shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.notIncluded.length > 0 && (
                      <>
                        <div className="h-px w-full bg-border my-4" />
                        <ul className="space-y-3 opacity-60">
                          {plan.notIncluded.map((feature, j) => (
                            <li key={j} className="flex items-start gap-3 text-sm text-text-muted">
                              <X className="w-5 h-5 shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="w-full pb-24 relative z-10">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold tracking-tight text-text-primary">Compare all features</h2>
            </div>
            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-bold text-text-primary">Feature</th>
                    <th className="p-4 font-bold text-text-primary text-center">Free</th>
                    <th className="p-4 font-bold text-center" style={{ color: '#207450' }}>Pro</th>
                    <th className="p-4 font-bold text-text-primary text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Meeting duration", free: "40 min", pro: "Unlimited", ent: "Unlimited" },
                    { feature: "Max participants", free: "100", pro: "300", ent: "10,000+" },
                    { feature: "Video quality", free: "720p", pro: "1080p", ent: "4K" },
                    { feature: "Rooms", free: "3", pro: "Unlimited", ent: "Unlimited" },
                    { feature: "Cloud recordings", free: "5 (7d)", pro: "Unlimited", ent: "Unlimited (never expire)" },
                    { feature: "eCinema monetization", free: "—", pro: "5% fee", ent: "0% fee" },
                    { feature: "AI Meeting Assistant", free: "—", pro: "✓", ent: "✓ Advanced" },
                    { feature: "Custom branding", free: "—", pro: "✓", ent: "White-label" },
                    { feature: "SSO & SAML", free: "—", pro: "—", ent: "✓" },
                    { feature: "Dedicated Account Manager", free: "—", pro: "—", ent: "✓" },
                    { feature: "Uptime SLA", free: "—", pro: "99.9%", ent: "99.99%" },
                  ].map((row, i) => (
                    <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-black/[0.01]' : ''}`}>
                      <td className="p-4 font-medium text-text-primary">{row.feature}</td>
                      <td className="p-4 text-center text-text-secondary">{row.free}</td>
                      <td className="p-4 text-center font-semibold" style={{ color: '#207450' }}>{row.pro}</td>
                      <td className="p-4 text-center text-text-secondary">{row.ent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full py-24 bg-black/[0.02] border-t border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold tracking-tight text-text-primary">Frequently asked questions</h2>
            </div>
            <div className="space-y-6">
              {[
                {
                  q: "How does the eCinema monetization work?",
                  a: "With a Pro or Enterprise plan, you can record a session and instantly turn it into paid content. We integrate with Paystack so viewers can pay locally or globally. Pro plans have a 5% transaction fee, while Enterprise has 0%."
                },
                {
                  q: "Can I cancel my subscription anytime?",
                  a: "Yes. There are no long-term contracts for the Pro plan. You can cancel your subscription at any time from your billing settings, and you won't be billed again."
                },
                {
                  q: "Do my participants need an account to join?",
                  a: "No! Guests can join your meetings and webinars directly via their browser simply by clicking your invite link. No downloads or sign-ups required."
                },
                {
                  q: "What forms of payment do you accept?",
                  a: "We process all payments securely through Paystack and Stripe, supporting all major credit cards, debit cards, bank transfers, and mobile money options across Africa and globally."
                },
                {
                  q: "Is there a discount for annual billing?",
                  a: "Yes! Annual billing saves you 20% compared to monthly billing. Contact our sales team for custom Enterprise pricing and volume discounts."
                },
                {
                  q: "Can I switch plans later?",
                  a: "Absolutely. You can upgrade or downgrade your plan at any time. When upgrading, the difference is pro-rated. When downgrading, the change takes effect at the next billing cycle."
                }
              ].map((faq, i) => (
                <div key={i} className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
                  <h4 className="text-lg font-bold text-text-primary mb-2">{faq.q}</h4>
                  <p className="text-text-secondary leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-24 text-center relative overflow-hidden" style={{ backgroundColor: '#207450' }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,transparent_70%)]" />
          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl mb-6">Ready to get started?</h2>
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              Start with the free plan — no credit card required. Upgrade when you're ready.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 rounded-xl bg-white text-[#207450] hover:bg-white/90 text-base font-bold shadow-md transition-all">
                  Create Free Account
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg" className="h-14 px-8 rounded-xl border-white/30 text-white hover:bg-white/10 text-base font-semibold">
                  Contact Sales
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
