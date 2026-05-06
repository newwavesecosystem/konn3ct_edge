"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import {
  CreditCard, Check, Zap, Crown, ArrowRight,
  Shield, Users, Film, Clock, Infinity
} from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "₦0",
    period: "/mo",
    description: "Perfect for personal use",
    features: ["3 meeting rooms", "720p video", "40 min limit", "5 recordings", "Email support"],
    color: "border-border",
    buttonVariant: "outline" as const,
    buttonLabel: "Current Plan",
    current: true,
    icon: Zap,
  },
  {
    name: "Pro",
    price: "₦4,900",
    period: "/mo",
    description: "Best for small teams",
    features: ["Unlimited rooms", "1080p HD video", "No time limit", "Unlimited recordings", "Priority support", "Custom branding"],
    color: "border-brand-green",
    buttonVariant: "default" as const,
    buttonLabel: "Upgrade to Pro",
    current: false,
    popular: true,
    icon: Crown,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: ["Everything in Pro", "4K video", "SSO & SAML", "Dedicated account manager", "99.99% SLA", "Custom integrations"],
    color: "border-brand-blue",
    buttonVariant: "outline" as const,
    buttonLabel: "Contact Sales",
    current: false,
    icon: Shield,
  },
];

const invoices = [
  { date: "May 1, 2026", amount: "₦0.00", status: "Paid", plan: "Free" },
  { date: "Apr 1, 2026", amount: "₦0.00", status: "Paid", plan: "Free" },
  { date: "Mar 1, 2026", amount: "₦0.00", status: "Paid", plan: "Free" },
];

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Billing</h1>
        <p className="text-text-muted mt-1">Manage your subscription and billing details.</p>
      </div>

      {/* Current Plan Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="rounded-2xl border-brand-green/30 bg-brand-green/5 overflow-hidden">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green text-white shadow-md">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-text-primary">Free Plan</h2>
                  <span className="px-2 py-0.5 rounded-md bg-brand-green/10 text-brand-green text-[11px] font-bold uppercase">Active</span>
                </div>
                <p className="text-sm text-text-muted mt-0.5">Your next billing date is <strong>Jun 1, 2026</strong></p>
              </div>
            </div>
            <Button variant="outline" className="h-10 rounded-xl px-4 border-brand-green/30 text-brand-green hover:bg-brand-green hover:text-white transition-all">
              Manage Subscription
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Plans */}
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-5">Choose a Plan</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`rounded-2xl ${plan.color} bg-surface overflow-hidden relative h-full flex flex-col ${plan.popular ? "shadow-lg shadow-brand-green/10" : ""}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl bg-brand-green text-white text-[11px] font-bold uppercase">
                    Popular
                  </div>
                )}
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      plan.current ? "bg-black/[0.04] text-text-muted" : plan.popular ? "bg-brand-green text-white" : "bg-brand-blue/10 text-brand-blue"
                    }`}>
                      <plan.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
                      <p className="text-xs text-text-muted">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-text-primary">{plan.price}</span>
                    <span className="text-text-muted text-sm">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-text-secondary">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                          plan.popular ? "bg-brand-green/10 text-brand-green" : "bg-black/[0.04] text-text-muted"
                        }`}>
                          <Check className="h-3 w-3" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.buttonVariant}
                    className={`w-full h-11 rounded-xl font-semibold ${
                      plan.popular ? "bg-brand-green hover:bg-[#287854] shadow-[0_6px_20px_rgba(32,116,80,0.2)]" : ""
                    } ${plan.current ? "pointer-events-none opacity-60" : ""}`}
                    disabled={plan.current}
                  >
                    {plan.buttonLabel}
                    {!plan.current && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Invoices */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-xl font-bold text-text-primary mb-5">Invoice History</h2>
        <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
          <CardContent className="p-0">
            <div className="hidden sm:grid grid-cols-4 gap-4 px-6 py-3 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <div>Date</div>
              <div>Plan</div>
              <div>Amount</div>
              <div className="text-right">Status</div>
            </div>
            {invoices.map((inv, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 items-center px-6 py-4 border-b border-border/30 last:border-b-0 hover:bg-black/[0.015] transition-colors">
                <span className="text-sm font-medium text-text-primary">{inv.date}</span>
                <span className="text-sm text-text-muted">{inv.plan}</span>
                <span className="text-sm font-semibold text-text-primary">{inv.amount}</span>
                <span className="text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-green/10 text-brand-green text-xs font-semibold">
                    <Check className="h-3 w-3" /> {inv.status}
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
