"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
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
  Wifi,
  WifiOff,
} from "lucide-react";

export default function JoinPage({
  params,
}: {
  params: Promise<{ roomSlug: string }>;
}) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"host" | "attendee">("attendee");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const roomName = resolvedParams.roomSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Check if the signalling server is reachable
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: resolvedParams.roomSlug, name: "ping", role: "attendee" }),
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        setServerStatus(data.token ? "online" : "offline");
      } catch {
        setServerStatus("offline");
      }
    };
    checkServer();
  }, [resolvedParams.roomSlug]);

  // Attempt camera preview
  useEffect(() => {
    if (!isCameraOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        // Camera not available – silently degrade
        setIsCameraOn(false);
      });
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isCameraOn]);

  const handleJoin = () => {
    if (!name.trim() || isJoining) return;
    setIsJoining(true);
    // Stop the preview stream so it doesn't block camera in the meeting
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    // Navigate immediately — the MeetingProvider will handle WebSocket + waiting room
    router.push(
      `/meeting/${resolvedParams.roomSlug}?name=${encodeURIComponent(name.trim())}&role=${role}`
    );
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Camera preview */}
            <div className="order-1">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#1a1a2e] border border-white/5">
                {/* Real camera preview */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                    isCameraOn ? "opacity-100" : "opacity-0"
                  )}
                />
                {/* Fallback overlay when camera is off */}
                {!isCameraOn && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1e293b] via-[#1a1a2e] to-[#2d1f3d] flex flex-col items-center justify-center gap-3">
                    <Avatar
                      fallback={name ? name.charAt(0).toUpperCase() : "?"}
                      alt="You"
                      className="w-20 h-20 text-2xl border-2 border-white/10"
                    />
                    <span className="text-xs text-white/30">Camera is off</span>
                  </div>
                )}
                {/* Name overlay */}
                {isCameraOn && name && (
                  <div className="absolute bottom-14 left-3 text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-md">
                    {name} (You)
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
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
                    {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 text-white/80 hover:bg-white/15 transition-all duration-200 active:scale-90"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Device selectors */}
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 bg-white/5 rounded-xl p-4 border border-white/5 space-y-3"
                >
                  <DeviceSelect label="Camera" options={["Default Camera"]} />
                  <DeviceSelect label="Microphone" options={["Default Microphone"]} />
                  <DeviceSelect label="Speaker" options={["Default Speaker"]} />
                </motion.div>
              )}
            </div>

            {/* Join form */}
            <div className="order-2 flex flex-col justify-center">
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Ready to join?</h1>
                  <p className="text-sm text-white/40">
                    You&apos;re about to join{" "}
                    <span className="text-white/70 font-medium">{roomName}</span>
                  </p>
                </div>

                {/* Server status */}
                <div className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-3 border text-xs font-medium",
                  serverStatus === "online"
                    ? "bg-brand-green/10 border-brand-green/20 text-brand-green"
                    : serverStatus === "offline"
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-white/5 border-white/10 text-white/40"
                )}>
                  {serverStatus === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {serverStatus === "online" && <Wifi className="w-3.5 h-3.5" />}
                  {serverStatus === "offline" && <WifiOff className="w-3.5 h-3.5" />}
                  <span>
                    {serverStatus === "checking" && "Checking server connection…"}
                    {serverStatus === "online" && "Signal server reachable — WebRTC ready"}
                    {serverStatus === "offline" && "Signal server unreachable — check NEXT_PUBLIC_BACKEND_DOMAIN"}
                  </span>
                </div>

                {/* Name input */}
                <div>
                  <label className="block text-xs text-white/40 mb-2 font-medium">Your name</label>
                  <input
                    id="join-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-brand-green/40 focus:bg-white/[0.07] transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  />
                </div>

                {/* Role picker */}
                <div>
                  <label className="block text-xs text-white/40 mb-2 font-medium">Join as</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["attendee", "host"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={cn(
                          "py-2.5 rounded-xl text-sm font-medium border transition-all duration-200",
                          role === r
                            ? "bg-brand-green/10 border-brand-green/40 text-brand-green"
                            : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                        )}
                      >
                        {r === "host" ? "🎙️ Host" : "👤 Attendee"}
                      </button>
                    ))}
                  </div>
                  {role === "host" && (
                    <p className="text-[11px] text-amber-400/70 mt-1.5">
                      As host you can admit/deny participants from the waiting room.
                    </p>
                  )}
                </div>

                {/* Join button */}
                <button
                  id="join-meeting-btn"
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
                      Entering meeting…
                    </span>
                  ) : (
                    "Join Meeting"
                  )}
                </button>

                <p className="text-center text-[11px] text-white/20">
                  By joining, you agree to konn3ct&apos;s{" "}
                  <span className="text-white/40 hover:text-white/60 cursor-pointer">Terms of Service</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
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
