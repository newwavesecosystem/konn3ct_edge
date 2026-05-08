"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  ChevronDown,
  Shield,
  Users,
  Loader2,
} from "lucide-react";

export default function JoinPage({
  params,
}: {
  params: Promise<{ roomSlug: string }>;
}) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const roomName = resolvedParams.roomSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const handleJoin = () => {
    if (!name.trim()) return;
    setIsJoining(true);
    // Simulate join delay
    setTimeout(() => {
      setIsJoining(false);
      setIsWaiting(true);
      // After "waiting room" delay, go to meeting
      setTimeout(() => {
        router.push(`/meeting/${resolvedParams.roomSlug}?name=${encodeURIComponent(name)}&role=attendee`);
      }, 2500);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center">
            <span className="text-brand-green font-bold text-sm">K</span>
          </div>
          <span className="text-sm font-semibold text-white">konn3ct</span>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="text-xs text-white/50 hover:text-white transition-colors"
        >
          Sign in
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl"
        >
          {isWaiting ? (
            <WaitingRoom roomName={roomName} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Camera preview */}
              <div className="order-1">
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#1a1a2e] border border-white/5">
                  {isCameraOn ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a2a3a] via-[#1a1a2e] to-[#2a1a3a] flex items-center justify-center">
                      <Avatar
                        fallback={name ? name.charAt(0).toUpperCase() : "?"}
                        alt="You"
                        className="w-24 h-24 text-3xl border-2 border-white/10"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1e293b] via-[#1a1a2e] to-[#2d1f3d] flex flex-col items-center justify-center gap-3">
                      <Avatar
                        fallback={name ? name.charAt(0).toUpperCase() : "?"}
                        alt="You"
                        className="w-20 h-20 text-2xl border-2 border-white/10"
                      />
                      <span className="text-xs text-white/30">
                        Camera is off
                      </span>
                    </div>
                  )}

                  {/* Preview controls */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90",
                        isMuted
                          ? "bg-red-500/20 text-red-400"
                          : "bg-white/10 text-white/80 hover:bg-white/15"
                      )}
                    >
                      {isMuted ? (
                        <MicOff className="w-5 h-5" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setIsCameraOn(!isCameraOn)}
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90",
                        !isCameraOn
                          ? "bg-red-500/20 text-red-400"
                          : "bg-white/10 text-white/80 hover:bg-white/15"
                      )}
                    >
                      {isCameraOn ? (
                        <Video className="w-5 h-5" />
                      ) : (
                        <VideoOff className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 text-white/80 hover:bg-white/15 transition-all duration-200 active:scale-90"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Device selectors (shown if settings toggle is on) */}
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 bg-white/5 rounded-xl p-4 border border-white/5 space-y-3"
                  >
                    <DeviceSelect label="Camera" options={["FaceTime HD Camera", "External Webcam"]} />
                    <DeviceSelect label="Microphone" options={["MacBook Pro Mic", "External USB Mic"]} />
                    <DeviceSelect label="Speaker" options={["MacBook Pro Speakers", "Headphones"]} />
                  </motion.div>
                )}
              </div>

              {/* Join form */}
              <div className="order-2 flex flex-col justify-center">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                      Ready to join?
                    </h1>
                    <p className="text-sm text-white/40">
                      You&apos;re about to join{" "}
                      <span className="text-white/70 font-medium">
                        {roomName}
                      </span>
                    </p>
                  </div>

                  {/* Room info */}
                  <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-white/30" />
                      <span className="text-xs text-white/40">
                        8 participants
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-white/30" />
                      <span className="text-xs text-white/40">
                        Waiting room enabled
                      </span>
                    </div>
                  </div>

                  {/* Name input */}
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-medium">
                      Your name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-brand-green/40 focus:bg-white/[0.07] transition-colors"
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    />
                  </div>

                  {/* Access code (optional) */}
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-medium">
                      Access code{" "}
                      <span className="text-white/20">(if required)</span>
                    </label>
                    <input
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter access code"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-brand-green/40 focus:bg-white/[0.07] transition-colors font-mono tracking-widest"
                    />
                  </div>

                  {/* Join button */}
                  <button
                    onClick={handleJoin}
                    disabled={!name.trim() || isJoining}
                    className={cn(
                      "w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 active:scale-[0.98]",
                      name.trim()
                        ? "bg-brand-green text-white hover:bg-[#287854] shadow-lg shadow-brand-green/20"
                        : "bg-white/5 text-white/20 cursor-not-allowed"
                    )}
                  >
                    {isJoining ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Joining…
                      </span>
                    ) : (
                      "Join Meeting"
                    )}
                  </button>

                  <p className="text-center text-[11px] text-white/20">
                    By joining, you agree to konn3ct&apos;s{" "}
                    <span className="text-white/40 hover:text-white/60 cursor-pointer">
                      Terms of Service
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

// ── Waiting Room ───────────────────────────────────────
function WaitingRoom({ roomName }: { roomName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center text-center py-12"
    >
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-brand-green" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-brand-green/30 animate-ping" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
        Waiting to be admitted
      </h2>
      <p className="text-sm text-white/40 max-w-md mb-6">
        The host will let you into{" "}
        <span className="text-white/60 font-medium">{roomName}</span> shortly.
        Please wait…
      </p>
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-brand-green animate-spin" />
        <span className="text-xs text-white/30">
          Waiting for host approval
        </span>
      </div>
    </motion.div>
  );
}

// ── Device Select ──────────────────────────────────────
function DeviceSelect({
  label,
  options,
}: {
  label: string;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-[11px] text-white/30 mb-1 font-medium">
        {label}
      </label>
      <div className="relative">
        <select className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-brand-green/40 transition-colors appearance-none pr-8">
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#1a1a2e]">
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
      </div>
    </div>
  );
}
