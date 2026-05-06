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
      </main>

      <PublicFooter />
    </div>
  )
}
