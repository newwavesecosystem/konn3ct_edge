"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  RoomSettings,
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
import { useMeetingDevicePreferences } from "./meeting-device-preferences";

let lastChatToastTime = 0;
let lastChatSoundTime = 0;
let joinLeaveBatchCount = 0;
let joinLeaveBatchTimeout: ReturnType<typeof setTimeout> | null = null;
let leaveBatchCount = 0;
let leaveBatchTimeout: ReturnType<typeof setTimeout> | null = null;
export const REACTION_DURATION = 10000;

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
  markChatMessageRendered: (messageId: string) => void;
  layoutMode: LayoutMode;
  gridOverflowMode: GridOverflowMode;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  recordingStatus: 'idle' | 'starting' | 'recording' | 'processing' | 'ready' | 'failed';
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
  roomFeatureFlags: {
    aiFeaturesEnabled: boolean;
    captionsEnabled: boolean;
    donationsEnabled: boolean;
    virtualBackgroundEnabled: boolean;
  };
  translationLanguage: string;
  isDonationActive: boolean;
  totalDonations: number;
  captionSize: number;
  micExempted: boolean;

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
  setCaptionSize: (size: number) => void;
  setActivePanel: (panel: SidePanel) => void;
  setHasUnreadChat: (has: boolean) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setGridOverflowMode: (mode: GridOverflowMode) => void;
  sendMessage: (content: string, targetUserId?: string, fileUrl?: string) => void;
  sendReaction: (emoji: string) => void;
  votePoll: (pollId: string, optionId: string) => void;
  endPoll: (pollId: string) => void;
  createPoll: (question: string, options: string[]) => void;
  updateSharedNote: (content: string) => void;
  setShowLeaveDialog: (show: boolean) => void;
  setShowReactionPicker: (show: boolean) => void;
  setShowDonationModal: (show: boolean) => void;
  setIsMobilePanelOpen: (open: boolean) => void;
  admitUser: (userId: string) => void;
  denyUser: (userId: string) => void;
  admitAllUsers: () => void;
  denyAllUsers: () => void;
  kickUser: (userId: string) => void;
  changeUserRole: (userId: string, newRole: string) => void;
  askToUnmute: (userId: string) => void;
  clearChat: () => void;
  forceMuteUser: (userId?: string, target?: 'all' | 'all_except_presenters' | 'all_except_hosts') => void;
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
  logoutUrl: string | null;
  outputVolume: number;
  setOutputVolume: (val: number) => void;
  isHDVideoEnabled: boolean;
  setIsHDVideoEnabled: (enabled: boolean) => void;
  isMirrorVideoEnabled: boolean;
  setIsMirrorVideoEnabled: (enabled: boolean) => void;
  isLowBandwidthEnabled: boolean;
  setIsLowBandwidthEnabled: (enabled: boolean) => void;
  isAudioOnlyModeEnabled: boolean;
  setIsAudioOnlyModeEnabled: (enabled: boolean) => void;
  isAlwaysMuteOnJoin: boolean;
  setIsAlwaysMuteOnJoin: (enabled: boolean) => void;
  
  // Virtual Background
  vbMode: 'none' | 'blur' | 'image';
  vbImageUrl?: string;
  handleVbSelect: (mode: 'none' | 'blur' | 'image', imageUrl?: string) => void;

  pauseRemoteVideo: (trackId: string) => void;
  resumeRemoteVideo: (trackId: string) => void;

  roomSettings: RoomSettings;
  updateRoomSettings: (settings: Partial<RoomSettings>) => void;
  forceVideoOffUser: (userId?: string) => void;

  // Q&A
  qaMessages: any[];
  askQuestion: (question: string, isAnonymous: boolean) => void;
  upvoteQuestion: (questionId: string) => void;
  answerQuestion: (questionId: string, answerText: string) => void;
  deleteQuestion: (questionId: string) => void;

  // AI Chat
  aiMessages: { role: 'user' | 'ai'; content: string }[];
  setAiMessages: React.Dispatch<React.SetStateAction<{ role: 'user' | 'ai'; content: string }[]>>;

  // Error Handling
  micError: { name: string; message: string } | null;
  setMicError: (error: { name: string; message: string } | null) => void;
  audioPlaybackError: boolean;
  setAudioPlaybackError: (error: boolean) => void;
  resumeAudioPlayback: () => void;

  // QA Diagnostics
  webrtcClientRef?: React.MutableRefObject<WebRTCClient | null>;
  isRecorderMode: boolean;
  playNotificationSound: (frequency: number, duration?: number, vol?: number) => void;
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
  isRecorderMode = false,
  recorderParticipantId = null,
}: {
  children: React.ReactNode;
  roomSlug: string;
  isRecorderMode?: boolean;
  recorderParticipantId?: string | null;
}) {
  // Extract user info from sessionStorage (passed from Join screen)
  let storedJoinInfo: any = null;
  let initialUrlParams: URLSearchParams | null = null;
  
  if (typeof window !== "undefined") {
    try {
      initialUrlParams = new URLSearchParams(window.location.search);
      let sessionToken = initialUrlParams.get("t");
      
      if (sessionToken) {
        sessionStorage.setItem("conn3ct_session_token", sessionToken);
        // Clean the URL without triggering a page reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else {
        sessionToken = sessionStorage.getItem("conn3ct_session_token");
      }
      
      if (sessionToken) {
        // Decode the JWT payload without verifying signature on client
        const base64Url = sessionToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        storedJoinInfo = JSON.parse(jsonPayload);
      }
    } catch (e) {
      console.error("Failed to parse session token", e);
    }
  }

  // For the initial render, use URL search params as a fallback for backwards compatibility
  const searchParams = initialUrlParams || new URLSearchParams("");
  const queryName = storedJoinInfo?.name || searchParams.get("name") || "Guest";
  const queryEmail = storedJoinInfo?.email || "guest@conn3ct.com";
  const queryRole = storedJoinInfo?.role || (searchParams.get("role") as ParticipantRole) || "attendee";
  const initialCameraOn = storedJoinInfo && storedJoinInfo.camera !== undefined ? storedJoinInfo.camera : searchParams.get("camera") !== "false";
  const initialMuted = storedJoinInfo && storedJoinInfo.mic !== undefined ? !storedJoinInfo.mic : searchParams.get("mic") === "false";
  const initialLogoutUrl = storedJoinInfo?.logoutUrl || null;

  // ── State ────────────────────────────────────────────
  const { preferences } = useMeetingDevicePreferences();
  
  const effectiveIsRecorderMode = isRecorderMode || 
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/recording/')) ||
    storedJoinInfo?.isRecorder ||
    queryRole === 'recorder' ||
    queryRole === 'bot';

  const prefs = effectiveIsRecorderMode ? {
    ...preferences,
    notifications: {
      ...preferences.notifications,
      enableAllToasts: false,
      enableAllSounds: false,
      showChatToasts: false,
      showJoinLeaveToasts: false,
      showMuteUnmuteToasts: false,
      showSystemToasts: false,
      playChatSound: false,
      playJoinLeaveSound: false,
      playMuteUnmuteSound: false,
      playSystemSound: false
    }
  } : preferences;

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Preload virtual backgrounds
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const backgrounds = [
      '/backgrounds/modern_office.png',
      '/backgrounds/cozy_cafe.png',
      '/backgrounds/minimalist_gradient.png'
    ];
    backgrounds.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  const playNotificationSound = useCallback((frequency: number, duration: number = 0.15, vol: number = 0.1) => {
    if (!prefsRef.current.notifications.enableAllSounds) return;
    if (webrtcClient.current?.userRole === 'bot' || webrtcClient.current?.userRole === 'recorder' || effectiveIsRecorderMode) return;
    if (typeof window === 'undefined') return;
    if ((window as any).disableAudioNotifications) return;
    
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        // fail silently if browser blocks sound
        return;
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + duration + 0.05);
    } catch(e) {
      console.log('meeting_notification_sound_blocked', e);
    }
  }, [prefsRef.current.notifications.enableAllSounds, effectiveIsRecorderMode]);
  const isMobileClient = typeof navigator !== 'undefined' ? 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;

  const [clientParticipantId, setClientParticipantId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `konn3ct:participant:${roomSlug}`;
    const existing = sessionStorage.getItem(key);

    if (isRecorderMode && recorderParticipantId) {
      console.log(`recorder_provider_participant_id_set: ${recorderParticipantId}`);
      setClientParticipantId(recorderParticipantId);
      return;
    }

    if (
      existing === "pending" || 
      existing === "ssr-placeholder" || 
      existing === "null" || 
      existing === "undefined" ||
      !existing
    ) {
      sessionStorage.removeItem(key);
    } else if (existing) {
      setClientParticipantId(existing);
      return;
    }

    const generated =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    sessionStorage.setItem(key, generated);
    setClientParticipantId(generated);
  }, [roomSlug]);

  const [initialCurrentUser, setInitialCurrentUser] = useState<Participant>({
    id: clientParticipantId || 'pending',
    userId: storedJoinInfo?.userId || `u-${Math.random().toString(36).substring(2, 9)}`,
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

  useEffect(() => {
    if (clientParticipantId) {
      setInitialCurrentUser(prev => ({ ...prev, id: clientParticipantId }));
    }
  }, [clientParticipantId]);

  // Start with only the current user, so real users are dynamically added
  const [participants, setParticipants] = useState<Participant[]>([initialCurrentUser]);

  useEffect(() => {
    if (clientParticipantId) {
      setParticipants(prev => prev.map(p => p.id === 'pending' || p.id === 'ssr-placeholder' ? { ...p, id: clientParticipantId } : p));
    }
  }, [clientParticipantId]);

  const currentUser = useMemo(() => participants.find(p => p.id === clientParticipantId) || initialCurrentUser, [participants, clientParticipantId, initialCurrentUser]);
  const [waitingUsers, setWaitingUsers] = useState<Array<{ userId: string, name: string }>>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [qaMessages, setQaMessages] = useState<any[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [audioPlaybackError, setAudioPlaybackError] = useState(false);
  
  const resumeAudioPlayback = useCallback(() => {
    setAudioPlaybackError(false);
    // Trigger re-render of AudioRenderers to retry .play()
    setOutputVolume(v => {
      const current = v;
      setTimeout(() => setOutputVolume(current), 50);
      return Math.max(1, v - 1); // slight tweak to trigger effect, then restore
    });
  }, []);

  const markChatMessageRendered = useCallback((messageId: string) => {
    setChatMessages((prev) => 
      prev.map(m => {
        // Prevent contradictory states: a row cannot be rendered and timed-out
        if (m.id === messageId && m.lifecycleState !== 'timed-out' && m.lifecycleState !== 'failed') {
          return { ...m, lifecycleState: 'rendered' };
        }
        return m;
      })
    );
  }, []);

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
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'starting' | 'recording' | 'processing' | 'ready' | 'failed'>('idle');
  const [isRecording, setIsRecording] = useState(false);

  // Sync isRecording with the presence of a bot participant
  useEffect(() => {
    const hasBot = participants.some((p) => p.role === "bot");
    setIsRecording(hasBot);
    if (hasBot) setRecordingStatus('recording');
  }, [participants]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: "ai", content: "Hi! I am Konn3ct AI. I am actively reading the live meeting transcript. Ask me anything about what has been discussed!" }
  ]);
  const [micError, setMicError] = useState<{ name: string; message: string } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState("disconnected");
  const [eCinemaLink, setECinemaLink] = useState<string | null>(null);
  const [ecinemaAction, setEcinemaAction] = useState<{ action: 'play' | 'pause'; time?: number } | null>(null);
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  const [isDonationActive, setIsDonationActive] = useState(false);
  const [totalDonations, setTotalDonations] = useState(0);
  const [captions, setCaptions] = useState<CaptionMessage[]>([]);
  const [captionLanguage, setCaptionLanguage] = useState("en-US");
  const [translationLanguage, setTranslationLanguage] = useState("original");
  const [captionSize, setCaptionSize] = useState(1.0);
  const translationLanguageRef = useRef("original");
  const [isAINoiseSuppressionEnabled, setIsAINoiseSuppressionEnabled] = useState(false);
  
  const [roomFeatureFlags, setRoomFeatureFlags] = useState({
    aiFeaturesEnabled: storedJoinInfo?.aiFeaturesEnabled ?? true,
    captionsEnabled: storedJoinInfo?.captionsEnabled ?? true,
    donationsEnabled: storedJoinInfo?.donationsEnabled ?? true,
    virtualBackgroundEnabled: storedJoinInfo?.virtualBackgroundEnabled ?? true,
  });
  
  useEffect(() => {
    translationLanguageRef.current = translationLanguage;
  }, [translationLanguage]);
  
  // Settings State
  const [isHDVideoEnabled, setIsHDVideoEnabled] = useState(true);
  const [outputVolume, setOutputVolume] = useState(75);
  const [isMirrorVideoEnabled, setIsMirrorVideoEnabled] = useState(true);
  const [isLowBandwidthEnabled, setIsLowBandwidthEnabled] = useState(false);
  const [isAudioOnlyModeEnabled, setIsAudioOnlyModeEnabled] = useState(false);
  const [isAlwaysMuteOnJoin, setIsAlwaysMuteOnJoin] = useState(false);

  const DEFAULT_NETWORK_DETECTION_CONFIG = {
    networkDetectionEnabled: true,
    poorNetworkRttMs: 300,
    poorNetworkLossPercent: 8,
    poorNetworkJitterMs: 60,
    networkWindowSize: 5,
    networkMonitorIntervalMs: 2000,
  };

  const [roomSettings, setRoomSettings] = useState<RoomSettings>({ 
    micLocked: false, 
    videoLocked: false, 
    chatLocked: false,
    ...DEFAULT_NETWORK_DETECTION_CONFIG
  });
  const [micExempted, setMicExempted] = useState(false);

  // Virtual Background
  const [vbMode, setVbMode] = useState<'none' | 'blur' | 'image'>('none');
  const [vbImageUrl, setVbImageUrl] = useState<string | undefined>();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const hasInitializedMediaRef = useRef(false);

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const vol = localStorage.getItem("mtg_outputVolume");
      if (vol !== null) setOutputVolume(Number(vol));

      const hd = localStorage.getItem("mtg_hdVideo");
      if (hd !== null) setIsHDVideoEnabled(hd === "true");

      const mirror = localStorage.getItem("mtg_mirrorVideo");
      if (mirror !== null) setIsMirrorVideoEnabled(mirror === "true");

      const lowBw = localStorage.getItem("mtg_lowBandwidth");
      if (lowBw !== null) setIsLowBandwidthEnabled(lowBw === "true");
      
      const audioOnly = localStorage.getItem("mtg_audioOnlyMode");
      if (audioOnly !== null) setIsAudioOnlyModeEnabled(audioOnly === "true");

      const alwaysMute = localStorage.getItem("mtg_alwaysMute");
      if (alwaysMute !== null) {
        const muteOn = alwaysMute === "true";
        setIsAlwaysMuteOnJoin(muteOn);
        if (muteOn) {
          setIsMuted(true);
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === initialCurrentUser.userId ? { ...p, isMuted: true } : p
            )
          );
        }
      }

      const savedVb = localStorage.getItem("mtg_vb");
      if (savedVb) {
        try {
          const parsedVb = JSON.parse(savedVb);
          if (parsedVb && parsedVb.mode) {
            setVbMode(parsedVb.mode);
            setVbImageUrl(parsedVb.image);
          }
        } catch (e) {}
      }
    }
  }, [initialCurrentUser.id]);

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

  const updateLowBandwidth = useCallback((val: boolean) => {
    setIsLowBandwidthEnabled(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("mtg_lowBandwidth", String(val));
    }
    if (webrtcClient.current && webrtcClient.current.isLowBandwidth !== val) {
      webrtcClient.current.isLowBandwidth = val;
    }
  }, []);

  const updateAudioOnlyMode = useCallback((val: boolean) => {
    setIsAudioOnlyModeEnabled(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("mtg_audioOnlyMode", String(val));
    }
    if (webrtcClient.current && webrtcClient.current.isAudioOnlyMode !== val) {
      if (val) {
        webrtcClient.current.isAudioOnlyMode = true;
        webrtcClient.current.disableCamera();
        localCameraTrackRef.current = null;
        webrtcClient.current.sendCameraState(false, true, 'network');
        setIsCameraOn(false);
        setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, isCameraOn: false, audioOnlyMode: true, videoSuspendedReason: undefined, videoTrack: undefined } : p));
      } else {
        webrtcClient.current.disableAudioOnlyMode();
        webrtcClient.current.sendCameraState(false, false);
        setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, audioOnlyMode: false } : p));
      }
    }
  }, [currentUser.id]);

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
  const localIsSpeakingRef = useRef<boolean>(false);
  const hasLeftMeetingRef = useRef<boolean>(false);

  useEffect(() => {
    if (
      !clientParticipantId || 
      clientParticipantId === 'ssr-placeholder' || 
      clientParticipantId === 'pending' || 
      clientParticipantId === 'null' || 
      clientParticipantId === 'undefined'
    ) {
      console.warn("Blocked meeting connection: invalid participantId", clientParticipantId);
      return;
    }

    let client: WebRTCClient | null = null;

    const connectToMeeting = async () => {
      try {
        hasLeftMeetingRef.current = false;
        hasInitializedMediaRef.current = false;
        setWebrtcStatus("fetching-token");

        // Call our new Next.js endpoint to get a secure JWT
        const searchParamsData = new URLSearchParams(window.location.search);
        const isBot = searchParamsData.get('bot') === 'true';
        const botToken = searchParamsData.get('botToken');
        const sessionToken = typeof window !== "undefined" ? sessionStorage.getItem("conn3ct_session_token") : null;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        if (botToken) {
          headers["Authorization"] = `Bearer ${botToken}`;
        }

        const res = await fetch("/api/join", {
          method: "POST",
          headers,
          body: JSON.stringify({
            roomId: roomSlug,
            sessionToken: sessionToken || undefined,
            isBot: !!botToken,
          }),
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

        client = new WebRTCClient(roomSlug, data.token, clientParticipantId, isRecorderMode);
        client.isHDVideo = isHDVideoEnabled;
        client.isLowBandwidth = isLowBandwidthEnabled;
        client.networkConfig = {
          networkDetectionEnabled: roomSettings.networkDetectionEnabled ?? true,
          poorNetworkRttMs: roomSettings.poorNetworkRttMs ?? 300,
          poorNetworkLossPercent: roomSettings.poorNetworkLossPercent ?? 8,
          poorNetworkJitterMs: roomSettings.poorNetworkJitterMs ?? 60,
          networkWindowSize: roomSettings.networkWindowSize ?? 5,
          networkMonitorIntervalMs: roomSettings.networkMonitorIntervalMs ?? 2000,
        };
        
        // Extract room limits from the JWT token and initialize flags
        if (data.token) {
          try {
            const decoded = JSON.parse(atob(data.token.split('.')[1]));
            if (decoded) {
              setRoomFeatureFlags({
                aiFeaturesEnabled: decoded.aiFeaturesEnabled ?? true,
                captionsEnabled: decoded.captionsEnabled ?? true,
                donationsEnabled: decoded.donationsEnabled ?? true,
                virtualBackgroundEnabled: decoded.virtualBackgroundEnabled ?? true,
              });
              client.isVirtualBackgroundEnabled = decoded.virtualBackgroundEnabled ?? true;
              if (decoded.role && decoded.role !== initialCurrentUser.role) {
                // DO NOT overwrite the role here! The JWT token defaults to 'attendee' and the signaling server 
                // is responsible for dynamically upgrading the user to 'host' via the session_status websocket event.
                // Overwriting it here causes the host to be incorrectly demoted.
              }
            }
          } catch (e) {
            console.error("Failed to decode token for feature flags", e);
          }
        }

        // --- Collaboration Event Listeners ---
        client.onMicError = (error: Error) => {
          setMicError({ name: error.name || 'Microphone Error', message: error.message || 'Unable to access your microphone.' });
          // Ensure the local state reflects that mic is off if it failed to turn on
          setIsMuted(true);
        };

        client.onServerLoadHigh = () => {
          toast.warning("Server is under heavy load. Optimizing video feeds to maintain stability...");
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
            setParticipants(prev => prev.map(p => p.userId === initialCurrentUser.userId ? { ...p, isCameraOn: false } : p));
          }
        };

        client.onServerReject = (msg) => {
          toast.error(msg);
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
            setParticipants(prev => prev.map(p => p.userId === initialCurrentUser.userId ? { ...p, isCameraOn: false } : p));
          }
        };

        client.onAudioTrackReplaced = () => {
          setAudioTrackVersion(v => v + 1);
        };
        let lastNetworkToastTime = 0;
        client.onNetworkQualityChange = (quality) => {
          const now = Date.now();
          const canToast = now - lastNetworkToastTime > 30000;

          if (quality === 'poor_network') {
            if (canToast) {
              if (prefsRef.current.notifications.playSystemSound) {
                // Play Warning Sound (triple beep)
                playNotificationSound(300, 0.1, 0.1);
                setTimeout(() => playNotificationSound(400, 0.1, 0.1), 150);
                setTimeout(() => playNotificationSound(300, 0.1, 0.1), 300);
              }
            }

            if (webrtcClient.current && !webrtcClient.current.isLowBandwidth) {
              if (canToast && prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
                toast.error("Network is extremely poor. Enabling Low Bandwidth mode to save bandwidth.", { duration: 6000 });
                lastNetworkToastTime = now;
              }
              webrtcClient.current.isLowBandwidth = true;
              setIsLowBandwidthEnabled(true);
            }
          } else if (quality === 'unstable_network') {
            if (canToast) {
              lastNetworkToastTime = now;
            }
          } else if (quality === 'good') {
            if (webrtcClient.current && webrtcClient.current.isLowBandwidth) {
              if (canToast && prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
                toast.success("Network connection stabilized. Disabling Low Bandwidth mode.", { duration: 5000 });
                lastNetworkToastTime = now;
              }
              webrtcClient.current.isLowBandwidth = false;
              setIsLowBandwidthEnabled(false);
            }
          }
          
          // Always update local user's network quality indicator
          setParticipants(prev => prev.map(p => p.id === currentUser.id ? { ...p, networkQuality: quality } : p));
        };

        client.onDonationStatusReceived = (active) => {
          setIsDonationActive(active);
          if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
            if (active) {
              toast.info("The host has enabled Donations/Offerings.");
            } else {
              toast.info("Donations/Offerings have been disabled.");
            }
          }
        };

        client.onDonationSuccessReceived = (userId, name, amount, currency) => {
          setTotalDonations(prev => prev + amount);
          if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
            toast.success(`${name} just donated ${currency} ${amount}!`, {
              icon: "🎁",
              duration: 5000,
            });
          }
          if (prefsRef.current.notifications.playSystemSound) {
            playNotificationSound(800, 0.2, 0.1);
          }
        };

        client.onParticipantNetworkQuality = (userId, quality) => {
          setParticipants(prev => prev.map(p => p.id === userId ? { ...p, networkQuality: quality } : p));
        };

        client.onRecordingStarted = () => {
          setIsRecording(true);
          setRecordingStatus('recording');
          if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
            toast.info("This meeting is now being recorded.", { icon: "🔴" });
          }
        };

        client.onRecordingStopped = () => {
          setIsRecording(false);
          setRecordingStatus('idle');
          if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
            toast.info("Recording has stopped.");
          }
        };

        client.onSyncPanel = (panel: any) => {
          // Only sync the panel view for the recording bot so it matches the host's screen
          if (client?.userRole === 'bot') {
            setActivePanel(panel);
          }
        };

        client.onCaptionReceived = (userId, name, text, isFinal, lang) => {
          console.log(`[MeetingContext] onCaptionReceived: ${name} said "${text}" (isFinal: ${isFinal})`);
          const tLang = translationLanguageRef.current;
          
          const updateLocalCaption = (newText: string) => {
            setParticipants((prev) => {
              setCaptions(currCaptions => {
                const newCaptions = [...currCaptions];
                const lastIdx = newCaptions.findIndex(c => c.userId === userId && !c.isFinal);
                const now = Date.now();
                if (lastIdx >= 0) {
                  // If the previous un-finalized caption is more than 5 seconds old, 
                  // don't overwrite it. Push a new one instead.
                  if (now - newCaptions[lastIdx].timestamp > 5000) {
                    newCaptions[lastIdx].isFinal = true;
                    newCaptions.push({ userId, name, text: newText, isFinal, timestamp: now });
                  } else {
                    newCaptions[lastIdx] = { userId, name, text: newText, isFinal, timestamp: now };
                  }
                } else {
                  newCaptions.push({ userId, name, text: newText, isFinal, timestamp: now });
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

        client.onChatCleared = () => {
          setChatMessages([]);
          toast.info("The chat has been cleared by a host.");
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
          const pollsWithDetails = historyPolls.map((poll: any) => {
            let totalVotes = 0;
            let myVote = undefined;
            if (Array.isArray(poll.options)) {
              for (const opt of poll.options) {
                totalVotes += opt.votes || 0;
                if (Array.isArray(opt.votedBy) && opt.votedBy.some((v: any) => typeof v === 'string' ? v === webrtcClient.current?.userId : v.userId === webrtcClient.current?.userId)) {
                  myVote = opt.id;
                }
              }
            }
            return {
              ...poll,
              totalVotes,
              myVote
            };
          });
          setPolls(pollsWithDetails);
        };

        client.onNoteHistory = (content) => {
          setSharedNoteContent(content);
        };

        client.onQAHistory = (messages) => {
          setQaMessages(messages);
        };

        client.onQAUpdated = (msg) => {
          setQaMessages(prev => {
            if (msg.action === 'ask') {
              return [msg.message, ...prev];
            } else if (msg.action === 'upvote' || msg.action === 'answer') {
              return prev.map(q => q.id === msg.message.id ? msg.message : q).sort((a, b) => b.upvotes - a.upvotes);
            } else if (msg.action === 'delete') {
              return prev.filter(q => q.id !== msg.questionId);
            }
            return prev;
          });
        };

        client.onNoteUpdate = (msg) => {
          if (msg.userId !== webrtcClient.current?.userId) {
            setSharedNoteContent(msg.content);
          }
        };

        client.onChatMessage = (msg) => {
          const isSelf = msg.userId === webrtcClient.current?.userId || 
                         msg.participantId === (clientParticipantId || initialCurrentUser.id) ||
                         msg.userId === currentUser.userId;
          if (!isSelf) {
            const now = Date.now();
            if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showChatToasts) {
              if (activePanelRef.current !== "chat") {
                if (now - lastChatToastTime > 2000) {
                  lastChatToastTime = now;
                  const preview = msg.message.length > 80 ? msg.message.substring(0, 80) + "..." : msg.message;
                  toast(`New message from ${msg.name || 'Someone'}`, {
                    description: preview,
                    action: {
                      label: "View",
                      onClick: () => setActivePanel("chat")
                    }
                  });
                  console.log('meeting_notification_shown', 'chat');
                } else {
                  console.log('meeting_notification_suppressed', 'chat_toast_throttled');
                }
              }
            }

            if (prefsRef.current.notifications.playChatSound) {
              if (now - lastChatSoundTime > 3000) {
                lastChatSoundTime = now;
                // Double soft beep for chat
                playNotificationSound(800, 0.1, 0.1);
                setTimeout(() => playNotificationSound(1200, 0.15, 0.1), 150);
                console.log('meeting_notification_sound_played', 'chat');
              } else {
                console.log('meeting_notification_suppressed', 'chat_sound_throttled');
              }
            }

            if (activePanelRef.current !== "chat") {
              setHasUnreadChat(true);
            }
          }

          setChatMessages((prev) => {
            // PRESENCE-002: Split-brain state recovery
            setParticipants((currentParticipants) => {
              const matchId = msg.senderParticipantId || msg.participantId || msg.userId;
              if (matchId && !currentParticipants.some(p => p.id === matchId || p.userId === msg.userId)) {
                client?.emitTelemetry('chat_alive_media_dead');
                setTimeout(() => {
                  if (hasLeftMeetingRef.current) return;
                  setParticipants(curr => curr.map(p => p.id === matchId ? { ...p, isConnecting: false } : p));
                }, 4000);
                return [
                  ...currentParticipants,
                  {
                    id: matchId,
                    userId: msg.userId,
                    name: msg.name || `Participant ${msg.userId.substring(5, 9)}`,
                    role: "attendee",
                    isMuted: true,
                    isCameraOn: false,
                    isScreenSharing: false,
                    isHandRaised: false,
                    isSpeaking: false,
                    networkQuality: 'good',
                    joinedAt: new Date().toISOString(),
                    isConnecting: true,
                    isMobile: false
                  }
                ];
              }
              return currentParticipants;
            });

            if (msg.serverEventId && prev.some(m => m.serverEventId === msg.serverEventId)) {
              return prev.map(m => m.serverEventId === msg.serverEventId ? { ...m, lifecycleState: 'broadcasted' } : m);
            }
            if (msg.clientEventId && prev.some(m => m.clientEventId === msg.clientEventId)) {
               return prev.map(m => m.clientEventId === msg.clientEventId ? { ...m, serverEventId: msg.serverEventId, lifecycleState: 'broadcasted' } : m);
            }
            if (msg.id && prev.some(m => m.id === msg.id)) return prev;

            return [
              ...prev,
              {
                id: msg.serverEventId || msg.id || `m-${Date.now()}-${Math.random()}`,
                clientEventId: msg.clientEventId,
                serverEventId: msg.serverEventId,
                lifecycleState: 'observed',
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

        client.onActionAck = (ack) => {
          if (ack.actionType === 'chat') {
            setChatMessages(prev => prev.map(m => 
              m.clientEventId === ack.clientEventId 
                ? { ...m, serverEventId: ack.serverEventId, lifecycleState: ack.status === 'accepted' ? 'acknowledged' : 'failed' } 
                : m
            ));
          }
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
          setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== reaction.id)), REACTION_DURATION);
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
          // Ignore our own vote broadcast since we already updated it optimistically
          if (msg.userId === webrtcClient.current?.userId) return;

          setPolls((prev) =>
            prev.map((p) => {
              if (p.id !== msg.pollId) return p;
              return {
                ...p,
                totalVotes: p.totalVotes + 1,
                options: p.options.map((o) =>
                  o.id === msg.optionId ? { ...o, votes: o.votes + 1, votedBy: [...(o.votedBy || []), { userId: msg.userId, name: msg.name }] } : o
                ),
              };
            })
          );
        };

        client.onPollEnded = (msg) => {
          setPolls((prev) =>
            prev.map((p) => (p.id === msg.pollId ? { ...p, isActive: false } : p))
          );
        };

        const resolveUserId = (id: string) => id === webrtcClient.current?.userId ? (clientParticipantId || initialCurrentUser.id) : id;

        client.onAudioStatusChanged = (status) => {
          setParticipants((prev) => prev.map(p =>
            p.userId === initialCurrentUser.userId ? { ...p, audioConnectionStatus: status as any } : p
          ));
        };

        client.onRemoteAudioConnectionStatus = (msg) => {
          const targetId = resolveUserId(msg.participantId || msg.userId);
          setParticipants((prev) => prev.map(p =>
            p.id === targetId ? { ...p, audioConnectionStatus: msg.audioConnectionStatus } : p
          ));
        };

        client.onMuteState = (msg) => {
          const targetId = resolveUserId(msg.userId);
          setParticipants((prev) => {
            const user = prev.find(p => p.id === targetId || p.userId === msg.userId);
            if (user && user.isMuted !== msg.isMuted && user.id !== webrtcClient.current?.userId && user.id !== currentUser.id) {
              if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showMuteUnmuteToasts) {
                toast.info(`${user.name} is now ${msg.isMuted ? 'muted' : 'unmuted'}`);
              }
              if (prefsRef.current.notifications.playMuteUnmuteSound) {
                playNotificationSound(msg.isMuted ? 300 : 500, 0.1, 0.05);
              }
            }
            return prev.map(p =>
              (p.id === targetId || p.userId === msg.userId) ? { ...p, isMuted: msg.isMuted } : p
            );
          });
        };

        client.onECinemaAction = (msg) => {
          setEcinemaAction({ action: msg.action, time: msg.time });
        };

        client.onCameraState = (msg) => {
          const targetId = resolveUserId(msg.userId);
          setParticipants((prev) => prev.map(p =>
            (p.id === targetId || p.userId === msg.userId) ? { ...p, isCameraOn: msg.isCameraOn, audioOnlyMode: msg.audioOnlyMode, videoSuspendedReason: msg.videoSuspendedReason } : p
          ));
        };

        client.onHandRaise = (msg) => {
          const targetId = resolveUserId(msg.userId);
          if (msg.isHandRaised && msg.userId !== webrtcClient.current?.userId) {
            if (prefsRef.current.notifications.playSystemSound) {
              playNotificationSound(880, 0.3, 0.1);
            }
            if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
              const user = participants.find(p => p.id === targetId || p.userId === msg.userId);
              if (user) {
                toast.info(`${user.name} raised their hand`);
              }
            }
          }
          setParticipants((prev) => prev.map(p =>
            (p.id === targetId || p.userId === msg.userId) ? { ...p, isHandRaised: msg.isHandRaised } : p
          ));
        };

        client.onScreenShareStarted = (userId, producerId) => {
          const targetId = resolveUserId(userId);
          setParticipants((prev) => prev.map(p =>
            (p.id === targetId || p.userId === userId) ? { ...p, isScreenSharing: true } : p
          ));
          if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
            toast.info(`${participants.find(p => p.id === targetId || p.userId === userId)?.name || 'A participant'} started screen sharing`);
          }
        };

        client.onScreenShareStopped = (userId, producerId) => {
          const targetId = resolveUserId(userId);
          setParticipants((prev) => prev.map(p =>
            (p.id === targetId || p.userId === userId) ? { ...p, isScreenSharing: false, screenTrack: null } : p
          ));
          if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
            toast.info(`Screen sharing ended`);
          }
        };

        client.onConsumerClosed = (producerId, appData) => {
          if (appData?.source === 'screen') {
            setParticipants((prev) => prev.map(p => {
              if (p.screenProducerId === producerId) {
                return { ...p, isScreenSharing: false, screenTrack: undefined, screenProducerId: undefined, screenConsumerId: undefined, screenTrackId: undefined, screenStats: { ...p.screenStats, consumerClosed: true } };
              }
              return p;
            }));
          } else {
            setParticipants((prev) => prev.map(p => {
              if (p.cameraProducerId === producerId) {
                return { ...p, videoTrack: undefined, cameraProducerId: undefined, cameraConsumerId: undefined, cameraTrackId: undefined, cameraStats: { ...p.cameraStats, consumerClosed: true } };
              }
              return p;
            }));
          }
        };

        client.onActiveSpeaker = (userIds, participantIds) => {
          setParticipants((prev) => prev.map(p => {
            if (p.userId === initialCurrentUser.userId) {
              return { ...p, isSpeaking: localIsSpeakingRef.current || userIds.includes(p.userId) || (participantIds && participantIds.includes(p.id)) || userIds.includes(webrtcClient.current?.userId || '') };
            }
            return { ...p, isSpeaking: (participantIds && participantIds.includes(p.id)) || userIds.includes(p.userId) };
          }));
        };

        client.onWaitingRoomRequest = (msg) => {
          if (notifiedWaitingUsersRef.current.has(msg.userId)) {
            return;
          }
          notifiedWaitingUsersRef.current.add(msg.userId);

          // Play Doorbell Sound (Ding-Dong)
          try {
            if (client?.userRole !== 'bot' && client?.userRole !== 'recorder' && !(window as any).disableAudioNotifications) {
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
              oscillator.stop(audioCtx.currentTime + 0.8);
            }
          } catch(e) {
            console.warn("Failed to play doorbell sound", e);
          }

          toast.custom((t) => (
            <div className="bg-[var(--mt-bg-elevated)] text-[var(--mt-text)] p-4 rounded-xl shadow-lg border border-[var(--mt-border)] w-full flex flex-col gap-3" style={{ pointerEvents: 'auto' }}>
              <div className="font-medium text-sm text-balance leading-tight">{msg.name} is waiting to join</div>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => { 
                    webrtcClient.current?.sendAdmitUser(msg.userId); 
                    notifiedWaitingUsersRef.current.delete(msg.userId);
                    toast.dismiss(t);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-md transition-colors border border-[var(--mt-border)]"
                  style={{ backgroundColor: "var(--mt-bg-control)", color: "var(--mt-text)" }}
                >
                  Admit
                </button>
                <button 
                  onClick={() => {
                    webrtcClient.current?.sendAdmitAll();
                    notifiedWaitingUsersRef.current.clear();
                    toast.dismiss(t);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-md transition-colors bg-brand-green hover:bg-brand-green/90 text-white"
                >
                  Admit All
                </button>
              </div>
            </div>
          ), { duration: 10000 });

          setWaitingUsers(prev => {
            if (prev.find(u => u.userId === msg.userId)) return prev;
            return [...prev, { userId: msg.userId, name: msg.name }];
          });
        };

        client.onWaitingRoomDenied = (msg) => {
          setWaitingUsers(prev => prev.filter(u => u.userId !== msg.userId));
          notifiedWaitingUsersRef.current.delete(msg.userId);
        };

        client.onWaitingRoomDeniedAll = () => {
          setWaitingUsers([]);
          notifiedWaitingUsersRef.current.clear();
        };

        client.onConnectionStateChange = (state) => {
          if (webrtcClient.current === client) {
            setWebrtcStatus(state);
            if (state === 'connected') {
              // Update local user's name and role based on server truth
              setParticipants(prev => prev.map(p => 
                p.id === (clientParticipantId || initialCurrentUser.id) ? { ...p, name: webrtcClient.current?.userName || 'Guest', role: (webrtcClient.current?.userRole || 'attendee') as any } : p
              ));
              if (webrtcClient.current?.roomName || webrtcClient.current?.maxParticipants) {
                setMeetingInfo(prev => ({ 
                  ...prev, 
                  ...(webrtcClient.current?.roomName && { roomName: webrtcClient.current.roomName }),
                  ...(webrtcClient.current?.maxParticipants && { maxParticipants: webrtcClient.current.maxParticipants }),
                }));
              }
            } else if (state === 'waiting') {
              if (webrtcClient.current?.roomName || webrtcClient.current?.maxParticipants) {
                setMeetingInfo(prev => ({ 
                  ...prev, 
                  ...(webrtcClient.current?.roomName && { roomName: webrtcClient.current.roomName }),
                  ...(webrtcClient.current?.maxParticipants && { maxParticipants: webrtcClient.current.maxParticipants }),
                }));
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

        client.onForceMute = (reason) => {
          if (currentUser.role === 'host' || currentUser.role === 'co-host') return;
          setIsMuted(true);
          webrtcClient.current?.pauseMic();
          webrtcClient.current?.sendMuteState(true);
          if (reason === 'host_action') {
            toast.error("The host has muted your microphone.");
          } else {
            toast.error("You have been muted by the host.");
          }
        };

        client.onForceVideoOff = (reason) => {
          if (currentUser.role === 'host' || currentUser.role === 'co-host') return;
          setIsCameraOn(false);
          webrtcClient.current?.disableCamera();
          webrtcClient.current?.sendCameraState(false);
          if (reason === 'host_action') {
            toast.error("The host has turned off your camera.");
          }
        };

        client.onRoomSettingsUpdated = (newSettings, updatedBy) => {
          setRoomSettings(prev => {
            if (currentUser.role !== 'host' && currentUser.role !== 'co-host') {
              if (!prev.micLocked && newSettings.micLocked) {
                setIsMuted(true);
                setMicExempted(false);
                webrtcClient.current?.pauseMic();
                webrtcClient.current?.sendMuteState(true);
              }
              if (!prev.videoLocked && newSettings.videoLocked) {
                setIsCameraOn(false);
                webrtcClient.current?.disableCamera();
                webrtcClient.current?.sendCameraState(false);
              }
            }
            
            // Sync network detection config to WebRTC
            if (newSettings.networkDetectionEnabled !== undefined && webrtcClient.current) {
               webrtcClient.current.updateNetworkConfig({
                 networkDetectionEnabled: newSettings.networkDetectionEnabled,
                 poorNetworkRttMs: newSettings.poorNetworkRttMs,
                 poorNetworkLossPercent: newSettings.poorNetworkLossPercent,
                 poorNetworkJitterMs: newSettings.poorNetworkJitterMs,
                 networkWindowSize: newSettings.networkWindowSize,
                 networkMonitorIntervalMs: newSettings.networkMonitorIntervalMs,
               });
            }
            
            return { ...prev, ...newSettings };
          });
          if (updatedBy && updatedBy !== currentUser.name) {
            toast.info(`${updatedBy} updated the room settings.`);
          }
        };

        client.onAskToUnmute = (hostName) => {
          setMicExempted(true);
          toast.custom((t) => (
            <div className="bg-[var(--mt-bg-elevated)] text-[var(--mt-text)] p-4 rounded-xl shadow-lg border border-[var(--mt-border)] w-full flex flex-col gap-3">
              <div className="font-medium text-sm text-balance leading-tight">{hostName} would like you to unmute.</div>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => toast.dismiss(t)}
                  className="px-4 py-2 text-xs font-medium rounded-md transition-colors border border-[var(--mt-border)] text-[var(--mt-text)]"
                >
                  Stay Muted
                </button>
                <button 
                  onClick={() => {
                    toast.dismiss(t);
                    webrtcClient.current?.resumeMic().then(() => {
                      webrtcClient.current?.sendMuteState(false);
                      setIsMuted(false);
                    }).catch(console.error);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-md transition-colors bg-brand-green hover:bg-brand-green/90 text-white"
                >
                  Unmute Now
                </button>
              </div>
            </div>
          ), { duration: 15000 });
        };

        client.onECinemaUpdate = (link) => {
          setECinemaLink(link);
          if (link) {
            toast.success("eCinema broadcast has started!");
          }
        };

        client.onParticipantsList = (backendParticipants) => {
          setParticipants((prev) => {
            const nextParticipants: Participant[] = [];
            let duplicatesDetected = false;
            let staleRemoved = false;
            
            // Add local user
            const localUser = prev.find(p => p.userId === initialCurrentUser.userId);
            if (localUser) nextParticipants.push(localUser);

            const seenParticipantIds = new Set<string>();
            if (localUser) seenParticipantIds.add(localUser.id);

            for (const p of backendParticipants) {
              if (seenParticipantIds.has(p.participantId)) {
                duplicatesDetected = true;
                continue;
              }
              seenParticipantIds.add(p.participantId);

              const existing = prev.find(existing => existing.id === p.participantId);
              if (existing) {
                nextParticipants.push({ 
                  ...existing, 
                  userId: p.userId,
                  name: p.name, 
                  role: p.role as any, 
                  isMobile: p.isMobile, 
                  isCameraOn: p.isCameraOn ?? existing.isCameraOn, 
                  audioOnlyMode: p.audioOnlyMode ?? existing.audioOnlyMode, 
                  videoSuspendedReason: p.videoSuspendedReason ?? existing.videoSuspendedReason,
                  audioConnectionStatus: (p as any).audioConnectionStatus ?? existing.audioConnectionStatus 
                });
              } else {
                nextParticipants.push({
                  id: p.participantId,
                  userId: p.userId,
                  name: p.name,
                  role: p.role as any,
                  isMuted: (p as any).isMuted ?? true,
                  isCameraOn: p.isCameraOn || false,
                  audioOnlyMode: p.audioOnlyMode,
                  videoSuspendedReason: p.videoSuspendedReason,
                  isScreenSharing: false,
                  isHandRaised: false,
                  isSpeaking: false,
                  networkQuality: 'good',
                  joinedAt: new Date().toISOString(),
                  isConnecting: false,
                  isMobile: p.isMobile,
                });
              }
            }

            if (prev.length > nextParticipants.length) {
              staleRemoved = true;
            }

            if (duplicatesDetected) client?.emitTelemetry('duplicate_participant_detected');
            if (staleRemoved) client?.emitTelemetry('stale_participant_removed');
            client?.emitTelemetry('participant_list_reconciled');


            return nextParticipants;
          });
        };

        client.onUserJoined = (user) => {
          if (hasLeftMeetingRef.current) return;
          if (user.userId === webrtcClient.current?.userId) return;
          const targetId = resolveUserId(user.userId);
          const uniqueId = user.participantId || user.userId;
          setWaitingUsers(prev => prev.filter(u => u.userId !== user.userId));
          setParticipants((prev) => {
            if (prev.some(p => p.id === uniqueId)) {
              return prev.map(p => p.id === uniqueId ? { ...p, name: user.name, role: user.role as any, isMobile: user.isMobile, isCameraOn: user.isCameraOn ?? p.isCameraOn, audioOnlyMode: user.audioOnlyMode ?? p.audioOnlyMode, videoSuspendedReason: user.videoSuspendedReason ?? p.videoSuspendedReason } : p);
            }
            return [...prev, {
              id: uniqueId,
              userId: user.userId,
              name: user.name,
              role: user.role as any,
              isMuted: (user as any).isMuted ?? true,
              isCameraOn: user.isCameraOn || false,
              audioOnlyMode: user.audioOnlyMode,
              videoSuspendedReason: user.videoSuspendedReason,
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
            if (hasLeftMeetingRef.current) return;
            setParticipants(curr => curr.map(p => p.id === uniqueId ? { ...p, isConnecting: false } : p));
          }, 4000);

          if (user.role !== 'bot') {
            if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showJoinLeaveToasts) {
              joinLeaveBatchCount++;
              if (joinLeaveBatchTimeout) clearTimeout(joinLeaveBatchTimeout);
              joinLeaveBatchTimeout = setTimeout(() => {
                if (joinLeaveBatchCount > 1) {
                  toast.info(`${joinLeaveBatchCount} participants joined`);
                } else {
                  toast.info(`${user.name} joined the meeting`);
                }
                joinLeaveBatchCount = 0;
              }, 1000);
            }
            if (prefsRef.current.notifications.playJoinLeaveSound) {
              playNotificationSound(600, 0.1, 0.05); // softer beep
            }
          }
        };

        client.onRoleChanged = (userId, newRole) => {
          const targetId = resolveUserId(userId);
          setParticipants((prev) => prev.map(p => 
            (p.id === targetId || p.userId === userId) ? { ...p, role: newRole as any } : p
          ));
          if (targetId === (clientParticipantId || initialCurrentUser.id)) {
            toast.info(`Your role has been updated to ${newRole}`);
          }
        };

        client.onUserLeft = (userId) => {
          if (hasLeftMeetingRef.current) return;
          setParticipants((prev) => {
            const user = prev.find(p => p.id === userId);
            if (user && user.id !== webrtcClient.current?.userId && user.id !== currentUser.id) {
               if (user.role !== 'bot') {
                 if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showJoinLeaveToasts) {
                   leaveBatchCount++;
                   if (leaveBatchTimeout) clearTimeout(leaveBatchTimeout);
                   leaveBatchTimeout = setTimeout(() => {
                     if (leaveBatchCount > 1) {
                       toast.info(`${leaveBatchCount} participants left`);
                     } else {
                       toast.info(`${user.name} left the meeting`);
                     }
                     leaveBatchCount = 0;
                   }, 1000);
                 }
                 if (prefsRef.current.notifications.playJoinLeaveSound) {
                   playNotificationSound(400, 0.15, 0.05); // slightly lower pitched beep for leaving
                 }
               }
            }
            return prev.filter(p => p.id !== userId);
          });
        };

        client.onNewConsumer = (consumer, participantId, userName) => {
          const source = (consumer.appData as any)?.source || (consumer.kind === 'audio' ? 'audio' : 'camera');
          
          setParticipants((prev) => {
            const exists = prev.find((p) => p.id === participantId);
            if (exists) {
              return prev.map((p) => {
                if (p.id === participantId) {
                  if (consumer.kind === 'audio') {
                    if (source === 'screen-audio') {
                      return { 
                        ...p, 
                        screenAudioTrack: consumer.track as MediaStreamTrack,
                        screenAudioProducerId: consumer.producerId,
                        screenAudioConsumerId: consumer.id,
                        screenAudioTrackId: consumer.track.id
                      };
                    } else {
                      return { ...p, audioTrack: consumer.track as MediaStreamTrack };
                    }
                  }
                  if (consumer.kind === 'video') {
                    if (source === 'screen') {
                      return { 
                        ...p, 
                        screenTrack: consumer.track as MediaStreamTrack, 
                        screenProducerId: consumer.producerId,
                        screenConsumerId: consumer.id,
                        screenTrackId: consumer.track.id,
                        isScreenSharing: true,
                        screenStats: {
                          ...p.screenStats,
                          consumerExists: true,
                          consumerCodec: consumer.rtpParameters?.codecs?.[0]?.mimeType,
                          consumerPayloadType: consumer.rtpParameters?.codecs?.[0]?.payloadType,
                          consumerCodecParams: consumer.rtpParameters?.codecs?.[0]?.parameters
                        }
                      };
                    } else {
                      // Do not override isCameraOn to true if audioOnlyMode is active or explicit camera-off
                      const canonicalCameraOff = p.audioOnlyMode || p.videoSuspendedReason === 'network' || p.isCameraOn === false;
                      const newCameraOn = canonicalCameraOff ? false : true;
                      return { 
                        ...p, 
                        videoTrack: consumer.track as MediaStreamTrack, 
                        cameraProducerId: consumer.producerId,
                        cameraConsumerId: consumer.id,
                        cameraTrackId: consumer.track.id,
                        isCameraOn: newCameraOn,
                        cameraStats: {
                          ...p.cameraStats,
                          consumerExists: true,
                          consumerCodec: consumer.rtpParameters?.codecs?.[0]?.mimeType,
                          consumerPayloadType: consumer.rtpParameters?.codecs?.[0]?.payloadType,
                          consumerCodecParams: consumer.rtpParameters?.codecs?.[0]?.parameters
                        }
                      };
                    }
                  }
                }
                return p;
              });
            } else {
              client?.emitTelemetry('participant_missing_but_media_active');
              const newParticipant: Participant = {
                id: participantId,
                userId: participantId, // Fallback, though ideally we'd have the real userId
                name: userName || `Participant ${participantId.substring(5, 9)}`,
                role: "attendee",
                isMuted: consumer.kind !== "audio",
                isCameraOn: consumer.kind === "video" && source !== 'screen', // Defaults to true if video consumer is created first
                isScreenSharing: consumer.kind === "video" && source === 'screen',
                audioTrack: consumer.kind === "audio" && source !== 'screen-audio' ? (consumer.track as MediaStreamTrack) : undefined,
                screenAudioTrack: consumer.kind === "audio" && source === 'screen-audio' ? (consumer.track as MediaStreamTrack) : undefined,
                videoTrack: consumer.kind === "video" && source !== 'screen' ? (consumer.track as MediaStreamTrack) : undefined,
                screenTrack: consumer.kind === "video" && source === 'screen' ? (consumer.track as MediaStreamTrack) : undefined,
                cameraProducerId: consumer.kind === "video" && source !== 'screen' ? consumer.producerId : undefined,
                cameraConsumerId: consumer.kind === "video" && source !== 'screen' ? consumer.id : undefined,
                cameraTrackId: consumer.kind === "video" && source !== 'screen' ? consumer.track.id : undefined,
                screenProducerId: consumer.kind === "video" && source === 'screen' ? consumer.producerId : undefined,
                screenConsumerId: consumer.kind === "video" && source === 'screen' ? consumer.id : undefined,
                screenTrackId: consumer.kind === "video" && source === 'screen' ? consumer.track.id : undefined,
                screenAudioProducerId: consumer.kind === "audio" && source === 'screen-audio' ? consumer.producerId : undefined,
                screenAudioConsumerId: consumer.kind === "audio" && source === 'screen-audio' ? consumer.id : undefined,
                screenAudioTrackId: consumer.kind === "audio" && source === 'screen-audio' ? consumer.track.id : undefined,
                isHandRaised: false,
                isSpeaking: false,
                joinedAt: new Date().toISOString(),
                isMobile: false,
                cameraStats: consumer.kind === "video" && source !== 'screen' ? {
                  consumerExists: true,
                  consumerCodec: consumer.rtpParameters?.codecs?.[0]?.mimeType,
                  consumerPayloadType: consumer.rtpParameters?.codecs?.[0]?.payloadType,
                  consumerCodecParams: consumer.rtpParameters?.codecs?.[0]?.parameters
                } : undefined,
                screenStats: consumer.kind === "video" && source === 'screen' ? {
                  consumerExists: true,
                  consumerCodec: consumer.rtpParameters?.codecs?.[0]?.mimeType,
                  consumerPayloadType: consumer.rtpParameters?.codecs?.[0]?.payloadType,
                  consumerCodecParams: consumer.rtpParameters?.codecs?.[0]?.parameters
                } : undefined
              };
              
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
      client?.disconnect();
    };
  }, [roomSlug, initialCurrentUser.name, clientParticipantId]);

  // ── Initialize Local Media upon WebRTC connect ────────
  useEffect(() => {
    if (webrtcStatus === "connected" && webrtcClient.current && !hasInitializedMediaRef.current) {
      hasInitializedMediaRef.current = true;
      const client = webrtcClient.current;

      const initMedia = async () => {
        try {
          if (initialCurrentUser.role === 'bot' || isRecorderMode) {
            return;
          }

          let videoTrack: MediaStreamTrack | null = null;
          let audioTrack: MediaStreamTrack | null = null;

          client.emitTelemetry('join_started');

          // Audio pipeline (synchronous within the init flow, decoupled from video)
          try {
            audioTrack = await client.enableMic();
            localAudioTrackRef.current = audioTrack;
            if (isMuted) {
              client.pauseMic();
            }
            client.sendMuteState(isMuted);
          } catch (e) {
            console.error("Failed to enable mic:", e);
          }

          setParticipants((prev) =>
            prev.map((p) => {
              if (p.userId === initialCurrentUser.userId) {
                return { ...p, audioTrack: audioTrack || undefined, isMuted };
              }
              return p;
            })
          );

          // Video pipeline (asynchronous, doesn't block audio readiness)
          if (isCameraOn) {
            client.enableCamera().then(async (vTrack) => {
              videoTrack = vTrack;
              if (vbMode !== 'none') {
                const vbTrack = await client.setVirtualBackground(vbMode, vbImageUrl);
                if (vbTrack) {
                  videoTrack = vbTrack;
                }
              }
              localCameraTrackRef.current = videoTrack;
              client.sendCameraState(true);
              
              setParticipants((prev) =>
                prev.map((p) => {
                  if (p.userId === initialCurrentUser.userId) {
                    return { ...p, videoTrack: videoTrack || undefined, isCameraOn };
                  }
                  return p;
                })
              );
              client.emitTelemetry('join_media_ready');
            }).catch(e => {
              console.error("Failed to enable local camera non-blockingly:", e);
            });
          } else {
            client.emitTelemetry('join_media_ready');
          }
        } catch (e) {
          console.error("Failed to enable local media", e);
        }
      };

      initMedia();
    }
  }, [webrtcStatus, initialCurrentUser.id]);

  // ── Device Management ────────────────────────────────
  const fetchDevices = async () => {
    try {
      // Removed `tempStream` hardware request. 
      // 1. Permissions are already requested on the Join screen.
      // 2. Requesting and immediately stopping tracks on iOS Safari locks the hardware,
      //    causing `enableCamera` (which fires concurrently) to permanently fail.
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      const audioOutputs = allDevices.filter((d) => d.kind === "audiooutput");

      setDevices({
        audioInputs,
        videoInputs,
        audioOutputs,
      });

      // Initialize selectedDevices from sessionStorage or defaults
      setSelectedDevices(prev => {
        const saved = typeof window !== 'undefined' ? sessionStorage.getItem("conn3ct_devices") : null;
        if (saved && !prev.audioInput && !prev.videoInput) {
          try {
            return JSON.parse(saved);
          } catch (e) {}
        }
        return {
          audioInput: prev.audioInput || (audioInputs[0]?.deviceId || ""),
          videoInput: prev.videoInput || (videoInputs[0]?.deviceId || ""),
          audioOutput: prev.audioOutput || (audioOutputs[0]?.deviceId || ""),
        };
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

  useEffect(() => {
    if (webrtcClient.current) {
      if (selectedDevices.audioInput) webrtcClient.current.setAudioInputDevice(selectedDevices.audioInput);
      if (selectedDevices.videoInput) webrtcClient.current.setVideoInputDevice(selectedDevices.videoInput);
    }
  }, [selectedDevices.audioInput, selectedDevices.videoInput, webrtcStatus]);

  const switchDevice = useCallback(async (kind: 'audioInput' | 'videoInput' | 'audioOutput', deviceId: string) => {
    if (kind === 'videoInput' && cameraOperationInProgress.current) {
      console.log('camera_switch_ignored_operation_in_progress');
      return;
    }

    if (kind === 'videoInput') {
      cameraOperationInProgress.current = true;
      console.log('camera_switch_started');
    }

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
            p.userId === initialCurrentUser.userId ? { ...p, videoTrack: newTrack } : p
          ));
        }
      }
      if (kind === 'videoInput') console.log('camera_switch_completed');
    } catch (e) {
      if (kind === 'videoInput') console.log('camera_switch_failed_preserved_old_track');
      console.error(`Failed to switch ${type} device`, e);
      toast.error(`Could not switch ${type} device`);
    } finally {
      if (kind === 'videoInput') cameraOperationInProgress.current = false;
    }
  }, [initialCurrentUser.id]);

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

  // ── Mic Monitoring (Muted Talking & System Mute) ────────────────────────────
  const [audioTrackVersion, setAudioTrackVersion] = useState(0);

  useEffect(() => {
    if (webrtcClient.current?.userRole === 'bot') return;
    const trackToMonitor = webrtcClient.current?.rawAudioTrack || localAudioTrackRef.current;
    if (!trackToMonitor || trackToMonitor.readyState === 'ended') {
      webrtcClient.current?.emitTelemetry('local_vad_track_ended_detected');
      return;
    }

    webrtcClient.current?.emitTelemetry('local_vad_bind_started');

    let lastAlertTime = 0;
    let silentFrames = 0;
    let hasWarnedSystemMute = false;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(new MediaStream([trackToMonitor]));
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

      if (isMuted) {
        if (localIsSpeakingRef.current) {
          localIsSpeakingRef.current = false;
          setParticipants((prev) => prev.map(p => p.id === currentUser.id ? { ...p, isSpeaking: false } : p));
        }

        if (average > 15 && Date.now() - lastAlertTime > 5000) {
          toast.warning("Your mic is muted. Unmute to speak", { duration: 3000 });
          try {
            const beep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
            beep.volume = 0.2;
            beep.play().catch(() => { });
          } catch (e) { }
          lastAlertTime = Date.now();
        }
      } else {
        const currentlySpeaking = average > 5;
        if (currentlySpeaking !== localIsSpeakingRef.current) {
          localIsSpeakingRef.current = currentlySpeaking;
          setParticipants((prev) => prev.map(p => p.id === currentUser.id ? { ...p, isSpeaking: currentlySpeaking } : p));
        }

        if (average === 0) {
          silentFrames++;
          // Approx 60 frames per second. 60 * 15 = 900 frames for 15 seconds of absolute silence
          if (silentFrames > 900 && !hasWarnedSystemMute) {
            toast.error("We aren't receiving any audio. Your system mic might be muted or blocked.", { duration: 6000 });
            hasWarnedSystemMute = true;
          }
        } else {
          silentFrames = 0;
          // Reset warning if sound is detected again
          hasWarnedSystemMute = false;
        }
      }

      animationFrameId = requestAnimationFrame(checkVolume);
    };
    checkVolume();
    webrtcClient.current?.emitTelemetry('local_vad_bound_to_track');

    const handleHardwareMute = () => {
      if (!isMuted) {
        toast.error("Your microphone is muted at the system/hardware level.");
      }
    };
    trackToMonitor.addEventListener("mute", handleHardwareMute);

    return () => {
      webrtcClient.current?.emitTelemetry('local_vad_old_track_cleanup');
      cancelAnimationFrame(animationFrameId);
      audioContext.close().catch(() => { });
      trackToMonitor.removeEventListener("mute", handleHardwareMute);
    };
  }, [isMuted, audioTrackVersion]);

  // ── Actions ──────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (isRecorderMode) return;
    const newState = !isMuted;
    if (newState) webrtcClient.current?.pauseMic();
    else webrtcClient.current?.resumeMic();
    webrtcClient.current?.sendMuteState(newState);
    setIsMuted(newState);
    setParticipants(prev => prev.map(p => p.userId === initialCurrentUser.userId ? { ...p, isMuted: newState } : p));
  }, [isMuted, initialCurrentUser.id]);

  const cameraOperationInProgress = useRef(false);

  const toggleCamera = useCallback(() => {
    if (isRecorderMode) return;
    if (cameraOperationInProgress.current) {
      console.log('camera_switch_ignored_operation_in_progress');
      return;
    }
    const newState = !isCameraOn;
    if (!newState) {
      cameraOperationInProgress.current = true;
      try {
        console.log('camera_switch_started');
        webrtcClient.current?.disableCamera();
        localCameraTrackRef.current = null;
        webrtcClient.current?.sendCameraState(newState);
        setIsCameraOn(newState);
        setParticipants(prev => prev.map(p => p.userId === initialCurrentUser.userId ? { ...p, isCameraOn: newState, videoTrack: undefined } : p));
        console.log('camera_switch_completed');
      } finally {
        cameraOperationInProgress.current = false;
      }
    } else {
      cameraOperationInProgress.current = true;
      console.log('camera_switch_started');
      // Force fresh camera start on any toggle ON. No resumeCamera() usage for this flow.
      webrtcClient.current?.enableCamera().then(async track => {
        if (track.readyState !== 'live') {
          throw new Error("Track is not live");
        }
        let finalTrack = track;
        // Apply VB
        if (vbMode !== 'none' && webrtcClient.current) {
          const vbTrack = await webrtcClient.current.setVirtualBackground(vbMode, vbImageUrl);
          if (vbTrack) finalTrack = vbTrack;
        }
        localCameraTrackRef.current = finalTrack;
        webrtcClient.current?.sendCameraState(newState);
        setIsCameraOn(newState);
        setParticipants(prev => prev.map(p => p.userId === initialCurrentUser.userId ? { ...p, isCameraOn: newState, videoTrack: finalTrack, audioOnlyMode: false, videoSuspendedReason: undefined } : p));
      }).catch(err => {
        console.log('camera_switch_failed_preserved_old_track');
        console.error("Failed to enable camera:", err);
        toast.error("Camera could not start. Please retry.");
        // Ensure UI stays off
        setIsCameraOn(false);
      }).finally(() => {
        cameraOperationInProgress.current = false;
      });
    }
  }, [isCameraOn, initialCurrentUser.id, vbMode, vbImageUrl]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        await webrtcClient.current?.disableScreenShare();
        setIsScreenSharing(false);
        setParticipants(prev => prev.map(p =>
          p.userId === initialCurrentUser.userId ? { ...p, isScreenSharing: false, screenTrack: null } : p
        ));
      } else {
        const screenTrack = await webrtcClient.current?.enableScreenShare();
        if (screenTrack) {
          setIsScreenSharing(true);
          setParticipants(prev => prev.map(p =>
            p.userId === initialCurrentUser.userId ? { ...p, isScreenSharing: true, screenTrack } : p
          ));
          screenTrack.onended = async () => {
            await webrtcClient.current?.disableScreenShare();
            setIsScreenSharing(false);
            setParticipants(prev => prev.map(p =>
              p.userId === initialCurrentUser.userId ? { ...p, isScreenSharing: false, screenTrack: null } : p
            ));
          };
        }
      }
    } catch (e) {
      console.error("Screen share error:", e);
    }
  }, [isScreenSharing, initialCurrentUser.id]);
  const toggleRecording = useCallback(async () => {
    if (recordingStatus === 'recording' || recordingStatus === 'starting') {
      webrtcClient.current?.sendStopRecording();
      setRecordingStatus('processing');
      toast.success("Recording stopped. It is being processed and will be saved to cloud.", { id: 'recording_status' });
    } else {
      webrtcClient.current?.sendStartRecording();
      setRecordingStatus('starting');
      toast.success("Starting recording...", { id: 'recording_status' });
    }
  }, [recordingStatus]);
  const toggleHandRaise = useCallback(() => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    webrtcClient.current?.sendHandRaise(newState);
    setParticipants(prev => prev.map(p => p.userId === initialCurrentUser.userId ? { ...p, isHandRaised: newState } : p));
  }, [isHandRaised, initialCurrentUser.id]);

  const sendMessage = useCallback(
    (content: string, targetUserId?: string, fileUrl?: string) => {
      const clientEventId = crypto.randomUUID();
      webrtcClient.current?.sendChatMessage(content, targetUserId, fileUrl, clientEventId);
      const msg: ChatMessage = {
        id: clientEventId,
        clientEventId,
        lifecycleState: 'sent',
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: (webrtcClient.current?.userRole as ParticipantRole) || currentUser.role,
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

  const toggleCaptions = useCallback(() => {
    setIsCaptionsEnabled(prev => {
      const newState = !prev;
      if (newState) {
        toast.success("Live Captions enabled");
      } else {
        setCaptions([]);
        toast.info("Live Captions disabled");
      }
      return newState;
    });
  }, []);

  const toggleDonation = useCallback(() => {
    if (webrtcClient.current?.userRole === 'host' || webrtcClient.current?.userRole === 'co-host') {
      const newState = !isDonationActive;
      setIsDonationActive(newState);
      webrtcClient.current?.sendDonationStatus(newState);
      toast.success(newState ? "Donations enabled for participants." : "Donations disabled.");
    } else {
      toast.error("Only the host can enable donations.");
    }
  }, [isDonationActive]);

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
      }, REACTION_DURATION);
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
            o.id === optionId ? { ...o, votes: o.votes + 1, votedBy: [...(o.votedBy || []), { userId: currentUser.id, name: currentUser.name }] } : o
          ),
        };
      })
    );
  }, []);

  const endPoll = useCallback((pollId: string) => {
    webrtcClient.current?.endPoll(pollId);
    setPolls((prev) =>
      prev.map((p) => (p.id === pollId ? { ...p, isActive: false } : p))
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
      if (webrtcClient.current?.userRole === 'host' || webrtcClient.current?.userRole === 'co-host') {
        if (newPanel !== 'participants' && newPanel !== 'settings') {
          webrtcClient.current?.sendSyncPanel(newPanel);
        } else {
          // If the host opened a private panel, tell the bot to close its panel so it doesn't get stuck
          webrtcClient.current?.sendSyncPanel(null);
        }
      }
    },
    [activePanel]
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

  const changeUserRole = useCallback((userId: string, newRole: string) => {
    webrtcClient.current?.sendChangeRole(userId, newRole);
  }, []);

  const forceMuteUser = useCallback((userId?: string, target?: 'all' | 'all_except_presenters' | 'all_except_hosts') => {
    webrtcClient.current?.sendForceMute(userId, target);
  }, []);

  const askToUnmute = useCallback((userId: string) => {
    webrtcClient.current?.askToUnmute(userId);
  }, []);

  const clearChat = useCallback(() => {
    webrtcClient.current?.sendClearChat();
  }, []);

  const forceVideoOffUser = useCallback((userId?: string) => {
    webrtcClient.current?.sendForceVideoOff(userId);
  }, []);

  const updateRoomSettings = useCallback((settings: Partial<RoomSettings>) => {
    webrtcClient.current?.sendUpdateRoomSettings(settings);
    // Optimistic update
    setRoomSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const endMeetingForAll = useCallback(() => {
    hasLeftMeetingRef.current = true;
    webrtcClient.current?.sendEndMeeting();
    webrtcClient.current?.disconnect();
  }, []);

  const leaveMeeting = useCallback(() => {
    hasLeftMeetingRef.current = true;
    webrtcClient.current?.sendLeaveMeeting();
    webrtcClient.current?.disconnect();
  }, []);

  const broadcastECinema = useCallback((link: string | null) => {
    setECinemaLink(link); // Optimistic local update
    webrtcClient.current?.sendECinemaUpdate(link);
  }, []);

  const sendECinemaAction = useCallback((action: 'play' | 'pause', time?: number) => {
    // We don't optimistically update here because the YouTube player handles its own state for the host
    webrtcClient.current?.sendECinemaAction(action, time);
  }, []);

  const pauseRemoteVideo = (trackId: string) => {
    webrtcClient.current?.pauseRemoteVideoByTrack(trackId);
  };

  const resumeRemoteVideo = (trackId: string) => {
    webrtcClient.current?.resumeRemoteVideoByTrack(trackId);
  };

  return (
    <MeetingContext.Provider
      value={{
        participants,
        waitingUsers,
        currentUser,
        chatMessages,
        polls,
        audioPlaybackError,
        setAudioPlaybackError,
        resumeAudioPlayback,
        sharedNoteContent,
        meetingInfo,
        reactions,
        activePanel,
        hasUnreadChat,
        markChatMessageRendered,
        layoutMode,
        gridOverflowMode,
        micExempted,
        askToUnmute,
        clearChat,
        isMuted,
        isCameraOn,
        aiMessages,
        setAiMessages,
        isScreenSharing,
        isRecording,
        recordingStatus,
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
        totalDonations,
        captionSize,
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
        setCaptionSize,
        setActivePanel: handleSetActivePanel,
        setHasUnreadChat,
        setLayoutMode,
        setGridOverflowMode,
        sendMessage,
        sendReaction,
        votePoll,
        endPoll,
        createPoll,
        updateSharedNote,
        setShowLeaveDialog,
        setShowReactionPicker,
        setShowDonationModal,
        setIsMobilePanelOpen,
        admitUser,
        denyUser,
        admitAllUsers: () => webrtcClient.current?.admitAllUsers(),
        denyAllUsers: () => webrtcClient.current?.denyAllUsers(),
        kickUser,
        changeUserRole,
        forceMuteUser,
        forceVideoOffUser,
        updateRoomSettings,
        roomSettings,
        qaMessages,
        askQuestion: (question: string, isAnonymous: boolean) => webrtcClient.current?.askQuestion(question, isAnonymous),
        upvoteQuestion: (questionId: string) => webrtcClient.current?.upvoteQuestion(questionId),
        answerQuestion: (questionId: string, answerText: string) => webrtcClient.current?.answerQuestion(questionId, answerText),
        deleteQuestion: (questionId: string) => webrtcClient.current?.deleteQuestion(questionId),
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
        isAudioOnlyModeEnabled,
        setIsAudioOnlyModeEnabled: updateAudioOnlyMode,
        isAlwaysMuteOnJoin,
        setIsAlwaysMuteOnJoin: updateAlwaysMute,
        
        roomFeatureFlags,

        vbMode,
        vbImageUrl,
        handleVbSelect: async function handleVbSelectFn(mode: 'none' | 'blur' | 'image', imageUrl?: string) {
          setVbMode(mode);
          setVbImageUrl(imageUrl);
          try {
            localStorage.setItem("mtg_vb", JSON.stringify({ mode, image: imageUrl }));
          } catch (e) {
            console.error("Failed to save virtual background to localStorage", e);
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
               toast.error("Image too large to save permanently. It will apply for this session only.");
            }
          }
          if (isCameraOn && webrtcClient.current) {
            webrtcClient.current.onVbDegraded = (severity) => {
              if (severity === 'warning' && mode === 'image') {
                toast.warning("Virtual background is slowing this device. Degraded to basic blur.");
                handleVbSelectFn('blur');
              } else {
                toast.error("Virtual background may slow this device. We switched to normal video for better meeting quality.");
                setVbMode('none');
                setVbImageUrl(undefined);
                localStorage.setItem("mtg_vb", JSON.stringify({ mode: 'none' }));
                webrtcClient.current?.setVirtualBackground('none').then(track => {
                  if (track) {
                    localCameraTrackRef.current = track;
                    setParticipants(prev => prev.map(p => 
                      p.id === currentUser.id ? { ...p, videoTrack: track } : p
                    ));
                  }
                });
              }
            };
            const track = await webrtcClient.current.setVirtualBackground(mode, imageUrl);
            if (track) {
              localCameraTrackRef.current = track;
              setParticipants(prev => prev.map(p => 
                p.id === currentUser.id ? { ...p, videoTrack: track } : p
              ));
            }
          }
        },
        outputVolume,
        setOutputVolume,
        logoutUrl: initialLogoutUrl,
        pauseRemoteVideo,
        resumeRemoteVideo,
        micError,
        setMicError,
        webrtcClientRef: webrtcClient,
        isRecorderMode,
        playNotificationSound,
      }}
    >
      <GlobalAudioRenderer participants={participants} currentUserId={currentUser.id} outputVolume={outputVolume} setAudioPlaybackError={setAudioPlaybackError} />
      {children}
    </MeetingContext.Provider>
  );
}

function GlobalAudioRenderer({ participants, currentUserId, outputVolume, setAudioPlaybackError }: { participants: Participant[]; currentUserId: string; outputVolume: number; setAudioPlaybackError: (val: boolean) => void }) {
  const { selectedDevices, meetingInfo } = useMeeting();
  
  const audioParticipants = useMemo(() => {
    if (meetingInfo?.roomType === 'webinar') {
      return participants.filter(p => p.role === 'host' || p.role === 'co-host' || p.role === 'presenter');
    }
    return participants;
  }, [participants, meetingInfo?.roomType]);

  return (
    <>
      {audioParticipants.map((p) => (
        <React.Fragment key={p.id}>
          <AudioRenderer track={p.audioTrack} isLocal={p.id === currentUserId} audioOutput={selectedDevices.audioOutput} outputVolume={outputVolume} setAudioPlaybackError={setAudioPlaybackError} />
          {p.screenAudioTrack && (
            <AudioRenderer track={p.screenAudioTrack} isLocal={p.id === currentUserId} audioOutput={selectedDevices.audioOutput} outputVolume={outputVolume} setAudioPlaybackError={setAudioPlaybackError} />
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function AudioRenderer({ track, isLocal, audioOutput, outputVolume, setAudioPlaybackError }: { track?: MediaStreamTrack | null; isLocal: boolean; audioOutput: string; outputVolume: number; setAudioPlaybackError: (val: boolean) => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const applyAudioSink = async (el: HTMLAudioElement, sinkId: string) => {
    if (sinkId && typeof (el as any).setSinkId === "function") {
      try {
        await (el as any).setSinkId(sinkId);
      } catch (e) {
        console.warn("Failed to set audio output device, falling back to default:", e);
        // Fallover to the default system audio device ("")
        try {
          await (el as any).setSinkId("");
        } catch (fallbackErr) {
          console.error("Fallback to default audio device also failed", fallbackErr);
        }
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = outputVolume / 100;
    }
  }, [outputVolume]);

  useEffect(() => {
    if (audioRef.current && track && !isLocal) {
      if (audioRef.current.srcObject) {
        const stream = audioRef.current.srcObject as MediaStream;
        if (stream.getAudioTracks()[0] === track) {
          applyAudioSink(audioRef.current, audioOutput);
          audioRef.current.volume = outputVolume / 100;
          return;
        }
        // Update the existing MediaStream instead of replacing srcObject 
        // to bypass iOS Safari autoplay restrictions on reconnect
        stream.getAudioTracks().forEach(t => stream.removeTrack(t));
        stream.addTrack(track);
      } else {
        audioRef.current.srcObject = new MediaStream([track]);
      }
      
      audioRef.current.volume = outputVolume / 100;
      applyAudioSink(audioRef.current, audioOutput);
      
      const attemptPlay = () => {
        if (!audioRef.current || !track || isLocal) return;
        audioRef.current.play().catch((e) => {
          if (e.name === 'NotAllowedError') {
            console.warn("Autoplay blocked for global audio:", e);
            setAudioPlaybackError(true);
          } else if (e.name !== 'AbortError') {
            console.warn("Global audio play failed:", e);
          }
        });
      };

      attemptPlay();

      // Ensure audio stays playing if the browser incorrectly pauses it
      const onPause = () => {
        if (audioRef.current && track && !isLocal && audioRef.current.srcObject) {
          console.log("Audio paused unexpectedly, attempting to resume...");
          attemptPlay();
        }
      };

      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && audioRef.current && track && !isLocal) {
          console.log("App returned to foreground, resuming audio...");
          attemptPlay();
        }
      };

      audioRef.current.addEventListener('pause', onPause);
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('pageshow', handleVisibility);

      return () => {
        if (audioRef.current) audioRef.current.removeEventListener('pause', onPause);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pageshow', handleVisibility);
      };

    } else if (audioRef.current && (!track || isLocal)) {
      audioRef.current.srcObject = null;
    }
  }, [track, isLocal, audioOutput, outputVolume]);

  return <audio ref={audioRef} autoPlay playsInline muted={isLocal || outputVolume === 0} style={{ display: 'none' }} />;
}
