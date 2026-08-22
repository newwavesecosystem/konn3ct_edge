"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useVirtualBackgrounds } from "@/hooks/use-virtual-backgrounds";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { VideoProcessor, VirtualBackgroundMode } from "@/lib/video-processor";
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
  Volume2,
} from "lucide-react";

export default function JoinPage({
  params,
}: {
  params: Promise<{ roomSlug: string }>;
}) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"host" | "attendee">("attendee");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [vbMode, setVbMode] = useState<VirtualBackgroundMode>('none');
  const [vbImageUrl, setVbImageUrl] = useState<string | undefined>();
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isOriginalRatioEnabled, setIsOriginalRatioEnabled] = useState(false);
  
  // Validation States
  const [validationStatus, setValidationStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [requiresAccessCode, setRequiresAccessCode] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [validationError, setValidationError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<VideoProcessor | null>(null);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const [selectedDevices, setSelectedDevices] = useState({
    audioInput: "",
    videoInput: "",
    audioOutput: "",
  });

  const roomName = resolvedParams.roomSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Load original ratio setting from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mtg_originalRatio");
      if (stored !== null) {
        setIsOriginalRatioEnabled(stored === "true");
      }
    }
  }, []);

  // Validate Room via external API
  useEffect(() => {
    const validateRoom = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_KONN3CT_EXTERNAL_API_URL || "https://dev.konn3ct.ng/api/app/kv4";
        const res = await fetch(`${baseUrl}/validate-meeting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: resolvedParams.roomSlug })
        });
        const data = await res.json();
        
        if (data.success) {
          setValidationStatus("valid");
          setRequiresAccessCode(data.access_code);
          setRoomDetails(data.data);
        } else {
          setValidationStatus("invalid");
          setValidationError(data.message || "Rooms does not exist");
        }
      } catch (err) {
        console.error("Validation error:", err);
        setValidationStatus("invalid");
        setValidationError("Unable to connect to validation service.");
      }
    };
    validateRoom();
  }, [resolvedParams.roomSlug]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const dev = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = dev.filter(d => d.kind === 'audioinput');
        const audioOutputs = dev.filter(d => d.kind === 'audiooutput');
        const videoInputs = dev.filter(d => d.kind === 'videoinput');
        
        setDevices({ audioInputs, audioOutputs, videoInputs });
        
        const saved = localStorage.getItem("conn3ct_devices");
        if (saved) {
          setSelectedDevices(JSON.parse(saved));
        } else {
          setSelectedDevices({
            audioInput: audioInputs[0]?.deviceId || "",
            audioOutput: audioOutputs[0]?.deviceId || "",
            videoInput: videoInputs[0]?.deviceId || "",
          });
        }
      } catch (err) {
        console.warn("Failed to enumerate devices", err);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    if (!processorRef.current) {
      processorRef.current = new VideoProcessor();
    }
    
    // Load persisted VB setting
    const saved = localStorage.getItem("mtg_vb");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVbMode(parsed.mode);
        setVbImageUrl(parsed.image);
        processorRef.current.setMode(parsed.mode, parsed.image);
      } catch (e) {}
    }
    
    return () => {
      processorRef.current?.stopProcessing();
    };
  }, []);

  const handleVbSelect = (mode: VirtualBackgroundMode, url?: string) => {
    setVbMode(mode);
    setVbImageUrl(url);
    processorRef.current?.setMode(mode, url);
    try {
      localStorage.setItem("mtg_vb", JSON.stringify({ mode, image: url }));
    } catch (e) {}
    
    if (streamRef.current) {
      const processed = processorRef.current!.startProcessing(streamRef.current);
      if (videoRef.current) videoRef.current.srcObject = processed;
    }
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { compressImage } = await import('@/lib/utils');
      const compressedData = await compressImage(file);
      handleVbSelect('image', compressedData);
    } catch (err) {
      console.error("Failed to compress background image", err);
    }
  };

  // Audio meter logic
  useEffect(() => {
    let animationFrameId: number;
    let audioContext: AudioContext;
    let analyser: AnalyserNode;

    const startMic = async () => {
      try {
        const constraints: MediaStreamConstraints = { audio: true };
        if (selectedDevices.audioInput) {
          constraints.audio = { deviceId: { exact: selectedDevices.audioInput } };
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        micStreamRef.current = stream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          
          // Smoothly map 0-255 to 0-100%
          const level = Math.min(100, Math.round((average / 128) * 100));
          setVolumeLevel(level);

          animationFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        console.warn("Failed to get mic for volume meter", err);
      }
    };

    if (!isMuted) {
      startMic();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVolumeLevel(0);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
    };
  }, [isMuted, selectedDevices.audioInput]);

  // Attempt camera preview
  useEffect(() => {
    if (!isCameraOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    const isMobileDevice = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const constraints: MediaStreamConstraints = { 
      video: isMobileDevice ? { facingMode: "user" } : true 
    };
    
    if (selectedDevices.videoInput) {
      if (typeof constraints.video === "object") {
        constraints.video = { ...constraints.video, deviceId: { exact: selectedDevices.videoInput } };
      } else {
        constraints.video = { deviceId: { exact: selectedDevices.videoInput } };
      }
    }
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;
        const processed = processorRef.current!.startProcessing(stream);
        if (videoRef.current) videoRef.current.srcObject = processed;

        // Update the device list now that we have camera permission
        navigator.mediaDevices.enumerateDevices().then(dev => {
          const videoInputs = dev.filter(d => d.kind === 'videoinput');
          setDevices(prev => ({ ...prev, videoInputs }));
          
          if (videoInputs.length > 0 && (!selectedDevices.videoInput || !videoInputs.find(d => d.deviceId === selectedDevices.videoInput))) {
            setSelectedDevices(prev => ({ ...prev, videoInput: videoInputs[0].deviceId }));
          }
        }).catch(() => {});
      })
      .catch(() => {
        setIsCameraOn(false);
      });
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isCameraOn, selectedDevices.videoInput]);

  const handleJoin = async () => {
    if (!name.trim() || !email.trim() || isJoining) return;
    if (requiresAccessCode && !accessCode.trim()) {
      alert("Access code is required.");
      return;
    }
    setIsJoining(true);
    // Stop the preview stream so it doesn't block camera in the meeting
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_KONN3CT_EXTERNAL_API_URL || "https://dev.konn3ct.ng/api/app/kv4";
      const isMobileDevice = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const payload: any = {
        room: resolvedParams.roomSlug,
        name: name.trim(),
        email: email.trim(),
        cam: isCameraOn,
        mic: !isMuted,
        mobile: isMobileDevice,
        isMobile: isMobileDevice
      };

      if (requiresAccessCode) {
        payload.access_code = accessCode.trim();
      }

      const res = await fetch(`${baseUrl}/join-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to join room");
      }

      if (data.sessionToken) {
        // Save the secure session token to navigate with
        localStorage.setItem("conn3ct_session_token", data.sessionToken);
      }

      // Navigate immediately — the MeetingProvider will handle WebSocket + waiting room
      router.push(`/meeting/${resolvedParams.roomSlug}`);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to join. Please try again.");
      setIsJoining(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop immediately, we just needed the permission to populate devices
      stream.getTracks().forEach(t => t.stop());
      
      const dev = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = dev.filter(d => d.kind === 'videoinput');
      
      setDevices(prev => ({ ...prev, videoInputs }));
      
      if (videoInputs.length > 0 && (!selectedDevices.videoInput || !videoInputs.find(d => d.deviceId === selectedDevices.videoInput))) {
        setSelectedDevices(prev => ({ ...prev, videoInput: videoInputs[0].deviceId }));
      }
    } catch (err) {
      console.warn("Failed to get camera permission", err);
    }
  };

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Konn3ct";
  const appInitial = appName.charAt(0).toUpperCase();

  const { backgrounds } = useVirtualBackgrounds();
  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center">
            <span className="text-brand-green font-bold text-sm">{appInitial}</span>
          </div>
          <span className="text-sm font-semibold text-white">{appName}</span>
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
        {validationStatus === "loading" && (
          <div className="flex flex-col items-center gap-4 text-white/50">
            <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            <p>Validating room...</p>
          </div>
        )}

        {validationStatus === "invalid" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-[#1a1a2e] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Invalid Room URL</h2>
            <p className="text-white/60 mb-8">{validationError}</p>
            {/* <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Go to Homepage
            </button> */}
          </motion.div>
        )}

        {validationStatus === "valid" && (
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
                    "absolute inset-0 w-full h-full transition-opacity duration-300",
                    isOriginalRatioEnabled ? "object-contain" : "object-cover",
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
                {/* Audio Meter */}
                {!isMuted && (
                  <div className="absolute bottom-[4.5rem] right-3 flex items-center gap-2 bg-black/40 px-2 py-1.5 rounded-md shadow-md backdrop-blur-sm">
                    <Mic className="w-3 h-3 text-white/70" />
                    <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-brand-green transition-all duration-75"
                        style={{ width: `${volumeLevel}%` }}
                      />
                    </div>
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
                    onClick={async () => {
                      try {
                        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        if (selectedDevices.audioOutput && typeof (audioCtx as any).setSinkId === 'function') {
                          await (audioCtx as any).setSinkId(selectedDevices.audioOutput);
                        }
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
                        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                        osc.start();
                        osc.stop(audioCtx.currentTime + 0.3);
                      } catch (e) { }
                    }}
                    title="Test Speaker"
                    className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 text-white/80 hover:bg-white/15 transition-all duration-200 active:scale-90"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 text-white/80 hover:bg-white/15 transition-all duration-200 active:scale-90"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Device selectors & Settings */}
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 bg-white/5 rounded-xl p-4 border border-white/5 space-y-3"
                >
                  <DeviceSelect 
                    label="Camera" 
                    actionNode={
                      devices.videoInputs.every(d => !d.label || d.label === 'Default Camera') ? (
                        <button
                          onClick={requestCameraPermission}
                          className="text-brand-green hover:text-[#287854] text-[10px] font-medium transition-colors"
                        >
                          Allow Access
                        </button>
                      ) : null
                    }
                    options={devices.videoInputs.map(d => ({ value: d.deviceId, label: d.label || 'Default Camera' }))} 
                    value={selectedDevices.videoInput}
                    onChange={(val) => {
                      const newDevs = { ...selectedDevices, videoInput: val };
                      setSelectedDevices(newDevs);
                      localStorage.setItem("conn3ct_devices", JSON.stringify(newDevs));
                    }}
                  />
                  <DeviceSelect 
                    label="Microphone" 
                    options={devices.audioInputs.map(d => ({ value: d.deviceId, label: d.label || 'Default Microphone' }))} 
                    value={selectedDevices.audioInput}
                    onChange={(val) => {
                      const newDevs = { ...selectedDevices, audioInput: val };
                      setSelectedDevices(newDevs);
                      localStorage.setItem("conn3ct_devices", JSON.stringify(newDevs));
                    }}
                  />
                  <DeviceSelect 
                    label="Speaker" 
                    options={devices.audioOutputs.map(d => ({ value: d.deviceId, label: d.label || 'Default Speaker' }))} 
                    value={selectedDevices.audioOutput}
                    onChange={(val) => {
                      const newDevs = { ...selectedDevices, audioOutput: val };
                      setSelectedDevices(newDevs);
                      localStorage.setItem("conn3ct_devices", JSON.stringify(newDevs));
                    }}
                  />

                  {/* Original Aspect Ratio toggle */}
                  <div className="flex items-center justify-between py-2 border-t border-white/5">
                    <span className="text-xs text-white/70 font-medium">Original Aspect Ratio</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isOriginalRatioEnabled;
                        setIsOriginalRatioEnabled(next);
                        localStorage.setItem("mtg_originalRatio", String(next));
                      }}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        isOriginalRatioEnabled ? "bg-brand-green" : "bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          isOriginalRatioEnabled ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Virtual Background Selection UI */}
                  {isCameraOn && !isIOS && (
                    <div className="pt-4 mt-2 border-t border-white/10">
                      <label className="block text-[11px] text-white/30 mb-2 font-medium">
                        Virtual Background
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          onClick={() => handleVbSelect('none')}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-xl transition-all h-14",
                            vbMode === 'none' ? "ring-2 ring-brand-green bg-white/10" : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10"
                          )}
                        >
                          <span className="text-[10px] text-white">None</span>
                        </button>
                        
                        <button
                          onClick={() => handleVbSelect('blur')}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-xl transition-all h-14 relative overflow-hidden",
                            vbMode === 'blur' ? "ring-2 ring-brand-green bg-white/10" : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10"
                          )}
                        >
                          <div className="absolute inset-0 backdrop-blur-md bg-white/5" />
                          <span className="relative z-10 text-[10px] text-white">Blur</span>
                        </button>
                        
                        {backgrounds.map((url, i) => (
                          <button
                            key={url}
                            onClick={() => handleVbSelect('image', url)}
                            className={cn(
                              "rounded-xl overflow-hidden transition-all h-14",
                              vbMode === 'image' && vbImageUrl === url ? "ring-2 ring-brand-green" : "ring-1 ring-white/10 hover:ring-white/20"
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`BG ${i+1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}

                        {/* Custom Upload */}
                        <label className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-xl transition-all h-14 cursor-pointer",
                          vbMode === 'image' && vbImageUrl && !vbImageUrl.startsWith('/backgrounds') ? "ring-2 ring-brand-green bg-white/10" : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 border-dashed border-2"
                        )}>
                          <span className="text-lg text-white/50 leading-none mb-0.5">+</span>
                          <span className="text-[9px] text-white/40">Upload</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleCustomUpload} />
                        </label>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Join form */}
            <div className="order-2 flex flex-col justify-center">
              <div className="space-y-5">
                <div className="flex items-center gap-4 mb-2">
                  {roomDetails?.display_image && (
                    <img 
                      src={roomDetails.display_image} 
                      alt="Room Logo" 
                      className="w-14 h-14 rounded-xl object-contain bg-white/5 border border-white/10 p-1 shrink-0" 
                    />
                  )}
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Ready to join?</h1>
                    <p className="text-sm text-white/40 leading-relaxed">
                      You&apos;re about to join{" "}
                      <span className="text-white/70 font-medium">{roomDetails?.name || roomName}</span>
                      {roomDetails?.owner && (
                        <>
                          <br />
                          <span className="text-xs text-brand-green/80 font-medium">
                            Hosted by {roomDetails.owner}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Server status */}
                {/* <div className={cn(
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
                </div> */}

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

                {/* Email input */}
                <div>
                  <label className="block text-xs text-white/40 mb-2 font-medium">Your email</label>
                  <input
                    id="join-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-brand-green/40 focus:bg-white/[0.07] transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  />
                </div>

                {/* Access Code input */}
                {requiresAccessCode && (
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-medium">Access Code</label>
                    <input
                      id="join-access-code"
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter access code"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-brand-green/40 focus:bg-white/[0.07] transition-colors"
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    />
                  </div>
                )}

                {/* Role picker removed as it is now securely forced to attendee by the backend. Hosts will use the dashboard. */}

                {/* Join button */}
                <button
                  id="join-meeting-btn"
                  onClick={handleJoin}
                  disabled={!name.trim() || !email.trim() || isJoining}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 active:scale-[0.98]",
                    name.trim() && email.trim()
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
                  By joining, you agree to {appName}&apos;s{" "}
                  <span className="text-white/40 hover:text-white/60 cursor-pointer">Terms of Service</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
        )}
      </main>
    </div>
  );
}



// ── Device Select ──────────────────────────────────────
function DeviceSelect({
  label,
  options,
  value,
  onChange,
  actionNode
}: {
  label: string;
  options: { label: string, value: string }[];
  value: string;
  onChange: (val: string) => void;
  actionNode?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] text-white/30 font-medium">
          {label}
        </label>
        {actionNode}
      </div>
      <div className="relative">
        <select 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-brand-green/40 transition-colors appearance-none pr-8"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1a1a2e]">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
      </div>
    </div>
  );
}

