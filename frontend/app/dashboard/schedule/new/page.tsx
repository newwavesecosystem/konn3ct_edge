"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft, Calendar as CalendarIcon, Clock, Users,
  Video, MonitorPlay, AlignLeft, Globe, Mail, X, Check,
  ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { MOCK_ROOMS } from "@/lib/mock/schedule";
import { Select } from "@/components/ui/Select";

// ─── helpers ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function fmt12(h: number, m: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}
function addMinutes(h: number, m: number, delta: number) {
  let totalMins = h * 60 + m + delta;
  totalMins = ((totalMins % 1440) + 1440) % 1440;
  return { h: Math.floor(totalMins / 60), m: totalMins % 60 };
}

// ─── mini calendar ───────────────────────────────────────────────────────────
interface CalendarPickerProps {
  value: Date | null;
  onChange: (d: Date) => void;
  minDate?: Date;
}
function CalendarPicker({ value, onChange, minDate }: CalendarPickerProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(value?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value?.getMonth() ?? today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isSelected = (day: number) =>
    value?.getFullYear() === viewYear &&
    value?.getMonth() === viewMonth &&
    value?.getDate() === day;

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return d < min;
  };

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className="w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={prevMonth}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-black/[0.05] transition-colors text-text-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-text-primary">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-black/[0.05] transition-colors text-text-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-text-muted py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const disabled = isDisabled(day);
          const selected = isSelected(day);
          const todayCell = isToday(day);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(new Date(viewYear, viewMonth, day))}
              className={`h-9 w-full rounded-lg text-sm font-medium transition-all
                ${disabled ? "text-text-muted/30 cursor-not-allowed" : "cursor-pointer"}
                ${selected
                  ? "bg-brand-green text-white shadow-md shadow-brand-green/25"
                  : todayCell && !disabled
                    ? "border border-brand-green/40 text-brand-green font-bold hover:bg-brand-green/10"
                    : !disabled
                      ? "hover:bg-brand-green/10 text-text-primary"
                      : ""}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── time scrollers ──────────────────────────────────────────────────────────
interface TimePickerProps {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
  label: string;
}
function TimePicker({ hour, minute, onChange, label }: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  // scroll selected into view
  useEffect(() => {
    const ITEM_H = 40;
    if (hourRef.current) hourRef.current.scrollTop = hour * ITEM_H;
  }, []);
  useEffect(() => {
    const ITEM_H = 40;
    if (minRef.current) {
      const idx = minutes.indexOf(minute) === -1 ? 0 : minutes.indexOf(minute);
      minRef.current.scrollTop = idx * ITEM_H;
    }
  }, []);

  const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const ITEM_H = 40;
    const idx = Math.round((e.currentTarget.scrollTop) / ITEM_H);
    if (hours[idx] !== undefined) onChange(hours[idx], minute);
  };
  const handleMinScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const ITEM_H = 40;
    const idx = Math.round((e.currentTarget.scrollTop) / ITEM_H);
    if (minutes[idx] !== undefined) onChange(hour, minutes[idx]);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider text-center">{label}</span>
      {/* Display badge */}
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className="text-2xl font-extrabold text-text-primary tabular-nums">{String(hour12).padStart(2, "0")}</span>
        <span className="text-lg font-bold text-text-muted">:</span>
        <span className="text-2xl font-extrabold text-text-primary tabular-nums">{String(minute).padStart(2, "0")}</span>
        <span className="text-sm font-bold text-brand-green ml-1">{ampm}</span>
      </div>

      {/* Scroll wheels */}
      <div className="flex items-center gap-2 justify-center">
        {/* Hours */}
        <div className="relative">
          <div
            ref={hourRef}
            onScroll={handleHourScroll}
            className="h-[120px] w-14 overflow-y-scroll scroll-smooth snap-y snap-mandatory no-scrollbar rounded-xl border border-border/60 bg-black/[0.02]"
            style={{ scrollSnapType: "y mandatory" }}
          >
            {hours.map(h => (
              <div
                key={h}
                onClick={() => {
                  onChange(h, minute);
                  if (hourRef.current) hourRef.current.scrollTop = h * 40;
                }}
                style={{ scrollSnapAlign: "center", height: 40 }}
                className={`flex items-center justify-center text-sm font-semibold cursor-pointer transition-all
                  ${h === hour ? "text-brand-green" : "text-text-muted hover:text-text-primary"}`}
              >
                {String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}
              </div>
            ))}
          </div>
          {/* gradient overlays */}
          <div className="pointer-events-none absolute top-0 left-0 w-full h-8 rounded-t-xl bg-gradient-to-b from-surface to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 w-full h-8 rounded-b-xl bg-gradient-to-t from-surface to-transparent" />
        </div>

        <span className="text-text-muted font-bold text-lg">:</span>

        {/* Minutes */}
        <div className="relative">
          <div
            ref={minRef}
            onScroll={handleMinScroll}
            className="h-[120px] w-14 overflow-y-scroll scroll-smooth snap-y snap-mandatory no-scrollbar rounded-xl border border-border/60 bg-black/[0.02]"
            style={{ scrollSnapType: "y mandatory" }}
          >
            {minutes.map(m => (
              <div
                key={m}
                onClick={() => {
                  onChange(hour, m);
                  if (minRef.current) {
                    const idx = minutes.indexOf(m);
                    minRef.current.scrollTop = idx * 40;
                  }
                }}
                style={{ scrollSnapAlign: "center", height: 40 }}
                className={`flex items-center justify-center text-sm font-semibold cursor-pointer transition-all
                  ${m === minute ? "text-brand-green" : "text-text-muted hover:text-text-primary"}`}
              >
                {String(m).padStart(2, "0")}
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute top-0 left-0 w-full h-8 rounded-t-xl bg-gradient-to-b from-surface to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 w-full h-8 rounded-b-xl bg-gradient-to-t from-surface to-transparent" />
        </div>

        {/* AM/PM */}
        <div className="flex flex-col gap-1">
          {["AM", "PM"].map(period => (
            <button
              key={period}
              type="button"
              onClick={() => {
                const currentAmPm = hour >= 12 ? "PM" : "AM";
                if (currentAmPm !== period) onChange(hour >= 12 ? hour - 12 : hour + 12, minute);
              }}
              className={`w-12 h-[55px] rounded-xl text-xs font-bold transition-all border
                ${ampm === period
                  ? "bg-brand-green text-white border-brand-green shadow-sm"
                  : "bg-black/[0.03] text-text-muted border-border/40 hover:border-brand-green/30 hover:text-brand-green"}
              `}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────
export default function NewSchedulePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"meeting" | "webinar">("meeting");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");

  // Date & time state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startH, setStartH] = useState(9);
  const [startM, setStartM] = useState(0);
  const [endH, setEndH] = useState(10);
  const [endM, setEndM] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [timezone, setTimezone] = useState("Africa/Lagos");

  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;

  const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newEmail = emailInput.trim();
      if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) && !emails.includes(newEmail)) {
        setEmails([...emails, newEmail]);
        setEmailInput("");
      }
    }
  };
  const removeEmail = (emailToRemove: string) => setEmails(emails.filter(e => e !== emailToRemove));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => router.push("/dashboard/schedule"), 600);
  };

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/schedule">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5 text-text-muted" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Schedule Session</h1>
          <p className="text-text-muted mt-1">Set up a new meeting or webinar.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "meeting" as const, icon: Video, label: "Meeting", desc: "Highly interactive, best for team syncs.", color: "brand-green" },
            { key: "webinar" as const, icon: MonitorPlay, label: "Webinar", desc: "View-only attendees, best for broadcasts.", color: "brand-blue" },
          ].map(({ key, icon: Icon, label, desc, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all
                ${mode === key
                  ? `border-${color} bg-${color}/5 shadow-sm`
                  : "border-border/60 bg-surface hover:border-border hover:bg-black/[0.02]"}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${mode === key ? `bg-${color} text-white` : "bg-black/5 text-text-muted"}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className={`text-lg font-bold ${mode === key ? `text-${color}` : "text-text-primary"}`}>{label}</h3>
              <p className="text-sm text-text-muted text-center mt-1">{desc}</p>
              {mode === key && (
                <div className={`absolute top-3 right-3 text-${color}`}>
                  <Check className="w-4 h-4" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Basic Details */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3">Basic Details</h3>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Session Title</label>
              <Input required placeholder="e.g. Weekly Product Sync" className="h-11 bg-black/[0.02]" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-text-muted" /> Description
                <span className="text-text-muted font-normal text-xs">(Optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="What is this session about?"
                className="w-full rounded-xl border border-border/60 bg-black/[0.02] p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-green/50 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Link to Room</label>
              <Select
                value={selectedRoom}
                onChange={setSelectedRoom}
                placeholder="Select an existing room..."
                options={MOCK_ROOMS.map(room => ({
                  value: room.id,
                  label: room.name,
                  description: `/${room.slug}`,
                }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Date & Time Card ── */}
        <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
              <CalendarIcon className="w-5 h-5 text-brand-green" />
              <h3 className="text-lg font-bold text-text-primary">Date & Time</h3>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/40">
              {/* ── Left: Calendar ── */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Select Date</span>
                  {selectedDate && (
                    <span className="text-xs font-semibold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-md">
                      {selectedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                <CalendarPicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  minDate={new Date()}
                />
                {selectedDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 rounded-xl bg-brand-green/5 border border-brand-green/20 text-sm text-brand-green font-semibold text-center"
                  >
                    {formattedDate}
                  </motion.div>
                )}
              </div>

              {/* ── Right: Time ── */}
              <div className="p-6 space-y-6">
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Set Time</span>

                <div className="flex flex-col gap-6">
                  <TimePicker
                    label="Start"
                    hour={startH}
                    minute={startM}
                    onChange={(h, m) => { setStartH(h); setStartM(m); }}
                  />

                  {/* Duration bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider px-2 py-1 bg-black/[0.03] rounded-lg border border-border/40">
                      {(() => {
                        const dur = (endH * 60 + endM) - (startH * 60 + startM);
                        const d = ((dur % 1440) + 1440) % 1440;
                        const h = Math.floor(d / 60); const m = d % 60;
                        return `${h > 0 ? `${h}h ` : ""}${m > 0 ? `${m}m` : ""}` || "0m";
                      })()}
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>

                  <TimePicker
                    label="End"
                    hour={endH}
                    minute={endM}
                    onChange={(h, m) => { setEndH(h); setEndM(m); }}
                  />
                </div>
              </div>
            </div>

            {/* ── Timezone Row ── */}
            <div className="px-6 py-4 border-t border-border/40 bg-black/[0.01] flex items-center gap-4">
              <Globe className="w-4 h-4 text-text-muted shrink-0" />
              <label className="text-sm font-semibold text-text-primary shrink-0">Timezone</label>
              <div className="flex-1 max-w-xs">
                <Select
                  value={timezone}
                  onChange={setTimezone}
                  options={[
                    { value: "Africa/Lagos", label: "WAT — UTC+1", description: "West Africa Time" },
                    { value: "UTC", label: "UTC — UTC+0", description: "Coordinated Universal Time" },
                    { value: "America/New_York", label: "ET — UTC−4", description: "Eastern Time" },
                    { value: "America/Los_Angeles", label: "PT — UTC−7", description: "Pacific Time" },
                    { value: "Europe/London", label: "BST — UTC+1", description: "British Summer Time" },
                    { value: "Europe/Paris", label: "CEST — UTC+2", description: "Central European Summer Time" },
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invites & Access */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3">Invites & Access</h3>

            {mode === "webinar" && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Users className="w-4 h-4 text-text-muted" /> Max Capacity
                </label>
                <Input type="number" placeholder="500" defaultValue={500} className="h-11 bg-black/[0.02] max-w-[200px]" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Mail className="w-4 h-4 text-text-muted" /> Invite Attendees
              </label>
              <div className="p-3 min-h-[90px] border border-border/60 rounded-xl bg-black/[0.02] flex flex-wrap gap-2 items-start focus-within:ring-2 focus-within:ring-brand-green/50 focus-within:bg-surface transition-all">
                {emails.map(email => (
                  <span key={email} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-green/10 text-brand-green text-xs font-semibold">
                    {email}
                    <button type="button" onClick={() => removeEmail(email)} className="hover:bg-brand-green/20 rounded-full p-0.5 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={handleAddEmail}
                  placeholder={emails.length === 0 ? "Type email and press Enter..." : ""}
                  className="flex-1 min-w-[200px] bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted placeholder:text-xs"
                />
              </div>
              <p className="text-xs text-text-muted">Invited users will receive a calendar invite with the join link.</p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4 pt-4 border-t border-border/60">
          <Link href="/dashboard/schedule">
            <Button variant="outline" type="button" className="h-12 px-6 rounded-xl border-border/60">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="h-12 px-8 rounded-xl bg-brand-green hover:bg-[#287854] text-white font-bold shadow-lg shadow-brand-green/20">
            Schedule Session
          </Button>
        </div>
      </form>
    </div>
  );
}
