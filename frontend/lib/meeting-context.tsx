"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type {
  Participant,
  ChatMessage,
  Poll,
  MeetingInfo,
  DocNote,
  Reaction,
  SidePanel,
  LayoutMode,
  ParticipantRole,
} from "@/lib/types/meeting";
import {
  mockParticipants,
  mockCurrentUser,
  mockChatMessages,
  mockPolls,
  mockDocs,
  mockMeetingInfo,
} from "@/lib/mock/meeting";
import { WebRTCClient } from "./webrtc";

interface MeetingContextValue {
  // State
  participants: Participant[];
  waitingUsers: Array<{ userId: string, name: string }>;
  currentUser: Participant;
  chatMessages: ChatMessage[];
  polls: Poll[];
  sharedNoteContent: string;
  meetingInfo: MeetingInfo;
  reactions: Reaction[];
  activePanel: SidePanel;
  layoutMode: LayoutMode;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isHandRaised: boolean;
  showLeaveDialog: boolean;
  showReactionPicker: boolean;
  meetingDuration: number; // seconds
  isMobilePanelOpen: boolean;
  webrtcStatus: string;
  eCinemaLink: string | null;

  // Actions
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleRecording: () => void;
  toggleHandRaise: () => void;
  setActivePanel: (panel: SidePanel) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  sendMessage: (content: string, targetUserId?: string, fileUrl?: string) => void;
  sendReaction: (emoji: string) => void;
  votePoll: (pollId: string, optionId: string) => void;
  createPoll: (question: string, options: string[]) => void;
  updateSharedNote: (content: string) => void;
  setShowLeaveDialog: (show: boolean) => void;
  setShowReactionPicker: (show: boolean) => void;
  setIsMobilePanelOpen: (open: boolean) => void;
  admitUser: (userId: string) => void;
  denyUser: (userId: string) => void;
  kickUser: (userId: string) => void;
  forceMuteUser: (userId?: string) => void;
  endMeetingForAll: () => void;
  broadcastECinema: (link: string | null) => void;
  eCinemaLink: string | null;
  
  // Device Management
  devices: {
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  };
  selectedDevices: {
    audioInput: string;
    videoInput: string;
    audioOutput: string;
  };
  switchDevice: (kind: 'audioInput' | 'videoInput' | 'audioOutput', deviceId: string) => void;
  isAINoiseSuppressionEnabled: boolean;
  toggleAINoiseSuppression: (enable: boolean) => Promise<void>;
  
  // Settings
  isHDVideoEnabled: boolean;
  setIsHDVideoEnabled: (enabled: boolean) => void;
  isMirrorVideoEnabled: boolean;
  setIsMirrorVideoEnabled: (enabled: boolean) => void;
  isLowBandwidthEnabled: boolean;
  setIsLowBandwidthEnabled: (enabled: boolean) => void;
  isAlwaysMuteOnJoin: boolean;
  setIsAlwaysMuteOnJoin: (enabled: boolean) => void;
}

const MeetingContext = createContext<MeetingContextValue | null>(null);

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used within MeetingProvider");
  return ctx;
}

