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
  GridOverflowMode,
  ParticipantRole,
  CaptionMessage,
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
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

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
  hasUnreadChat: boolean;
  layoutMode: LayoutMode;
  gridOverflowMode: GridOverflowMode;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isHandRaised: boolean;
  showLeaveDialog: boolean;
  showReactionPicker: boolean;
  showDonationModal: boolean;
  meetingDuration: number; // seconds
  isMobilePanelOpen: boolean;
  webrtcStatus: string;
  eCinemaLink: string | null;
  isCaptionsEnabled: boolean;
  captions: CaptionMessage[];
  captionLanguage: string;
  translationLanguage: string;
  isDonationActive: boolean;

  // Actions
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleRecording: () => void;
  toggleHandRaise: () => void;
  toggleCaptions: () => void;
  toggleDonation: () => void;
  sendDonationSuccess: (amount: number, currency: string) => void;
  setCaptionLanguage: (lang: string) => void;
  setTranslationLanguage: (lang: string) => void;
  setActivePanel: (panel: SidePanel) => void;
  setHasUnreadChat: (has: boolean) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setGridOverflowMode: (mode: GridOverflowMode) => void;
  sendMessage: (content: string, targetUserId?: string, fileUrl?: string) => void;
  sendReaction: (emoji: string) => void;
  votePoll: (pollId: string, optionId: string) => void;
  createPoll: (question: string, options: string[]) => void;
  updateSharedNote: (content: string) => void;
  setShowLeaveDialog: (show: boolean) => void;
  setShowReactionPicker: (show: boolean) => void;
  setShowDonationModal: (show: boolean) => void;
  setIsMobilePanelOpen: (open: boolean) => void;
  admitUser: (userId: string) => void;
  denyUser: (userId: string) => void;
  kickUser: (userId: string) => void;
  forceMuteUser: (userId?: string) => void;
  endMeetingForAll: () => void;
  leaveMeeting: () => void;
  broadcastECinema: (link: string | null) => void;
  ecinemaAction: { action: 'play' | 'pause'; time?: number } | null;
  sendECinemaAction: (action: 'play' | 'pause', time?: number) => void;
  
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
  // Extract user info from sessionStorage (passed from Join screen)
  let storedJoinInfo: any = null;
  if (typeof window !== "undefined") {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let sessionToken = searchParams.get("t");
      
      // If external API passed a token in the URL, save it to sessionStorage
      if (sessionToken) {
        sessionStorage.setItem("conn3ct_session_token", sessionToken);
        // Clean the URL without triggering a page reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
      
      // We no longer read raw join info from sessionStorage, we only care about the sessionToken.
      // But we still need fallback logic for queryName etc. if missing.
    } catch (e) {
      console.error("Failed to parse external token", e);
    }
  }

  // For the initial render, use URL search params as a fallback for backwards compatibility
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const queryName = storedJoinInfo?.name || searchParams.get("name") || "Guest";
  const queryEmail = storedJoinInfo?.email || "guest@conn3ct.com";
  const queryRole = storedJoinInfo?.role || (searchParams.get("role") as ParticipantRole) || "attendee";
  const initialCameraOn = storedJoinInfo ? storedJoinInfo.camera : searchParams.get("camera") !== "false";
  const initialMuted = storedJoinInfo ? !storedJoinInfo.mic : searchParams.get("mic") === "false";

  // ── State ────────────────────────────────────────────
  const isMobileClient = typeof navigator !== 'undefined' ? 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;

  const [currentUser] = useState<Participant>({
    id: `u-${Math.random().toString(36).substring(2, 9)}`,
    name: queryName,
    role: queryRole,
    isMuted: initialMuted,
    isCameraOn: initialCameraOn,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date().toISOString(),
    isMobile: isMobileClient,
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

  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    ...mockMeetingInfo,
    roomName: formattedTitle,
    roomSlug,
  });
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);
  const activePanelRef = useRef<SidePanel>(null);
  useEffect(() => { activePanelRef.current = activePanel; }, [activePanel]);
  const [hasUnreadChat, setHasUnreadChat] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [gridOverflowMode, setGridOverflowMode] = useState<GridOverflowMode>("paginate");
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isCameraOn, setIsCameraOn] = useState(initialCameraOn);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState("disconnected");
  const [eCinemaLink, setECinemaLink] = useState<string | null>(null);
  const [ecinemaAction, setEcinemaAction] = useState<{ action: 'play' | 'pause'; time?: number } | null>(null);
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  const [isDonationActive, setIsDonationActive] = useState(false);
  const [captions, setCaptions] = useState<CaptionMessage[]>([]);
  const [captionLanguage, setCaptionLanguage] = useState("en-US");
  const [translationLanguage, setTranslationLanguage] = useState("original");
  const translationLanguageRef = useRef("original");
  const [isAINoiseSuppressionEnabled, setIsAINoiseSuppressionEnabled] = useState(false);
  
  useEffect(() => {
    translationLanguageRef.current = translationLanguage;
  }, [translationLanguage]);
  
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
  const notifiedWaitingUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let client: WebRTCClient | null = null;

    const connectToMeeting = async () => {
      try {
        setWebrtcStatus("fetching-token");

        // Call our new Next.js endpoint to get a secure JWT
        const isBot = new URLSearchParams(window.location.search).get('bot') === 'true';
        const sessionToken = typeof window !== "undefined" ? sessionStorage.getItem("conn3ct_session_token") : null;

        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: roomSlug,
            sessionToken,
            isBot
          })
        });

        const data = await res.json();

        if (res.status === 403) {
          toast.error("Your join session is invalid or expired. Please join again.");
          setWebrtcStatus("invalid-session");
          return;
        }

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

            if (quality === 'bad') {
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

              if (webrtcClient.current && !webrtcClient.current.isAudioOnlyMode) {
                toast.error("Network is extremely poor. Switching to Audio-Only mode to save bandwidth.", { duration: 6000 });
                webrtcClient.current.enableAudioOnlyMode();
                webrtcClient.current.sendCameraState(false);
                setIsCameraOn(false);
                setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isCameraOn: false } : p));
              }
              lastNetworkToastTime = now;
            } else if (quality === 'poor') {
              toast.warning("Network connection is weak. Video or Audio quality might be degraded.");
              lastNetworkToastTime = now;
            } else if (quality === 'good') {
              if (webrtcClient.current && webrtcClient.current.isAudioOnlyMode) {
                toast.success("Network connection stabilized. Resuming incoming video streams.", { duration: 5000 });
                webrtcClient.current.disableAudioOnlyMode();
              }
            }
            
            // Update local user's network quality indicator
            setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, networkQuality: quality } : p));
          }
        };

        client.onDonationStatusReceived = (active) => {
          setIsDonationActive(active);
          if (active) {
            toast.info("The host has enabled Donations/Offerings.");
          } else {
            toast.info("Donations/Offerings have been disabled.");
          }
        };

        client.onDonationSuccessReceived = (userId, name, amount, currency) => {
          if (currentUser.role === 'host' || currentUser.role === 'co-host') {
            toast.success(`${name} just donated ${currency} ${amount}!`, {
              icon: "🎁",
              duration: 5000,
            });
          }
        };

        client.onParticipantNetworkQuality = (userId, quality) => {
          setParticipants(prev => prev.map(p => p.id === userId ? { ...p, networkQuality: quality } : p));
        };

        client.onRecordingStarted = () => {
          setIsRecording(true);
          toast.info("This meeting is now being recorded.", { icon: "🔴" });
        };

        client.onRecordingStopped = () => {
          setIsRecording(false);
          toast.info("Recording has stopped.");
        };

        client.onSyncPanel = (panel: any) => {
          // Only sync the panel view for the recording bot so it matches the host's screen
          if (currentUser.role === 'bot') {
            setActivePanel(panel);
          }
        };

        client.onCaptionReceived = (userId, text, isFinal, lang) => {
          const tLang = translationLanguageRef.current;
          
          const updateLocalCaption = (newText: string) => {
            setParticipants((prev) => {
              const sender = prev.find((p) => p.id === userId);
              const senderName = sender?.name || `Participant ${userId.substring(5, 9)}`;
              
              setCaptions(currCaptions => {
                const newCaptions = [...currCaptions];
                const lastIdx = newCaptions.findIndex(c => c.userId === userId && !c.isFinal);
                if (lastIdx >= 0) {
                  newCaptions[lastIdx] = { userId, name: senderName, text: newText, isFinal, timestamp: Date.now() };
                } else {
                  newCaptions.push({ userId, name: senderName, text: newText, isFinal, timestamp: Date.now() });
                }
                if (newCaptions.length > 4) return newCaptions.slice(newCaptions.length - 4);
                return newCaptions;
              });
              return prev;
            });
          };

          // Immediately update with original text
          updateLocalCaption(text);

          // If final, check if we need to translate
          if (isFinal && tLang !== 'original' && lang !== tLang) {
            fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, targetLanguage: tLang })
            })
            .then(res => res.json())
            .then(data => {
              if (data.translation) {
                // Update the caption again but with the translated text
                updateLocalCaption(data.translation);
              }
            })
            .catch(err => console.error('Translation failed', err));
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
          if (msg.userId !== webrtcClient.current?.userId) {
            setSharedNoteContent(msg.content);
          }
        };

        client.onChatMessage = (msg) => {
          if (msg.userId !== webrtcClient.current?.userId) {
            // Play a prominent "Ding-Ding" notification sound for chat
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              
              const playBeep = (timeOffset: number) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, audioCtx.currentTime + timeOffset);
                osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + timeOffset + 0.1);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime + timeOffset);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + timeOffset + 0.1);
                osc.start(audioCtx.currentTime + timeOffset);
                osc.stop(audioCtx.currentTime + timeOffset + 0.15);
              };

              playBeep(0);
              playBeep(0.2);
            } catch (e) { }

            if (activePanelRef.current !== "chat") {
              setHasUnreadChat(true);
            }
          }

          setChatMessages((prev) => {
            if (msg.id && prev.some(m => m.id === msg.id)) return prev;

            return [
              ...prev,
              {
                id: msg.id || `m-${Date.now()}-${Math.random()}`,
                senderId: msg.userId,
                senderName: msg.userId === webrtcClient.current?.userId
                  ? webrtcClient.current?.userName || 'Guest'
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
          setPolls((prev) => {
            if (prev.some(p => p.id === msg.pollId)) return prev;
            return [
              ...prev,
              {
                id: msg.pollId,
                question: msg.question,
                options: msg.options,
                createdBy: msg.userId,
                isActive: true,
                totalVotes: 0,
              },
            ];
          });
          
          // Automatically open the polls panel for everyone when a new poll is created
          setActivePanel("polls");
          setIsMobilePanelOpen(true);
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

        client.onECinemaAction = (msg) => {
          setEcinemaAction({ action: msg.action, time: msg.time });
        };

        client.onCameraState = (msg) => {
          setParticipants((prev) => prev.map(p =>
            p.id === msg.userId ? { ...p, isCameraOn: msg.isCameraOn } : p
          ));
        };

        client.onHandRaise = (msg) => {
          if (msg.isHandRaised && msg.userId !== webrtcClient.current?.userId) {
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
            isSpeaking: userIds.includes(p.id) || (p.id === currentUser.id && userIds.includes(webrtcClient.current?.userId || ''))
          })));
        };

        client.onWaitingRoomRequest = (msg) => {
          if (notifiedWaitingUsersRef.current.has(msg.userId)) {
            return;
          }
          notifiedWaitingUsersRef.current.add(msg.userId);

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
              onClick: () => {
                webrtcClient.current?.sendAdmitUser(msg.userId);
                notifiedWaitingUsersRef.current.delete(msg.userId);
              }
            }
          });

          setWaitingUsers(prev => {
            if (prev.find(u => u.userId === msg.userId)) return prev;
            return [...prev, { userId: msg.userId, name: msg.name }];
          });
        };

        client.onConnectionStateChange = (state) => {
          if (webrtcClient.current === client) {
            setWebrtcStatus(state);
            if (state === 'connected') {
              // Update local user's name and role based on server truth
              setParticipants(prev => prev.map(p => 
                p.id === currentUser.id ? { ...p, name: webrtcClient.current?.userName || 'Guest', role: (webrtcClient.current?.userRole || 'attendee') as any } : p
              ));
              if (webrtcClient.current?.roomName) {
                setMeetingInfo(prev => ({ ...prev, roomName: webrtcClient.current!.roomName! }));
              }
            } else if (state === 'waiting') {
              if (webrtcClient.current?.roomName) {
                setMeetingInfo(prev => ({ ...prev, roomName: webrtcClient.current!.roomName! }));
              }
            } else if (state === 'kicked') {
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
              if (p.userId === webrtcClient.current?.userId) continue;
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
                  networkQuality: 'good',
                  joinedAt: new Date().toISOString(),
                  isConnecting: true,
                  isMobile: p.isMobile,
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
          if (user.userId === webrtcClient.current?.userId) return;
          setWaitingUsers(prev => prev.filter(u => u.userId !== user.userId));
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
              networkQuality: 'good',
              joinedAt: new Date().toISOString(),
              isConnecting: true,
              isMobile: user.isMobile,
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
            if (user && user.id !== webrtcClient.current?.userId && user.id !== currentUser.id) {
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
          let videoTrack: MediaStreamTrack | null = null;
          let audioTrack: MediaStreamTrack | null = null;

          if (isCameraOn) {
            videoTrack = await client.enableCamera();
            localCameraTrackRef.current = videoTrack;
          }
          
          audioTrack = await client.enableMic();
          localAudioTrackRef.current = audioTrack;
          if (isMuted) {
            client.pauseMic();
          }

          setParticipants((prev) =>
            prev.map((p) => {
              if (p.id === currentUser.id) {
                return { ...p, videoTrack: videoTrack || undefined, audioTrack: audioTrack || undefined, isCameraOn, isMuted };
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
      webrtcClient.current?.sendStopRecording();
      setIsRecording(false);
      toast.success("Recording stopped. It is being processed and will be saved to cloud.");
    } else {
      webrtcClient.current?.sendStartRecording();
      setIsRecording(true);
      toast.success("Recording started in the cloud.");
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

  const { startListening, stopListening } = useSpeechRecognition({
    language: captionLanguage,
    onResult: (text, isFinal) => {
      // Add locally
      setCaptions(curr => {
        const newCaptions = [...curr];
        const lastIdx = newCaptions.findIndex(c => c.userId === currentUser.id && !c.isFinal);
        if (lastIdx >= 0) {
          newCaptions[lastIdx] = { userId: currentUser.id, name: currentUser.name, text, isFinal, timestamp: Date.now() };
        } else {
          newCaptions.push({ userId: currentUser.id, name: currentUser.name, text, isFinal, timestamp: Date.now() });
        }
        if (newCaptions.length > 4) return newCaptions.slice(newCaptions.length - 4);
        return newCaptions;
      });
      // Broadcast
      webrtcClient.current?.sendCaption(text, isFinal, captionLanguage);
    }
  });

  const toggleCaptions = useCallback(() => {
    setIsCaptionsEnabled(prev => {
      const newState = !prev;
      if (newState) {
        startListening();
        toast.success("Live Captions enabled");
      } else {
        stopListening();
        setCaptions([]);
        toast.info("Live Captions disabled");
      }
      return newState;
    });
  }, [startListening, stopListening]);

  const toggleDonation = useCallback(() => {
    if (currentUser.role === 'host' || currentUser.role === 'co-host') {
      const newState = !isDonationActive;
      setIsDonationActive(newState);
      webrtcClient.current?.sendDonationStatus(newState);
      toast.success(newState ? "Donations enabled for participants." : "Donations disabled.");
    } else {
      toast.error("Only the host can enable donations.");
    }
  }, [isDonationActive, currentUser.role]);

  const sendDonationSuccess = useCallback((amount: number, currency: string) => {
    webrtcClient.current?.sendDonationSuccess(amount, currency);
  }, []);

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
      const newPanel = activePanel === panel ? null : panel;
      setActivePanel(newPanel);
      if (newPanel !== null) {
        setIsMobilePanelOpen(true);
      }
      
      if (newPanel === "chat") {
        setHasUnreadChat(false);
      }
      
      // If host, sync the panel state so the recorder bot captures it
      // Don't sync 'participants' or 'settings' as those are private to the host
      if (currentUser.role === 'host' || currentUser.role === 'co-host') {
        if (newPanel !== 'participants' && newPanel !== 'settings') {
          webrtcClient.current?.sendSyncPanel(newPanel);
        } else {
          // If the host opened a private panel, tell the bot to close its panel so it doesn't get stuck
          webrtcClient.current?.sendSyncPanel(null);
        }
      }
    },
    [activePanel, currentUser.role]
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

  const leaveMeeting = useCallback(() => {
    webrtcClient.current?.sendLeaveMeeting();
  }, []);

  const broadcastECinema = useCallback((link: string | null) => {
    setECinemaLink(link); // Optimistic local update
    webrtcClient.current?.sendECinemaUpdate(link);
  }, []);

  const sendECinemaAction = useCallback((action: 'play' | 'pause', time?: number) => {
    // We don't optimistically update here because the YouTube player handles its own state for the host
    webrtcClient.current?.sendECinemaAction(action, time);
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
        hasUnreadChat,
        layoutMode,
        gridOverflowMode,
        isMuted,
        isCameraOn,
        isScreenSharing,
        isRecording,
        isHandRaised,
        showLeaveDialog,
        showReactionPicker,
        showDonationModal,
        meetingDuration,
        isMobilePanelOpen,
        webrtcStatus,
        isCaptionsEnabled,
        captions,
        captionLanguage,
        translationLanguage,
        isDonationActive,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        toggleRecording,
        toggleHandRaise,
        toggleCaptions,
        toggleDonation,
        sendDonationSuccess,
        setCaptionLanguage,
        setTranslationLanguage,
        setActivePanel: handleSetActivePanel,
        setHasUnreadChat,
        setLayoutMode,
        setGridOverflowMode,
        sendMessage,
        sendReaction,
        votePoll,
        createPoll,
        updateSharedNote,
        setShowLeaveDialog,
        setShowReactionPicker,
        setShowDonationModal,
        setIsMobilePanelOpen,
        admitUser,
        denyUser,
        kickUser,
        forceMuteUser,
        endMeetingForAll,
        leaveMeeting,
        broadcastECinema,
        eCinemaLink,
        ecinemaAction,
        sendECinemaAction,
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
      <GlobalAudioRenderer participants={participants} currentUserId={currentUser.id} />
      {children}
    </MeetingContext.Provider>
  );
}

function GlobalAudioRenderer({ participants, currentUserId }: { participants: Participant[]; currentUserId: string }) {
  const { selectedDevices } = useMeeting();
  return (
    <>
      {participants.map((p) => (
        <AudioRenderer key={p.id} track={p.audioTrack} isLocal={p.id === currentUserId} audioOutput={selectedDevices.audioOutput} />
      ))}
    </>
  );
}

function AudioRenderer({ track, isLocal, audioOutput }: { track?: MediaStreamTrack | null; isLocal: boolean; audioOutput: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const applyAudioSink = async (el: HTMLAudioElement, sinkId: string) => {
    if (sinkId && typeof (el as any).setSinkId === "function") {
      try {
        await (el as any).setSinkId(sinkId);
      } catch (e) {
        console.warn("Failed to set audio output device:", e);
      }
    }
  };

  useEffect(() => {
    if (audioRef.current && track && !isLocal) {
      if (audioRef.current.srcObject) {
        const stream = audioRef.current.srcObject as MediaStream;
        if (stream.getAudioTracks()[0] === track) {
          applyAudioSink(audioRef.current, audioOutput);
          return;
        }
      }
      audioRef.current.srcObject = new MediaStream([track]);
      applyAudioSink(audioRef.current, audioOutput);
      audioRef.current.play().catch((e) => {
        if (e.name !== 'AbortError') console.warn("Global audio play failed:", e);
      });
    } else if (audioRef.current && (!track || isLocal)) {
      audioRef.current.srcObject = null;
    }
  }, [track, isLocal, audioOutput]);

  return <audio ref={audioRef} autoPlay muted={isLocal} style={{ display: 'none' }} />;
}
