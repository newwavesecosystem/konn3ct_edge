"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion } from "framer-motion";
import {
  User, Mail, Lock, Bell, Globe, Camera,
  Shield, Palette, Monitor, ChevronRight
} from "lucide-react";

const sections = [
  {
    id: "profile",
    icon: User,
    title: "Profile",
    description: "Manage your personal information",
  },
  {
    id: "security",
    icon: Shield,
    title: "Security",
    description: "Password and two-factor authentication",
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications",
    description: "Choose what you get notified about",
  },
  {
    id: "appearance",
    icon: Palette,
    title: "Appearance",
    description: "Customize the look and feel",
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Settings</h1>
        <p className="text-text-muted mt-1">Manage your account preferences.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Navigation Cards */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          {sections.map((section, i) => (
            <button
              key={section.id}
              className={`w-full flex items-center gap-3 rounded-xl p-3.5 text-left transition-all ${i === 0
                  ? "bg-brand-green/10 border border-brand-green/20 shadow-sm"
                  : "hover:bg-black/[0.02] border border-transparent"
                }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${i === 0 ? "bg-brand-green text-white" : "bg-black/[0.04] text-text-muted"
                }`}>
                <section.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${i === 0 ? "text-brand-green" : "text-text-primary"}`}>{section.title}</p>
                <p className="text-[11px] text-text-muted truncate">{section.description}</p>
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 ${i === 0 ? "text-brand-green" : "text-text-muted/40"}`} />
            </button>
          ))}
        </motion.div>

        {/* Right: Active Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Profile Card */}
          <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-brand-blue to-brand-green relative">
              <div className="absolute -bottom-10 left-6">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-green text-white text-xl font-bold shadow-xl ring-4 ring-surface">
                    AD
                  </div>
                  <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface border border-border shadow-sm hover:bg-black/[0.04] transition-colors">
                    <Camera className="h-3.5 w-3.5 text-text-muted" />
                  </button>
                </div>
              </div>
            </div>
            <CardContent className="pt-14 p-6">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-text-muted" />
                      Display Name
                    </label>
                    <Input defaultValue="Alex Doe" leftIcon={<User className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-text-muted" />
                      Email Address
                    </label>
                    <Input defaultValue="alex@konn3ct.io" leftIcon={<Mail className="h-4 w-4" />} disabled />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-text-muted" />
                      Timezone
                    </label>
                    <Input defaultValue="WAT (UTC+1)" leftIcon={<Globe className="h-4 w-4" />} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5 text-text-muted" />
                      Language
                    </label>
                    <Input defaultValue="English" leftIcon={<Monitor className="h-4 w-4" />} />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/40">
                  <Button className="h-10 rounded-xl px-6 bg-brand-green hover:bg-[#287854]">
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="rounded-2xl border-border/60 bg-surface">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/10">
                  <Shield className="h-5 w-5 text-brand-blue" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Security</h3>
                  <p className="text-xs text-text-muted">Manage your password and security settings</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:bg-black/[0.01] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                      <Lock className="h-4 w-4 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Password</p>
                      <p className="text-xs text-text-muted">Last changed 30 days ago</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs">
                    Change
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:bg-black/[0.01] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                      <Shield className="h-4 w-4 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Two-Factor Authentication</p>
                      <p className="text-xs text-text-muted">Add an extra layer of security</p>
                    </div>
                  </div>
                  <Button size="sm" className="rounded-lg h-8 text-xs bg-brand-green hover:bg-[#287854]">
                    Enable
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