export function MeetingProvider({
  children,
  roomSlug,
}: {
  children: React.ReactNode;
  roomSlug: string;
}) {
  // Extract user info from URL (passed from Join or Dashboard)
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const queryName = searchParams.get("name") || "Guest";
  const queryRole = (searchParams.get("role") as ParticipantRole) || "attendee";

  // ── State ────────────────────────────────────────────
  const [currentUser] = useState<Participant>({
    id: `u-${Math.random().toString(36).substring(2, 9)}`,
    name: queryName,
    role: queryRole,
    isMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date().toISOString(),
  });

  // Start with only the current user, so real users are dynamically added
  const [participants, setParticipants] = useState<Participant[]>([currentUser]);
  const [waitingUsers, setWaitingUsers] = useState<Array<{ userId: string, name: string }>>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [sharedNoteContent, setSharedNoteContent] = useState<string>("");
  const formattedTitle = roomSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const [meetingInfo] = useState<MeetingInfo>({
    ...mockMeetingInfo,
    roomName: formattedTitle,
    roomSlug,
  });
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("speaker");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState("disconnected");
  const [eCinemaLink, setECinemaLink] = useState<string | null>(null);
  const [isAINoiseSuppressionEnabled, setIsAINoiseSuppressionEnabled] = useState(false);
  
  // Settings State
  const [isHDVideoEnabled, setIsHDVideoEnabled] = useState(true);
  const [isMirrorVideoEnabled, setIsMirrorVideoEnabled] = useState(true);
  const [isLowBandwidthEnabled, setIsLowBandwidthEnabled] = useState(false);
  const [isAlwaysMuteOnJoin, setIsAlwaysMuteOnJoin] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hd = localStorage.getItem("mtg_hdVideo");
      if (hd !== null) setIsHDVideoEnabled(hd === "true");

      const mirror = localStorage.getItem("mtg_mirrorVideo");
      if (mirror !== null) setIsMirrorVideoEnabled(mirror === "true");

      const lowBw = localStorage.getItem("mtg_lowBandwidth");
      if (lowBw !== null) setIsLowBandwidthEnabled(lowBw === "true");

      const alwaysMute = localStorage.getItem("mtg_alwaysMute");
      if (alwaysMute !== null) {
        const muteOn = alwaysMute === "true";
        setIsAlwaysMuteOnJoin(muteOn);
        if (muteOn) {
          setIsMuted(true);
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === currentUser.id ? { ...p, isMuted: true } : p
            )
          );
        }
      }
    }
  }, [currentUser.id]);

  // Wrappers to persist settings
  const updateHDVideo = (val: boolean) => {
    setIsHDVideoEnabled(val);
    localStorage.setItem("mtg_hdVideo", String(val));
    // Apply immediately to WebRTC if connected
    if (webrtcClient.current && webrtcClient.current.isHDVideo !== val) {
      webrtcClient.current.isHDVideo = val;
      // Restart camera with new resolution if active
      if (isCameraOn) {
        webrtcClient.current.enableCamera().then(track => {
          localCameraTrackRef.current = track;
          setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, videoTrack: track } : p));
        });
      }
    }
  };

  const updateMirrorVideo = (val: boolean) => {
    setIsMirrorVideoEnabled(val);
    localStorage.setItem("mtg_mirrorVideo", String(val));
  };

  const updateLowBandwidth = (val: boolean) => {
    setIsLowBandwidthEnabled(val);
    localStorage.setItem("mtg_lowBandwidth", String(val));
    toast.info(val ? "Low bandwidth mode active. Optimizing feeds..." : "Low bandwidth mode disabled.");

    if (webrtcClient.current && webrtcClient.current.isLowBandwidth !== val) {
      webrtcClient.current.isLowBandwidth = val;
      if (isCameraOn) {
        webrtcClient.current.enableCamera().then(track => {
          localCameraTrackRef.current = track;
          setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, videoTrack: track } : p));
        });
      }
    }
  };

  const updateAlwaysMute = (val: boolean) => {
    setIsAlwaysMuteOnJoin(val);
    localStorage.setItem("mtg_alwaysMute", String(val));
  };

  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [], audioOutputs: [] });

  const [selectedDevices, setSelectedDevices] = useState({
    audioInput: "default",
    videoInput: "default",
    audioOutput: "default",
  });

  // ── WebRTC Instance ──────────────────────────────────
  const webrtcClient = useRef<WebRTCClient | null>(null);
  const localCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let client: WebRTCClient | null = null;

    const connectToMeeting = async () => {
      try {
        setWebrtcStatus("fetching-token");

        // Call our new Next.js endpoint to get a secure JWT
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: roomSlug,
            name: currentUser.name,
            email: "guest@conn3ct.com",
            role: currentUser.role
          })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
          toast.error(data.error || "Failed to get connection token");
          setWebrtcStatus("failed");
          return;
        }

        client = new WebRTCClient(roomSlug, data.token);
        client.isHDVideo = isHDVideoEnabled;
        client.isLowBandwidth = isLowBandwidthEnabled;

        // --- Collaboration Event Listeners ---
        client.onServerLoadHigh = () => {
          toast.warning("Server is under heavy load. Optimizing video feeds to maintain stability...");
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
          }
        };

        client.onServerReject = (msg) => {
          toast.error(msg);
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
          }
        };
        let lastNetworkToastTime = 0;
        client.onNetworkQualityChange = (quality) => {
          const now = Date.now();
          if (now - lastNetworkToastTime > 30000) {
            // Play Warning Sound
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'triangle';
              oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
              oscillator.frequency.setValueAtTime(400, audioCtx.currentTime + 0.15);
              oscillator.frequency.setValueAtTime(300, audioCtx.currentTime + 0.3);
              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
              oscillator.start(audioCtx.currentTime);
              oscillator.stop(audioCtx.currentTime + 0.5);
            } catch(e) {}

            if (quality === 'bad') {
              if (webrtcClient.current && !webrtcClient.current.isAudioOnlyMode) {
                toast.error("Network is extremely poor. Switching to Audio-Only mode to save bandwidth.", { duration: 6000 });
                webrtcClient.current.enableAudioOnlyMode();
                webrtcClient.current.sendCameraState(false);
                setIsCameraOn(false);
                setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isCameraOn: false } : p));
              }
              lastNetworkToastTime = now;
            } else if (quality === 'poor') {
              toast.warning("Network connection is weak. Media quality might be degraded.");
              lastNetworkToastTime = now;
            } else if (quality === 'good') {
              if (webrtcClient.current && webrtcClient.current.isAudioOnlyMode) {
                toast.success("Network connection stabilized. Resuming incoming video streams.", { duration: 5000 });
                webrtcClient.current.disableAudioOnlyMode();
              }
            }
          }
        };

        client.onChatHistory = (messages) => {
          setChatMessages(messages.map((m: any) => ({
            id: m.id,
            senderId: m.userId,
            senderName: m.senderName || `Participant ${m.userId.substring(5, 9)}`,
            senderRole: "attendee",
            content: m.content,
            timestamp: m.createdAt,
            isPrivate: m.isPrivate,
            fileUrl: m.fileUrl
          })));
        };

        client.onPollHistory = (historyPolls) => {
          setPolls(historyPolls);
        };

        client.onNoteHistory = (content) => {
          setSharedNoteContent(content);
        };

        client.onNoteUpdate = (msg) => {
          setSharedNoteContent(msg.content);
        };

        client.onChatMessage = (msg) => {
          if (msg.userId !== currentUser.id) {
            // Play Pop Sound
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(800, audioCtx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
              gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.1);
            } catch (e) { }
          }

          setChatMessages((prev) => {
            if (msg.id && prev.some(m => m.id === msg.id)) return prev;

            return [
              ...prev,
              {
                id: msg.id || `m-${Date.now()}-${Math.random()}`,
                senderId: msg.userId,
                senderName: msg.userId === currentUser.id
                  ? currentUser.name
                  : msg.name || `Participant ${msg.userId.substring(5, 9)}`,
                senderRole: "attendee",
                content: msg.message,
                timestamp: msg.timestamp,
                isPrivate: msg.isPrivate,
                fileUrl: msg.fileUrl,
              },
            ];
          });
        };

        client.onReaction = (msg) => {
          const reaction: Reaction = {
            id: `r-${Date.now()}-${Math.random()}`,
            emoji: msg.reaction,
            senderId: msg.userId,
            senderName: msg.name || `Participant`,
            timestamp: Date.now(),
          };
          setReactions((prev) => [...prev, reaction]);
          setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== reaction.id)), 3000);
        };

        client.onPollCreate = (msg) => {
          setPolls((prev) => [
            ...prev,
            {
              id: msg.pollId,
              question: msg.question,
              options: msg.options,
              createdBy: msg.userId,
              isActive: true,
              totalVotes: 0,
            },
          ]);
        };

        client.onPollVote = (msg) => {
          setPolls((prev) =>
            prev.map((p) => {
              if (p.id !== msg.pollId) return p;
              return {
                ...p,
                totalVotes: p.totalVotes + 1,
                options: p.options.map((o) =>
                  o.id === msg.optionId ? { ...o, votes: o.votes + 1 } : o
                ),
              };
            })
          );
        };

        client.onMuteState = (msg) => {
          setParticipants((prev) => {
            const user = prev.find(p => p.id === msg.userId);
            if (user && user.isMuted !== msg.isMuted) {
              toast.info(`${user.name} is now ${msg.isMuted ? 'muted' : 'unmuted'}`);
            }
            return prev.map(p =>
              p.id === msg.userId ? { ...p, isMuted: msg.isMuted } : p
            );
          });
        };

        client.onCameraState = (msg) => {
          setParticipants((prev) => prev.map(p =>
            p.id === msg.userId ? { ...p, isCameraOn: msg.isCameraOn } : p
          ));
        };

        client.onHandRaise = (msg) => {
          if (msg.isHandRaised && msg.userId !== currentUser.id) {
            // Play Ding Sound
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
              gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.5);
            } catch (e) { }
          }
          setParticipants((prev) => prev.map(p =>
            p.id === msg.userId ? { ...p, isHandRaised: msg.isHandRaised } : p
          ));
        };

        client.onScreenShareStarted = (userId, producerId) => {
          setParticipants((prev) => prev.map(p =>
            p.id === userId ? { ...p, isScreenSharing: true } : p
          ));
          toast.info(`${participants.find(p => p.id === userId)?.name || 'A participant'} started screen sharing`);
        };

        client.onScreenShareStopped = (userId, producerId) => {
          setParticipants((prev) => prev.map(p =>
            p.id === userId ? { ...p, isScreenSharing: false, screenTrack: null } : p
          ));
          toast.info(`Screen sharing ended`);
        };

        client.onConsumerClosed = (producerId, appData) => {
          if (appData?.source === 'screen') {
            setParticipants((prev) => prev.map(p =>
              p.isScreenSharing ? { ...p, isScreenSharing: false, screenTrack: null } : p
            ));
          }
        };

        client.onActiveSpeaker = (userIds) => {
          setParticipants((prev) => prev.map(p => ({
            ...p,
            isSpeaking: userIds.includes(p.id)
          })));
        };

        client.onWaitingRoomRequest = (msg) => {
          setWaitingUsers(prev => {
            if (prev.find(u => u.userId === msg.userId)) return prev;

            // Play Doorbell Sound (Ding-Dong)
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              // Ding
              oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
              // Dong
              oscillator.frequency.setValueAtTime(450, audioCtx.currentTime + 0.3);
              gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); // Volume
              // Fade out smoothly to avoid popping
              gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
              oscillator.start(audioCtx.currentTime);
              oscillator.stop(audioCtx.currentTime + 0.6);
            } catch(e) {
              console.warn("Failed to play doorbell sound", e);
            }

            toast(`${msg.name} is waiting to join`, {
              action: {
                label: 'Admit',
                onClick: () => webrtcClient.current?.sendAdmitUser(msg.userId)
              }
            });
            return [...prev, { userId: msg.userId, name: msg.name }];
          });
        };

        client.onConnectionStateChange = (state) => {
          if (webrtcClient.current === client) {
            setWebrtcStatus(state);
            if (state === 'kicked') {
              toast.error("You have been removed from the meeting by the host.");
            } else if (state === 'denied') {
              toast.error("Your request to join was denied by the host.");
            } else if (state === 'ended') {
              toast.info("The host has ended this meeting for everyone.");
            }
          }
        };

        client.onForceMute = () => {
          webrtcClient.current?.pauseMic();
          webrtcClient.current?.sendMuteState(true);
          setIsMuted(true);
          setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isMuted: true } : p));
          toast.warning("The host has muted your microphone.");
        };

        client.onECinemaUpdate = (link) => {
          setECinemaLink(link);
          if (link) {
            toast.success("eCinema broadcast has started!");
          }
        };

        client.onParticipantsList = (backendParticipants) => {
          setParticipants((prev) => {
            const newParticipants = [...prev];
            for (const p of backendParticipants) {
              if (!newParticipants.some(existing => existing.id === p.userId)) {
                newParticipants.push({
                  id: p.userId,
                  name: p.name,
                  role: p.role as any,
                  isMuted: true,
                  isCameraOn: false,
                  isScreenSharing: false,
                  isHandRaised: false,
                  isSpeaking: false,
                  joinedAt: new Date().toISOString(),
                  isConnecting: true,
                });
                setTimeout(() => {
                  setParticipants(curr => curr.map(u => u.id === p.userId ? { ...u, isConnecting: false } : u));
                }, 4000);
              }
            }
            return newParticipants;
          });
        };

        client.onUserJoined = (user) => {
          setParticipants((prev) => {
            if (prev.some(p => p.id === user.userId)) return prev;
            return [...prev, {
              id: user.userId,
              name: user.name,
              role: user.role as any,
              isMuted: true,
              isCameraOn: false,
              isScreenSharing: false,
              isHandRaised: false,
              isSpeaking: false,
              joinedAt: new Date().toISOString(),
              isConnecting: true,
            }];
          });
          
          setTimeout(() => {
            setParticipants(curr => curr.map(p => p.id === user.userId ? { ...p, isConnecting: false } : p));
          }, 4000);

          toast.info(`${user.name} joined the meeting`);
        };

        client.onUserLeft = (userId) => {
          setParticipants((prev) => {
            const user = prev.find(p => p.id === userId);
            if (user && user.id !== currentUser.id) {
               toast.info(`${user.name} left the meeting`);
            }
            return prev.filter(p => p.id !== userId);
          });
        };

        client.onNewConsumer = (consumer, userId) => {
          const source = (consumer.appData as any)?.source || (consumer.kind === 'audio' ? 'audio' : 'camera');
          
          setParticipants((prev) => {
            const exists = prev.find((p) => p.id === userId);
            if (exists) {
              return prev.map((p) => {
                if (p.id === userId) {
                  if (consumer.kind === 'audio') {
                    return { ...p, audioTrack: consumer.track as MediaStreamTrack, isMuted: false };
                  }
                  if (consumer.kind === 'video' && source === 'screen') {
                    return { ...p, screenTrack: consumer.track as MediaStreamTrack, isScreenSharing: true };
                  }
                  if (consumer.kind === 'video') {
                    return { ...p, videoTrack: consumer.track as MediaStreamTrack, isCameraOn: true };
                  }
                }
                return p;
              });
            } else {
              const newParticipant: Participant = {
                id: userId,
                name: `Participant ${userId.substring(5, 9)}`,
                role: "attendee",
                isMuted: consumer.kind !== "audio",
                isCameraOn: consumer.kind === "video" && source !== 'screen',
                isScreenSharing: consumer.kind === "video" && source === 'screen',
                isHandRaised: false,
                isSpeaking: false,
                joinedAt: new Date().toISOString(),
              };
              if (consumer.kind === "video" && source === 'screen') newParticipant.screenTrack = consumer.track as MediaStreamTrack;
              else if (consumer.kind === "video") newParticipant.videoTrack = consumer.track as MediaStreamTrack;
              if (consumer.kind === "audio") newParticipant.audioTrack = consumer.track as MediaStreamTrack;
              
              return [...prev, newParticipant];
            }
          });
        };

        await client.connect();
        webrtcClient.current = client;

      } catch (err) {
        console.error("WebRTC Connection Error:", err);
        setWebrtcStatus("failed");
      }
    };

    connectToMeeting();

    return () => {
      if (client) {
        client.disconnect();
        if (webrtcClient.current === client) {
          webrtcClient.current = null;
        }
      }
    };
  }, [roomSlug, currentUser.name, currentUser.id]);

  // ── Initialize Local Media upon WebRTC connect ────────
  useEffect(() => {
    if (webrtcStatus === "connected" && webrtcClient.current) {
      const client = webrtcClient.current;

      const initMedia = async () => {
        try {
          // DO NOT auto-enable camera on join
          const audioTrack = await client.enableMic();
          localAudioTrackRef.current = audioTrack;

          setParticipants((prev) =>
            prev.map((p) => {
              if (p.id === currentUser.id) {
                return { ...p, audioTrack, isCameraOn: false, isMuted: false };
              }
              return p;
            })
          );
        } catch (e) {
          console.error("Failed to enable local media", e);
        }
      };

      initMedia();
    }
  }, [webrtcStatus, currentUser.id]);

  // ── Device Management ────────────────────────────────
  const fetchDevices = async () => {
    try {
      // Must request permission first, otherwise device labels are empty
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {});
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      
      setDevices({
        audioInputs: allDevices.filter((d) => d.kind === "audioinput"),
        videoInputs: allDevices.filter((d) => d.kind === "videoinput"),
        audioOutputs: allDevices.filter((d) => d.kind === "audiooutput"),
      });
    } catch (e) {
      console.error("Failed to enumerate devices", e);
    }
  };

  useEffect(() => {
    fetchDevices();

    // Re-fetch when devices are plugged/unplugged
    navigator.mediaDevices.addEventListener("devicechange", fetchDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", fetchDevices);
    };
  }, []);

  const switchDevice = useCallback(async (kind: 'audioInput' | 'videoInput' | 'audioOutput', deviceId: string) => {
    setSelectedDevices(prev => ({ ...prev, [kind]: deviceId }));

    if (kind === 'audioOutput') {
      return;
    }

    const type = kind === 'audioInput' ? 'audio' : 'video';
    try {
      const newTrack = await webrtcClient.current?.switchDevice(type, deviceId);
      
      if (newTrack) {
        if (type === 'audio') {
          localAudioTrackRef.current = newTrack;
        } else {
          localCameraTrackRef.current = newTrack;
          setParticipants(prev => prev.map(p => 
            p.id === currentUser.id ? { ...p, videoTrack: newTrack } : p
          ));
        }
      }
    } catch (e) {
      console.error(`Failed to switch ${type} device`, e);
      toast.error(`Could not switch ${type} device`);
    }
  }, [currentUser.id]);

  // ── Timer ────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setMeetingDuration((d) => d + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Muted Talking Detection ────────────────────────────
  useEffect(() => {
    if (!isMuted || !localAudioTrackRef.current) return;

    let lastAlertTime = 0;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(new MediaStream([localAudioTrackRef.current]));
    microphone.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationFrameId: number;

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const average = sum / bufferLength;

      if (average > 15 && Date.now() - lastAlertTime > 5000) {
        toast.warning("Your mic is muted. Unmute to speak", { duration: 3000 });
        try {
          const beep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
          beep.volume = 0.2;
          beep.play().catch(() => { });
        } catch (e) { }
        lastAlertTime = Date.now();
      }
      animationFrameId = requestAnimationFrame(checkVolume);
    };
    checkVolume();

    return () => {
      cancelAnimationFrame(animationFrameId);
      audioContext.close().catch(() => { });
    };
  }, [isMuted]);

  // ── Actions ──────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const newState = !isMuted;
    if (newState) webrtcClient.current?.pauseMic();
    else webrtcClient.current?.resumeMic();
    webrtcClient.current?.sendMuteState(newState);
    setIsMuted(newState);
    setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isMuted: newState } : p));
  }, [isMuted, currentUser.id]);

  const toggleCamera = useCallback(() => {
    const newState = !isCameraOn;
    if (!newState) {
      webrtcClient.current?.pauseCamera();
      webrtcClient.current?.sendCameraState(newState);
      setIsCameraOn(newState);
      setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isCameraOn: newState } : p));
    } else {
      if (!localCameraTrackRef.current) {
        // First time turning on camera
        webrtcClient.current?.enableCamera().then(track => {
          localCameraTrackRef.current = track;
          webrtcClient.current?.sendCameraState(newState);
          setIsCameraOn(newState);
          setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isCameraOn: newState, videoTrack: track } : p));
        }).catch(err => console.error("Failed to enable camera:", err));
      } else {
        webrtcClient.current?.resumeCamera();
        webrtcClient.current?.sendCameraState(newState);
        setIsCameraOn(newState);
        setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isCameraOn: newState } : p));
      }
    }
  }, [isCameraOn, currentUser.id]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        await webrtcClient.current?.disableScreenShare();
        setIsScreenSharing(false);
        setParticipants(prev => prev.map(p =>
          p.id === currentUser.id ? { ...p, isScreenSharing: false, screenTrack: null } : p
        ));
      } else {
        const screenTrack = await webrtcClient.current?.enableScreenShare();
        if (screenTrack) {
          setIsScreenSharing(true);
          setParticipants(prev => prev.map(p =>
            p.id === currentUser.id ? { ...p, isScreenSharing: true, screenTrack } : p
          ));
          screenTrack.onended = async () => {
            await webrtcClient.current?.disableScreenShare();
            setIsScreenSharing(false);
            setParticipants(prev => prev.map(p =>
              p.id === currentUser.id ? { ...p, isScreenSharing: false, screenTrack: null } : p
            ));
          };
        }
      }
    } catch (e) {
      console.error("Screen share error:", e);
    }
  }, [isScreenSharing, currentUser.id]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setIsRecording(false);
      toast.success("Recording stopped and downloaded");
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" },
          audio: true,
        });

        const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
          ? 'video/webm; codecs=vp9'
          : 'video/webm';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `meeting-recording-${new Date().toISOString().slice(0,10)}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setIsRecording(false);
          stream.getTracks().forEach(t => t.stop());
        };

        // If user manually clicks "Stop sharing" on the browser banner
        stream.getVideoTracks()[0].onended = () => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        };

        recorder.start(1000); // chunk every second
        setIsRecording(true);
        toast.success("Recording started. Please keep this tab open.");
      } catch (e: any) {
        if (e.name !== "NotAllowedError") {
          console.error("Failed to start recording:", e);
          toast.error("Failed to start recording. Please check permissions.");
        }
      }
    }
  }, [isRecording]);
  const toggleHandRaise = useCallback(() => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    webrtcClient.current?.sendHandRaise(newState);
    setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isHandRaised: newState } : p));
  }, [isHandRaised, currentUser.id]);

  const sendMessage = useCallback(
    (content: string, targetUserId?: string, fileUrl?: string) => {
      webrtcClient.current?.sendChatMessage(content, targetUserId, fileUrl);
      const msg: ChatMessage = {
        id: `m-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        content,
        timestamp: new Date().toISOString(),
        targetUserId,
        isPrivate: !!targetUserId,
        fileUrl,
      };
      setChatMessages((prev) => [...prev, msg]);
    },
    [currentUser]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      webrtcClient.current?.sendReaction(emoji);
      const reaction: Reaction = {
        id: `r-${Date.now()}`,
        emoji,
        senderId: currentUser.id,
        senderName: currentUser.name,
        timestamp: Date.now(),
      };
      setReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
    },
    [currentUser]
  );

  const votePoll = useCallback((pollId: string, optionId: string) => {
    webrtcClient.current?.votePoll(pollId, optionId);
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        return {
          ...p,
          myVote: optionId,
          totalVotes: p.totalVotes + 1,
          options: p.options.map((o) =>
            o.id === optionId ? { ...o, votes: o.votes + 1 } : o
          ),
        };
      })
    );
  }, []);

  const createPoll = useCallback((question: string, optionsText: string[]) => {
    const pollId = `p-${Date.now()}`;
    const options = optionsText.map((t, i) => ({ id: `o${i + 1}`, text: t, votes: 0 }));
    webrtcClient.current?.createPoll(pollId, question, options);

    setPolls(prev => [...prev, {
      id: pollId,
      question,
      options,
      createdBy: currentUser.id,
      isActive: true,
      totalVotes: 0
    }]);
  }, [currentUser]);

  const updateSharedNote = useCallback((content: string) => {
    setSharedNoteContent(content);
    webrtcClient.current?.sendNoteUpdate(content);
  }, []);

  const handleSetActivePanel = useCallback(
    (panel: SidePanel) => {
      setActivePanel((prev) => (prev === panel ? null : panel));
      if (panel !== null) {
        setIsMobilePanelOpen(true);
      }
    },
    []
  );

  const admitUser = useCallback((userId: string) => {
    webrtcClient.current?.sendAdmitUser(userId);
    setWaitingUsers(prev => prev.filter(u => u.userId !== userId));
  }, []);

  const denyUser = useCallback((userId: string) => {
    webrtcClient.current?.sendDenyUser(userId);
    setWaitingUsers(prev => prev.filter(u => u.userId !== userId));
  }, []);

  const kickUser = useCallback((userId: string) => {
    webrtcClient.current?.sendKickUser(userId);
  }, []);

  const forceMuteUser = useCallback((userId?: string) => {
    webrtcClient.current?.sendForceMute(userId);
  }, []);

  const endMeetingForAll = useCallback(() => {
    webrtcClient.current?.sendEndMeeting();
  }, []);

  const broadcastECinema = useCallback((link: string | null) => {
    setECinemaLink(link); // Optimistic local update
    webrtcClient.current?.sendECinemaUpdate(link);
  }, []);

  return (
    <MeetingContext.Provider
      value={{
        participants,
        waitingUsers,
        currentUser,
        chatMessages,
        polls,
        sharedNoteContent,
        meetingInfo,
        reactions,
        activePanel,
        layoutMode,
        isMuted,
        isCameraOn,
        isScreenSharing,
        isRecording,
        isHandRaised,
        showLeaveDialog,
        showReactionPicker,
        meetingDuration,
        isMobilePanelOpen,
        webrtcStatus,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        toggleRecording,
        toggleHandRaise,
        setActivePanel: handleSetActivePanel,
        setLayoutMode,
        sendMessage,
        sendReaction,
        votePoll,
        createPoll,
        updateSharedNote,
        setShowLeaveDialog,
        setShowReactionPicker,
        setIsMobilePanelOpen,
        admitUser,
        denyUser,
        kickUser,
        forceMuteUser,
        endMeetingForAll,
        broadcastECinema,
        eCinemaLink,
        devices,
        selectedDevices,
        switchDevice,
        isAINoiseSuppressionEnabled,
        toggleAINoiseSuppression: async (enable: boolean) => {
          try {
            const loadingToast = toast.loading(enable ? "Initializing AI Noise Suppression..." : "Disabling AI Noise Suppression...");
            const newTrack = await webrtcClient.current?.setAINoiseSuppression(enable);
            
            if (newTrack) {
              localAudioTrackRef.current = newTrack;
              setParticipants((prev) =>
                prev.map((p) =>
                  p.id === currentUser.id ? { ...p, audioTrack: newTrack } : p
                )
              );
            }

            setIsAINoiseSuppressionEnabled(enable);
            toast.dismiss(loadingToast);
            if (enable) {
              toast.success("AI Noise Suppression is active. Background sounds will be muted.");
            } else {
              toast.info("Reverted to basic noise suppression.");
            }
          } catch (e) {
            console.error("Failed to toggle AI Noise Suppression", e);
            toast.error("Failed to apply AI noise suppression.");
            setIsAINoiseSuppressionEnabled(false);
          }
        },
        isHDVideoEnabled,
        setIsHDVideoEnabled: updateHDVideo,
        isMirrorVideoEnabled,
        setIsMirrorVideoEnabled: updateMirrorVideo,
        isLowBandwidthEnabled,
        setIsLowBandwidthEnabled: updateLowBandwidth,
        isAlwaysMuteOnJoin,
        setIsAlwaysMuteOnJoin: updateAlwaysMute,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
}
