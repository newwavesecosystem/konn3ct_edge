"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Lock, Bell, Globe, Camera,
  Shield, Palette, Monitor, ChevronRight,
  Sun, Moon, Check,
} from "lucide-react";

/* ─── Section metadata ─── */
const sections = [
  { id: "profile",       icon: User,    title: "Profile",       description: "Manage your personal information" },
  { id: "security",      icon: Shield,  title: "Security",      description: "Password and two-factor authentication" },
  { id: "notifications", icon: Bell,    title: "Notifications", description: "Choose what you get notified about" },
  { id: "appearance",    icon: Palette, title: "Appearance",    description: "Customize the look and feel" },
];

/* ─── Toggle switch ─── */
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? "bg-brand-green" : "bg-black/10"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ─── Profile section ─── */
function ProfileSection() {
  return (
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
  );
}

/* ─── Security section ─── */
function SecuritySection() {
  const [twoFA, setTwoFA] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  return (
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
          {/* Password row */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="flex items-center justify-between p-4 hover:bg-black/[0.01] transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                  <Lock className="h-4 w-4 text-text-muted" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Password</p>
                  <p className="text-xs text-text-muted">Last changed 30 days ago</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs"
                onClick={() => setChangingPassword(!changingPassword)}
              >
                {changingPassword ? "Cancel" : "Change"}
              </Button>
            </div>

            <AnimatePresence>
              {changingPassword && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-4">
                    <Input type="password" placeholder="Current password" leftIcon={<Lock className="h-4 w-4" />} />
                    <Input type="password" placeholder="New password" leftIcon={<Lock className="h-4 w-4" />} />
                    <Input type="password" placeholder="Confirm new password" leftIcon={<Lock className="h-4 w-4" />} />
                    <div className="flex justify-end">
                      <Button size="sm" className="rounded-lg h-8 text-xs bg-brand-green hover:bg-[#287854]">
                        Update Password
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Two-factor row */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:bg-black/[0.01] transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                <Shield className="h-4 w-4 text-text-muted" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Two-Factor Authentication</p>
                <p className="text-xs text-text-muted">
                  {twoFA ? "Enabled — your account is extra secure" : "Add an extra layer of security"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className={`rounded-lg h-8 text-xs ${
                twoFA
                  ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                  : "bg-brand-green hover:bg-[#287854]"
              }`}
              onClick={() => setTwoFA(!twoFA)}
            >
              {twoFA ? "Disable" : "Enable"}
            </Button>
          </div>

          {/* Active sessions */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:bg-black/[0.01] transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                <Monitor className="h-4 w-4 text-text-muted" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Active Sessions</p>
                <p className="text-xs text-text-muted">1 active session on this device</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs text-red-500 border-red-500/30 hover:bg-red-500/5">
              Sign Out All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Notifications section ─── */
function NotificationsSection() {
  const [prefs, setPrefs] = useState({
    meetingReminders: true,
    teamUpdates: true,
    emailDigest: false,
    chatMessages: true,
    scheduleChanges: true,
    marketingEmails: false,
  });

  const toggle = (key: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const rows: { key: keyof typeof prefs; title: string; desc: string; icon: React.ReactNode }[] = [
    { key: "meetingReminders",  title: "Meeting Reminders",   desc: "Get notified before upcoming meetings",       icon: <Bell className="h-4 w-4 text-text-muted" /> },
    { key: "teamUpdates",      title: "Team Updates",        desc: "When team members join or leave",              icon: <User className="h-4 w-4 text-text-muted" /> },
    { key: "chatMessages",     title: "Chat Messages",       desc: "Notifications for new chat messages",          icon: <Mail className="h-4 w-4 text-text-muted" /> },
    { key: "scheduleChanges",  title: "Schedule Changes",    desc: "When your schedule is updated",                icon: <Globe className="h-4 w-4 text-text-muted" /> },
    { key: "emailDigest",      title: "Email Digest",        desc: "Receive a daily summary via email",            icon: <Mail className="h-4 w-4 text-text-muted" /> },
    { key: "marketingEmails",  title: "Marketing Emails",    desc: "Product updates and feature announcements",    icon: <Bell className="h-4 w-4 text-text-muted" /> },
  ];

  return (
    <Card className="rounded-2xl border-border/60 bg-surface">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
            <Bell className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Notifications</h3>
            <p className="text-xs text-text-muted">Choose what you get notified about</p>
          </div>
        </div>

        <div className="space-y-1">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between p-4 rounded-xl hover:bg-black/[0.01] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                  {row.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{row.title}</p>
                  <p className="text-xs text-text-muted">{row.desc}</p>
                </div>
              </div>
              <Toggle enabled={prefs[row.key]} onToggle={() => toggle(row.key)} />
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-border/40">
          <Button className="h-10 rounded-xl px-6 bg-brand-green hover:bg-[#287854]">
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Appearance section ─── */
const themes = [
  { id: "light", label: "Light", icon: Sun,  gradient: "from-amber-100 to-orange-100", ring: "ring-amber-400" },
  { id: "dark",  label: "Dark",  icon: Moon, gradient: "from-slate-700 to-slate-900",  ring: "ring-brand-blue" },
  { id: "system", label: "System", icon: Monitor, gradient: "from-slate-200 to-slate-400", ring: "ring-brand-green" },
];

const accentColors = [
  { id: "green",  color: "bg-brand-green" },
  { id: "blue",   color: "bg-brand-blue" },
  { id: "purple", color: "bg-purple-500" },
  { id: "rose",   color: "bg-rose-500" },
  { id: "amber",  color: "bg-amber-500" },
  { id: "cyan",   color: "bg-cyan-500" },
];

function AppearanceSection() {
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState("green");
  const [compactMode, setCompactMode] = useState(false);
  const [animations, setAnimations] = useState(true);

  return (
    <Card className="rounded-2xl border-border/60 bg-surface">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
            <Palette className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Appearance</h3>
            <p className="text-xs text-text-muted">Customize the look and feel</p>
          </div>
        </div>

        {/* Theme picker */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-text-primary">Theme</p>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => {
              const Icon = t.icon;
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                    active
                      ? `border-brand-green ring-2 ${t.ring} shadow-md`
                      : "border-border/60 hover:border-border"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${t.gradient}`}>
                    <Icon className="h-5 w-5 text-white drop-shadow" />
                  </div>
                  <span className="text-xs font-medium text-text-primary">{t.label}</span>
                  {active && (
                    <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-green">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent color picker */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-text-primary">Accent Color</p>
          <div className="flex gap-3">
            {accentColors.map((c) => (
              <button
                key={c.id}
                onClick={() => setAccent(c.id)}
                className={`relative h-8 w-8 rounded-full ${c.color} transition-all hover:scale-110 ${
                  accent === c.id ? "ring-2 ring-offset-2 ring-offset-surface ring-text-primary scale-110" : ""
                }`}
              >
                {accent === c.id && (
                  <Check className="h-3.5 w-3.5 text-white absolute inset-0 m-auto" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-1 border-t border-border/40 pt-4">
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-black/[0.01] transition-colors">
            <div>
              <p className="text-sm font-semibold text-text-primary">Compact Mode</p>
              <p className="text-xs text-text-muted">Reduce spacing and padding</p>
            </div>
            <Toggle enabled={compactMode} onToggle={() => setCompactMode(!compactMode)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-black/[0.01] transition-colors">
            <div>
              <p className="text-sm font-semibold text-text-primary">Animations</p>
              <p className="text-xs text-text-muted">Enable smooth transitions and effects</p>
            </div>
            <Toggle enabled={animations} onToggle={() => setAnimations(!animations)} />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border/40">
          <Button className="h-10 rounded-xl px-6 bg-brand-green hover:bg-[#287854]">
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main page ─── */
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Settings</h1>
        <p className="text-text-muted mt-1">Manage your account preferences.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 rounded-xl p-3.5 text-left transition-all ${
                  isActive
                    ? "bg-brand-green/10 border border-brand-green/20 shadow-sm"
                    : "hover:bg-black/[0.02] border border-transparent"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    isActive ? "bg-brand-green text-white" : "bg-black/[0.04] text-text-muted"
                  }`}
                >
                  <section.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? "text-brand-green" : "text-text-primary"}`}>
                    {section.title}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">{section.description}</p>
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-green" : "text-text-muted/40"}`} />
              </button>
            );
          })}
        </motion.div>

        {/* Right: Active Section Content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === "profile" && <ProfileSection />}
              {activeSection === "security" && <SecuritySection />}
              {activeSection === "notifications" && <NotificationsSection />}
              {activeSection === "appearance" && <AppearanceSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
