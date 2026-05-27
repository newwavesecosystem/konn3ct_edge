"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft, Video, Shield, Mic, Lock, Globe, Users, Radio
} from "lucide-react";
import Link from "next/link";
import { apiClient, CreateRoomPayload } from "@/lib/api-client";
import { toast } from "sonner";

type RoomMode = "meeting" | "webinar";
type RecordingSetting = "off" | "free" | "paid";

export default function NewRoomPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Core fields
  const [roomName, setRoomName] = useState("");

  // New spec fields
  const [mode, setMode] = useState<RoomMode>("meeting");
  const [recordingSetting, setRecordingSetting] = useState<RecordingSetting>("off");
  const [guestJoinAllowed, setGuestJoinAllowed] = useState(true);
  const [accessPin, setAccessPin] = useState("");
  const [enablePin, setEnablePin] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    if (enablePin && accessPin.length < 4) {
      toast.error("Access PIN must be at least 4 characters.");
      return;
    }

    try {
      setIsLoading(true);
      const payload: CreateRoomPayload = {
        name: roomName.trim(),
        mode,
        recordingSetting,
        guestJoinAllowed,
        accessPin: enablePin && accessPin ? accessPin : undefined,
        // Webinar mode auto-enables waiting room (handled server-side too)
        isWaitingRoomEnabled: mode === "webinar" ? true : undefined,
      };
      await apiClient.rooms.create(payload);
      toast.success("Room created successfully!");
      router.push("/dashboard/rooms");
    } catch (err: any) {
      toast.error(err.message || "Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/rooms">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5 text-text-muted" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Create Room</h1>
          <p className="text-text-muted mt-1">Set up a new reusable meeting space.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Room Details */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3 flex items-center gap-2">
              <Video className="w-5 h-5 text-brand-green" /> Room Information
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Room Name</label>
              <Input
                required
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Design Critique"
                className="h-11 bg-black/[0.02]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Room Mode */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3 flex items-center gap-2">
              <Radio className="w-5 h-5 text-brand-green" /> Room Mode
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  key: "meeting" as RoomMode,
                  icon: Users,
                  label: "Meeting",
                  desc: "Collaborative — everyone can share video and audio.",
                },
                {
                  key: "webinar" as RoomMode,
                  icon: Radio,
                  label: "Webinar",
                  desc: "Broadcast — presenter speaks, audience watches. Waiting room auto-enabled.",
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMode(opt.key)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                    ${mode === opt.key ? "border-brand-green bg-brand-green/5" : "border-border/60 hover:border-border"}`}
                >
                  <opt.icon className={`w-5 h-5 mt-0.5 shrink-0 ${mode === opt.key ? "text-brand-green" : "text-text-muted"}`} />
                  <div>
                    <h4 className={`text-sm font-bold ${mode === opt.key ? "text-brand-green" : "text-text-primary"}`}>{opt.label}</h4>
                    <p className="text-xs text-text-muted mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recording Setting */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3 flex items-center gap-2">
              <Mic className="w-5 h-5 text-brand-green" /> Recording
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "off" as RecordingSetting, label: "Off", desc: "Recording disabled." },
                { key: "free" as RecordingSetting, label: "Free", desc: "Anyone can access the recording." },
                { key: "paid" as RecordingSetting, label: "Paid", desc: "Viewers pay to watch the recording." },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRecordingSetting(opt.key)}
                  className={`flex flex-col p-4 rounded-xl border-2 text-left transition-all
                    ${recordingSetting === opt.key ? "border-brand-green bg-brand-green/5" : "border-border/60 hover:border-border"}`}
                >
                  <span className={`text-sm font-bold ${recordingSetting === opt.key ? "text-brand-green" : "text-text-primary"}`}>{opt.label}</span>
                  <span className="text-xs text-text-muted mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Access & Privacy */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-green" /> Access & Privacy
            </h3>

            {/* Guest Join */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-text-muted" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Allow Guest Join</p>
                  <p className="text-xs text-text-muted">Anyone with the link can join without an account.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuestJoinAllowed(!guestJoinAllowed)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                  ${guestJoinAllowed ? "bg-brand-green" : "bg-border"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${guestJoinAllowed ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            {/* Access PIN */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-text-muted" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Require Access PIN</p>
                  <p className="text-xs text-text-muted">Guests must enter a PIN to join. (4–12 digits)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setEnablePin(!enablePin); if (enablePin) setAccessPin(""); }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                  ${enablePin ? "bg-brand-green" : "bg-border"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${enablePin ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            {enablePin && (
              <div className="space-y-2 pl-2">
                <label className="text-sm font-semibold text-text-primary">Access PIN</label>
                <Input
                  value={accessPin}
                  onChange={(e) => setAccessPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="e.g. 123456"
                  minLength={4}
                  maxLength={12}
                  inputMode="numeric"
                  className="h-11 bg-black/[0.02] max-w-[200px] tracking-widest text-lg font-mono"
                />
                <p className="text-xs text-text-muted">Digits only, 4–12 characters.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webinar info banner */}
        {mode === "webinar" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400">
            <Radio className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>Webinar mode:</strong> The waiting room will be automatically enabled. Participants join as audience members until admitted by the host.
            </span>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4 pt-4 border-t border-border/60">
          <Link href="/dashboard/rooms">
            <Button variant="outline" type="button" className="h-12 px-6 rounded-xl border-border/60">
              Cancel
            </Button>
          </Link>
          <Button
            disabled={isLoading}
            type="submit"
            className="h-12 px-8 rounded-xl bg-brand-green hover:bg-[#287854] text-white font-bold shadow-lg shadow-brand-green/20"
          >
            {isLoading ? "Creating..." : "Create Room"}
          </Button>
        </div>
      </form>
    </div>
  );
}
