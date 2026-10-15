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
import { useMeetingTheme } from "./meeting-theme-context";
import { useMeetingDevicePreferences } from "./meeting-device-preferences";

let lastChatToastTime = 0;
let lastChatSoundTime = 0;
let joinLeaveBatchCount = 0;
let joinLeaveBatchTimeout: ReturnType<typeof setTimeout> | null = null;
let leaveBatchCount = 0;
let leaveBatchTimeout: ReturnType<typeof setTimeout> | null = null;
export const REACTION_DURATION = 10000;

function getParticipantIdentityKey(userId?: string): string {
  if (!userId) return 'guest:unknown';
  if (userId.startsWith('guest-') || userId.startsWith('guest_') || userId.startsWith('anon-') || userId.startsWith('anon_')) {
    const cleanId = userId.replace(/^(guest[-_]|anon[-_])/, '');
    return `guest:${cleanId}`;
  }
  return `user:${userId}`;
}

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
  screenSharePolicyMode: 'EVERYONE' | 'HOSTS_ONLY' | 'SELECTED';
  participantScreenSharePermissions: Record<string, 'DEFAULT' | 'ALLOW' | 'BLOCK'>;
  effectiveScreenSharePermission: {
    allowed: boolean;
    reason: 'ALLOWED' | 'PARTICIPANT_BLOCKED' | 'HOST_DISABLED_SCREEN_SHARING' | 'NOT_SELECTED_FOR_SCREEN_SHARING' | 'ROLE_NOT_AUTHORIZED';
  };
  isRecording: boolean;
  recordingStatus: 'idle' | 'starting' | 'recording' | 'stopping' | 'processing' | 'ready' | 'failed';
  isHandRaised: boolean;
  showLeaveDialog: boolean;
  showReactionPicker: boolean;
  showDonationModal: boolean;
  meetingDuration: number; // seconds (overall meeting session)
  userDuration: number; // seconds (individual user's time in meeting)
  meetingStartedAt: number | null; // ms timestamp
  clientParticipantId: string | null;
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
  setScreenSharePolicy: (mode: 'EVERYONE' | 'HOSTS_ONLY' | 'SELECTED', stopExistingShares: boolean) => void;
  setParticipantScreenSharePermission: (targetParticipantId: string, permission: 'DEFAULT' | 'ALLOW' | 'BLOCK') => void;
  stopParticipantScreenShare: (targetParticipantId: string) => void;
  stopAllParticipantScreenShares: () => void;
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
  retryConnection: () => Promise<void>;
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
  isWidescreenEnabled: boolean;
  setIsWidescreenEnabled: (enabled: boolean) => void;
  isMirrorVideoEnabled: boolean;
  setIsMirrorVideoEnabled: (enabled: boolean) => void;
  isOriginalRatioEnabled: boolean;
  setIsOriginalRatioEnabled: (enabled: boolean) => void;
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
  camError: { name: string; message: string } | null;
  setCamError: (error: { name: string; message: string } | null) => void;
  audioPlaybackError: boolean;
  setAudioPlaybackError: (error: boolean) => void;
  resumeAudioPlayback: () => void;

  // QA Diagnostics
  webrtcClientRef?: React.MutableRefObject<WebRTCClient | null>;
  isRecorderMode: boolean;
  playNotificationSound: (frequency: number, duration?: number, vol?: number) => void;
  pingParticipant: (targetUserId: string) => void;
}

const MeetingContext = createContext<MeetingContextValue | null>(null);

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used within MeetingProvider");
  return ctx;
}

let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  return sharedAudioCtx;
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
  // Safe theme extraction at top level of MeetingProvider
  let activeTheme: 'midnight' | 'soft' | 'slate' | 'sage' = 'sage';
  try {
    const themeCtx = useMeetingTheme();
    if (themeCtx && themeCtx.theme) {
      activeTheme = themeCtx.theme;
    }
  } catch (e) {
    // Fallback if not wrapped (e.g. recorder mode)
  }

  // Extract user info from sessionStorage/localStorage (passed from Join screen or URL)
  let storedJoinInfo: any = null;
  let initialUrlParams: URLSearchParams | null = null;
  
  if (typeof window !== "undefined") {
    try {
      initialUrlParams = new URLSearchParams(window.location.search);
      let sessionToken = initialUrlParams.get("t");
      
      if (sessionToken) {
        sessionStorage.setItem("conn3ct_session_token", sessionToken);
        try {
          localStorage.setItem(`konn3ct:session:${roomSlug}`, sessionToken);
        } catch (e) {}
        // Clean the URL without triggering a page reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else {
        sessionToken = sessionStorage.getItem("conn3ct_session_token");
        if (!sessionToken) {
          try {
            sessionToken = localStorage.getItem(`konn3ct:session:${roomSlug}`);
            if (sessionToken) {
              sessionStorage.setItem("conn3ct_session_token", sessionToken);
            }
          } catch (e) {}
        }
      }
      
      if (sessionToken) {
        // Decode the JWT payload without verifying signature on client
        const base64Url = sessionToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        storedJoinInfo = JSON.parse(jsonPayload);

        // Keep last user info updated in localStorage for quick lobby form restoration
        if (storedJoinInfo?.name && storedJoinInfo?.email) {
          try {
            localStorage.setItem("konn3ct:last_user_info", JSON.stringify({
              name: storedJoinInfo.name,
              email: storedJoinInfo.email,
              role: storedJoinInfo.role
            }));
          } catch (e) {}
        }
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
  const [logoutUrl, setLogoutUrl] = useState<string | null>(storedJoinInfo?.logoutUrl || null);

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

  // Resume AudioContext on user interaction to unlock browser audio blocks
  useEffect(() => {
    const resumeAudio = () => {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
  }, []);

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
      const audioCtx = getSharedAudioContext();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
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

  // ── WebRTC & Media Instance Refs ─────────────────────
  const webrtcClient = useRef<WebRTCClient | null>(null);
  const localCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localScreenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localScreenTrackRef = useRef<MediaStreamTrack | null>(null);
  const localCaptureRegistryRef = useRef<Set<string>>(new Set());
  const notifiedWaitingUsersRef = useRef<Set<string>>(new Set());
  const localIsSpeakingRef = useRef<boolean>(false);
  const hasLeftMeetingRef = useRef<boolean>(false);
  const pingDedupeRef = useRef<Set<string>>(new Set());
  const lastPingSoundTimeRef = useRef<number>(0);

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
    networkQuality: 'good',
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
  const participantsRef = useRef<Participant[]>(participants);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    if (clientParticipantId) {
      setParticipants(prev => prev.map(p => p.id === 'pending' || p.id === 'ssr-placeholder' ? { ...p, id: clientParticipantId } : p));
    }
  }, [clientParticipantId]);

  const currentUser = useMemo(() => {
    return (
      participants.find(p =>
        p.id === clientParticipantId ||
        p.id === initialCurrentUser.id ||
        (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId) ||
        (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) ||
        (!!webrtcClient.current?.userId && p.userId === webrtcClient.current.userId)
      ) || initialCurrentUser
    );
  }, [participants, clientParticipantId, initialCurrentUser]);

  const isLocalIdentifier = useCallback((id?: string | null): boolean => {
    if (!id) return false;
    return (
      id === webrtcClient.current?.userId ||
      id === webrtcClient.current?.participantId ||
      id === clientParticipantId ||
      id === initialCurrentUser.id ||
      id === initialCurrentUser.userId ||
      id === currentUser.id ||
      id === currentUser.userId
    );
  }, [clientParticipantId, initialCurrentUser.id, initialCurrentUser.userId, currentUser.id, currentUser.userId]);

  const isLocalCapture = useCallback((track?: MediaStreamTrack | null): boolean => {
    if (!track) return false;
    if (localCaptureRegistryRef.current.has(track.id)) return true;
    if (localAudioTrackRef.current && localAudioTrackRef.current.id === track.id) return true;
    if (localScreenAudioTrackRef.current && localScreenAudioTrackRef.current.id === track.id) return true;
    if (localCameraTrackRef.current && localCameraTrackRef.current.id === track.id) return true;
    if (localScreenTrackRef.current && localScreenTrackRef.current.id === track.id) return true;
    if (webrtcClient.current && (webrtcClient.current as any).isLocalTrack?.(track)) return true;
    return false;
  }, []);

  const registerLocalTrack = useCallback((track?: MediaStreamTrack | null) => {
    if (track && track.id) {
      localCaptureRegistryRef.current.add(track.id);
    }
  }, []);

  const [waitingUsers, setWaitingUsers] = useState<Array<{ userId: string, name: string }>>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [qaMessages, setQaMessages] = useState<any[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [audioPlaybackError, setAudioPlaybackError] = useState(false);
  
  const resumeAudioPlayback = useCallback(() => {
    setAudioPlaybackError(false);
    const audioElements = document.querySelectorAll('audio[data-participant-audio="true"]');
    audioElements.forEach(audio => {
      const el = audio as HTMLAudioElement;
      if (el.srcObject) {
        el.play().catch(e => console.warn("Resume play failed:", e));
      }
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
    isWaitingRoomEnabled: storedJoinInfo?.isWaitingRoomEnabled !== undefined ? storedJoinInfo.isWaitingRoomEnabled : true,
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
  const [screenSharePolicyMode, setScreenSharePolicyMode] = useState<'EVERYONE' | 'HOSTS_ONLY' | 'SELECTED'>('EVERYONE');
  const [participantScreenSharePermissions, setParticipantScreenSharePermissions] = useState<Record<string, 'DEFAULT' | 'ALLOW' | 'BLOCK'>>({});
  
  const effectiveScreenSharePermission = useMemo<MeetingContextValue['effectiveScreenSharePermission']>(() => {
    const role = currentUser.role || webrtcClient.current?.userRole || 'attendee';
    const isHost = ['host', 'admin'].includes(role);
    const isCoHost = role === 'co-host';
    const rawIds = [
      clientParticipantId,
      initialCurrentUser.id,
      initialCurrentUser.userId,
      currentUser.id,
      currentUser.userId,
      webrtcClient.current?.participantId,
      webrtcClient.current?.userId
    ].filter(Boolean) as string[];

    const myIds: string[] = [];
    for (const id of rawIds) {
      if (!myIds.includes(id)) myIds.push(id);
      const identityKey = getParticipantIdentityKey(id);
      if (!myIds.includes(identityKey)) myIds.push(identityKey);
    }

    let explicit: 'DEFAULT' | 'ALLOW' | 'BLOCK' = 'DEFAULT';
    for (const id of myIds) {
      if (participantScreenSharePermissions[id] && participantScreenSharePermissions[id] !== 'DEFAULT') {
        explicit = participantScreenSharePermissions[id];
        break;
      }
    }

    if (isHost) return { allowed: true, reason: 'ALLOWED' };
    if (explicit === 'BLOCK') return { allowed: false, reason: 'PARTICIPANT_BLOCKED' };
    if (explicit === 'ALLOW') return { allowed: true, reason: 'ALLOWED' };
    if (isCoHost) return { allowed: true, reason: 'ALLOWED' }; // Configurable co-host policy mapped here as true by default

    switch (screenSharePolicyMode) {
      case 'EVERYONE':
        return { allowed: true, reason: 'ALLOWED' };
      case 'HOSTS_ONLY':
        return { allowed: false, reason: 'HOST_DISABLED_SCREEN_SHARING' };
      case 'SELECTED':
        return { allowed: false, reason: 'NOT_SELECTED_FOR_SCREEN_SHARING' };
      default:
        return { allowed: true, reason: 'ALLOWED' };
    }
  }, [screenSharePolicyMode, participantScreenSharePermissions, currentUser.role, currentUser.id, currentUser.userId, clientParticipantId, initialCurrentUser.id, initialCurrentUser.userId]);

  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'starting' | 'recording' | 'stopping' | 'processing' | 'ready' | 'failed'>('idle');
  const [isRecording, setIsRecording] = useState(false);

  // Sync isRecording with the presence of a bot participant
  useEffect(() => {
    const hasBot = participants.some((p) => p.role === "bot" || p.role === "recorder" || p.name?.toLowerCase().includes("recording"));
    setRecordingStatus((prev) => {
      if (hasBot) {
        if (prev !== 'stopping' && prev !== 'processing') {
           setIsRecording(true);
        }
        if (prev !== 'stopping' && prev !== 'processing' && prev !== 'starting') {
          return 'recording';
        }
        return prev;
      } else {
        // If we are starting or recording (via server signaling), do NOT reset to idle while bot is spinning up
        if (prev === 'starting' || prev === 'recording') {
          return prev;
        }
        // If stopping or processing, we keep the status but drop the visual red badge
        setIsRecording(false);
        if (prev === 'stopping' || prev === 'processing') {
           return prev;
        }
        return 'idle';
      }
    });
  }, [participants]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: "ai", content: "Hi! I am Konn3ct AI. I am actively reading the live meeting transcript. Ask me anything about what has been discussed!" }
  ]);
  const [micError, setMicError] = useState<{ name: string; message: string } | null>(null);
  const [camError, setCamError] = useState<{ name: string; message: string } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [meetingStartedAt, setMeetingStartedAt] = useState<number | null>(null);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [userDuration, setUserDuration] = useState(0);
  const userJoinedAtRef = useRef<number>(Date.now());
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
  const [isWidescreenEnabled, setIsWidescreenEnabled] = useState(true);
  const [outputVolume, setOutputVolume] = useState(75);
  const [isMirrorVideoEnabled, setIsMirrorVideoEnabled] = useState(true);
  const [isOriginalRatioEnabled, setIsOriginalRatioEnabled] = useState(false);
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

      const widescreen = localStorage.getItem("mtg_widescreenCapture");
      if (widescreen !== null) setIsWidescreenEnabled(widescreen === "true");

      const mirror = localStorage.getItem("mtg_mirrorVideo");
      if (mirror !== null) setIsMirrorVideoEnabled(mirror === "true");

      const originalRatio = localStorage.getItem("mtg_originalRatio");
      if (originalRatio !== null) setIsOriginalRatioEnabled(originalRatio === "true");

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
              p.id === (clientParticipantId || initialCurrentUser.id) ? { ...p, isMuted: true } : p
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

  const updateWidescreen = (val: boolean) => {
    setIsWidescreenEnabled(val);
    localStorage.setItem("mtg_widescreenCapture", String(val));
    // Apply immediately to WebRTC if connected
    if (webrtcClient.current && webrtcClient.current.isWidescreenEnabled !== val) {
      webrtcClient.current.isWidescreenEnabled = val;
      // Restart camera with new aspect ratio if active
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

  const updateOriginalRatio = (val: boolean) => {
    setIsOriginalRatioEnabled(val);
    localStorage.setItem("mtg_originalRatio", String(val));
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

  const [connectionRetryCount, setConnectionRetryCount] = useState(0);

  const retryConnection = useCallback(async () => {
    if (webrtcClient.current) {
      try {
        setWebrtcStatus("connecting");
        await webrtcClient.current.manualReconnect();
        return;
      } catch (e) {
        console.warn("manualReconnect failed, falling back to full token fetch & connect:", e);
      }
    }
    setConnectionRetryCount(prev => prev + 1);
  }, []);

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
        let sessionToken = typeof window !== "undefined" ? sessionStorage.getItem("conn3ct_session_token") : null;
        if (!sessionToken && typeof window !== "undefined") {
          try {
            sessionToken = localStorage.getItem(`konn3ct:session:${roomSlug}`);
            if (sessionToken) {
              sessionStorage.setItem("conn3ct_session_token", sessionToken);
            }
          } catch (e) {}
        }

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
        webrtcClient.current = client;
        if (typeof window !== 'undefined') {
          (window as any).__KONN3CT_WEBRTC__ = client;
        }
        client.isHDVideo = isHDVideoEnabled;
        client.isWidescreenEnabled = isWidescreenEnabled;
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
              if (decoded.logoutUrl) {
                setLogoutUrl(decoded.logoutUrl);
              }
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
          if (error.message && error.message.includes("Microphones are locked")) {
            toast.error("The host has locked microphones for this meeting.");
            setIsMuted(true);
            return;
          }
          setMicError({ name: error.name || 'Microphone Error', message: error.message || 'Unable to access your microphone.' });
          // Ensure the local state reflects that mic is off if it failed to turn on
          setIsMuted(true);
        };

        client.onServerLoadHigh = () => {
          toast.warning("Server is under heavy load. Optimizing video feeds to maintain stability...");
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
            setParticipants(prev => prev.map(p => p.id === (clientParticipantId || initialCurrentUser.id) ? { ...p, isCameraOn: false } : p));
          }
        };

        client.onServerReject = (msg) => {
          toast.error(msg);
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
            setParticipants(prev => prev.map(p => p.id === (clientParticipantId || initialCurrentUser.id) ? { ...p, isCameraOn: false } : p));
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

        client.onDirectionalNetworkQualityChange = (stats) => {
          // Provide subtle feedback if downlink or uplink enters CRITICAL
          const now = Date.now();
          if (stats.downlink === 'CRITICAL' || stats.uplink === 'CRITICAL') {
            if (now - lastNetworkToastTime > 30000 && prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
              toast.error("Severe network degradation detected. Preserving audio and meeting controls.", { duration: 5000 });
              lastNetworkToastTime = now;
            }
          }
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

        client.onCaptionReceived = (userId, name, text, isFinal, lang, translations) => {
          const tLang = translationLanguageRef.current;
          
          // Use server-side pre-computed translation if requested by user
          let displayText = text;
          if (translations && tLang && tLang !== 'original' && tLang !== 'en' && translations[tLang]) {
            displayText = translations[tLang];
          }

          setCaptions(currCaptions => {
            const newCaptions = [...currCaptions];
            const lastIdx = newCaptions.findIndex(c => c.userId === userId && !c.isFinal);
            const now = Date.now();
            if (lastIdx >= 0) {
              if (now - newCaptions[lastIdx].timestamp > 6000) {
                newCaptions[lastIdx].isFinal = true;
                newCaptions.push({ userId, name, text: displayText, isFinal, timestamp: now });
              } else {
                newCaptions[lastIdx] = { userId, name, text: displayText, isFinal, timestamp: now };
              }
            } else {
              newCaptions.push({ userId, name, text: displayText, isFinal, timestamp: now });
            }
            if (newCaptions.length > 5) return newCaptions.slice(newCaptions.length - 5);
            return newCaptions;
          });
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
            targetUserId: m.targetUserId,
            fileUrl: m.fileUrl
          })));
        };

        client.onPollHistory = (historyPolls) => {
          if (!Array.isArray(historyPolls)) return;
          const currentUid = webrtcClient.current?.userId || currentUser.userId || initialCurrentUser.userId || initialCurrentUser.id;
          const currentPid = clientParticipantId || webrtcClient.current?.participantId || currentUser.id || initialCurrentUser.id;

          const activePolls = historyPolls.filter((p: any) => p && p.isActive !== false);
          const pollsWithDetails = activePolls.map((poll: any) => {
            let totalVotes = 0;
            let myVote = undefined;
            if (Array.isArray(poll.options)) {
              for (const opt of poll.options) {
                totalVotes += opt.votes || 0;
                if (Array.isArray(opt.votedBy) && opt.votedBy.some((v: any) => {
                  const voteId = typeof v === 'string' ? v : (v.userId || v.participantId || v.id);
                  return voteId === currentUid || voteId === currentPid;
                })) {
                  myVote = opt.id;
                }
              }
            }
            return {
              ...poll,
              isActive: true,
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
                targetUserId: msg.targetUserId,
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

        client.onSessionStatus = (msg) => {
          if (msg.participantId) {
            setClientParticipantId(msg.participantId);
            setInitialCurrentUser(prev => ({
              ...prev,
              id: msg.participantId || prev.id,
              userId: msg.userId || prev.userId,
              name: msg.name || prev.name,
              role: (msg.role as any) || prev.role
            }));
            setParticipants(prev => prev.map(p => {
              if (
                p.id === clientParticipantId ||
                p.id === initialCurrentUser.id ||
                p.id === 'pending' ||
                p.id === 'ssr-placeholder' ||
                (p.userId && (p.userId === msg.userId || p.userId === initialCurrentUser.userId))
              ) {
                return {
                  ...p,
                  id: msg.participantId,
                  userId: msg.userId || p.userId,
                  name: msg.name || p.name,
                  role: (msg.role as any) || p.role
                };
              }
              return p;
            }));
          }
        };

        const isLocalIdentifier = (id?: string) => {
          if (!id) return false;
          return (
            id === webrtcClient.current?.userId ||
            id === webrtcClient.current?.participantId ||
            id === clientParticipantId ||
            id === initialCurrentUser.id ||
            id === initialCurrentUser.userId ||
            id === currentUser.id ||
            id === currentUser.userId
          );
        };

        const resolveUserId = (id: string) => {
          if (isLocalIdentifier(id)) {
            return clientParticipantId || webrtcClient.current?.participantId || initialCurrentUser.id;
          }
          return id;
        };

        client.onAudioStatusChanged = (status) => {
          setParticipants((prev) => prev.map(p =>
            (isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)))
              ? { ...p, audioConnectionStatus: status as any }
              : p
          ));
        };

        client.onRemoteAudioConnectionStatus = (msg) => {
          const isLocal = isLocalIdentifier(msg.participantId) || isLocalIdentifier(msg.userId);
          const targetId = resolveUserId(msg.participantId || msg.userId);
          setParticipants((prev) => prev.map(p => {
            if (isLocal) {
              return (isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)))
                ? { ...p, audioConnectionStatus: msg.audioConnectionStatus }
                : p;
            }
            return (p.id === targetId || p.id === msg.participantId || (msg.userId && p.userId === msg.userId))
              ? { ...p, audioConnectionStatus: msg.audioConnectionStatus }
              : p;
          }));
        };

        client.onMuteState = (msg) => {
          const isLocal = isLocalIdentifier(msg.userId) || isLocalIdentifier(msg.participantId);
          const targetId = resolveUserId(msg.participantId || msg.userId);
          setParticipants((prev) => {
            const user = prev.find(p => isLocal ? (isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId))) : (p.id === targetId || p.id === msg.participantId || p.userId === msg.userId));
            if (user && user.isMuted !== msg.isMuted && !isLocal) {
              if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showMuteUnmuteToasts) {
                toast.info(`${user.name} is now ${msg.isMuted ? 'muted' : 'unmuted'}`);
              }
              if (prefsRef.current.notifications.playMuteUnmuteSound) {
                playNotificationSound(msg.isMuted ? 300 : 500, 0.1, 0.05);
              }
            }
            return prev.map(p => {
              if (isLocal) {
                return (isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)))
                  ? { ...p, isMuted: msg.isMuted }
                  : p;
              }
              return (p.id === targetId || p.id === msg.participantId || (msg.userId && p.userId === msg.userId))
                ? { ...p, isMuted: msg.isMuted }
                : p;
            });
          });
        };

        client.onECinemaAction = (msg) => {
          setEcinemaAction({ action: msg.action, time: msg.time });
        };

        client.onCameraState = (msg) => {
          const isLocal = isLocalIdentifier(msg.userId) || isLocalIdentifier(msg.participantId);
          const targetId = resolveUserId(msg.participantId || msg.userId);
          setParticipants((prev) => prev.map(p => {
            if (isLocal) {
              return (isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)))
                ? { ...p, isCameraOn: msg.isCameraOn, audioOnlyMode: msg.audioOnlyMode, videoSuspendedReason: msg.videoSuspendedReason }
                : p;
            }
            return (p.id === targetId || p.id === msg.participantId || (msg.userId && p.userId === msg.userId))
              ? { ...p, isCameraOn: msg.isCameraOn, audioOnlyMode: msg.audioOnlyMode, videoSuspendedReason: msg.videoSuspendedReason }
              : p;
          }));
        };

        client.onHandRaise = (msg) => {
          const isLocal = isLocalIdentifier(msg.userId) || isLocalIdentifier(msg.participantId);
          const targetId = resolveUserId(msg.participantId || msg.userId);
          
          setParticipants((prev) => {
            const updated = prev.map(p => {
              if (isLocal) {
                return (isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)))
                  ? { ...p, isHandRaised: msg.isHandRaised }
                  : p;
              }
              return (p.id === targetId || p.id === msg.participantId || (msg.userId && p.userId === msg.userId))
                ? { ...p, isHandRaised: msg.isHandRaised }
                : p;
            });
            
            if (msg.isHandRaised && !isLocal) {
              // Always play sound (playNotificationSound respects enableAllSounds internally)
              playNotificationSound(880, 0.3, 0.1);
              
              if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
                // Must use latest state to find user to avoid stale closure
                const user = updated.find(p => p.id === targetId || p.id === msg.participantId || p.userId === msg.userId);
                if (user) {
                  // Use a small timeout to avoid React state update warnings in StrictMode for toasts
                  setTimeout(() => toast.info(`${user.name} raised their hand`), 0);
                }
              }
            }
            
            return updated;
          });
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

        client.onScreenShareStopped = (userId, producerId, participantId) => {
          const targetId = resolveUserId(userId);
          const isSelf = targetId === (clientParticipantId || initialCurrentUser.id) ||
                         (participantId && participantId === (clientParticipantId || initialCurrentUser.id)) ||
                         userId === currentUser.id ||
                         userId === currentUser.userId ||
                         targetId === currentUser.userId;

          if (isSelf) {
            setIsScreenSharing(false);
            client?.disableScreenShare({ serverAlreadyClosed: true });
            if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
              toast.info("Your screen sharing has ended");
            }
          } else {
            if (prefsRef.current.notifications.enableAllToasts && prefsRef.current.notifications.showSystemToasts) {
              toast.info(`Screen sharing ended`);
            }
          }

          setParticipants((prev) => prev.map(p =>
            (p.id === targetId || p.userId === userId || (participantId && p.id === participantId) || (isSelf && (p.id === currentUser.id || p.id === clientParticipantId)))
              ? { ...p, isScreenSharing: false, screenTrack: null }
              : p
          ));
        };

        client.onActiveSpeaker = (userIds, participantIds) => {
          setParticipants((prev) => prev.map(p => {
            if (p.id === (clientParticipantId || initialCurrentUser.id)) {
              return { ...p, isSpeaking: localIsSpeakingRef.current || userIds.includes(p.userId) || (participantIds && participantIds.includes(p.id)) || userIds.includes(webrtcClient.current?.userId || '') };
            }
            return { ...p, isSpeaking: (participantIds && participantIds.includes(p.id)) || userIds.includes(p.userId) };
          }));
        };

        client.onMeetingStartedAt = (timestamp: number) => {
          setMeetingStartedAt(timestamp);
        };

        client.onWaitingRoomRequest = (msg) => {
          if (notifiedWaitingUsersRef.current.has(msg.userId)) {
            return;
          }
          notifiedWaitingUsersRef.current.add(msg.userId);

          // Play Doorbell Sound (Ding-Dong)
          try {
            const enableAll = prefsRef.current.notifications.enableAllSounds;
            
            if (enableAll && client?.userRole !== 'bot' && client?.userRole !== 'recorder' && !(window as any).disableAudioNotifications) {
              const audioCtx = getSharedAudioContext();
              if (audioCtx) {
                if (audioCtx.state === 'suspended') {
                  audioCtx.resume().catch(() => {});
                }
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
            }
          } catch(e) {
            console.warn("Failed to play doorbell sound", e);
          }

          const toastBg = activeTheme === 'midnight' ? '#1F1F23' :
                          activeTheme === 'slate' ? '#1E293B' :
                          activeTheme === 'soft' ? '#FAFAF7' : '#FFFFFF';
          const toastColor = activeTheme === 'midnight' ? '#FAFAFA' :
                             activeTheme === 'slate' ? '#F1F5F9' :
                             activeTheme === 'soft' ? '#1C1C1A' : '#1A2B1F';
          const toastBorder = activeTheme === 'midnight' ? 'rgba(255,255,255,0.08)' :
                              activeTheme === 'slate' ? 'rgba(255,255,255,0.07)' :
                              activeTheme === 'soft' ? '#C8C7C1' : 'rgba(0,0,0,0.10)';
          const controlBg = activeTheme === 'midnight' ? 'rgba(255,255,255,0.07)' :
                            activeTheme === 'slate' ? 'rgba(255,255,255,0.06)' :
                            activeTheme === 'soft' ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.07)';

          toast.custom((t) => (
            <div 
              className="p-4 rounded-xl shadow-2xl border w-full flex flex-col gap-3 backdrop-blur-2xl" 
              style={{ 
                backgroundColor: toastBg, 
                color: toastColor, 
                borderColor: toastBorder,
                pointerEvents: 'auto' 
              }}
            >
              <div className="font-medium text-sm text-balance leading-tight">{msg.name} is waiting to join</div>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => { 
                    webrtcClient.current?.sendAdmitUser(msg.userId); 
                    notifiedWaitingUsersRef.current.delete(msg.userId);
                    toast.dismiss(t);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-md transition-colors border"
                  style={{ 
                    backgroundColor: controlBg, 
                    color: toastColor,
                    borderColor: toastBorder
                  }}
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
            if (['failed', 'kicked', 'denied'].includes(state)) {
              client?.disconnect();
            }
            if (state === 'reconnecting') {
              console.log("[MeetingContext] Signaling reconnecting... preserving active meeting UI and media.");
            } else if (state === 'connected') {
              // Update local user's name and role based on server truth, preserving existing name if server userName is not ready
              setParticipants(prev => prev.map(p => 
                p.id === (clientParticipantId || initialCurrentUser.id) 
                  ? { 
                      ...p, 
                      name: webrtcClient.current?.userName?.trim() ? webrtcClient.current.userName.trim() : (p.name?.trim() ? p.name : (initialCurrentUser.name || 'Guest')), 
                      role: (webrtcClient.current?.userRole || p.role || 'attendee') as any 
                    } 
                  : p
              ));
              if (webrtcClient.current?.meetingStartedAt) {
                setMeetingStartedAt(webrtcClient.current.meetingStartedAt);
              }
              if (webrtcClient.current?.roomName || webrtcClient.current?.maxParticipants || webrtcClient.current?.isWaitingRoomEnabled !== undefined) {
                setMeetingInfo(prev => ({ 
                  ...prev, 
                  ...(webrtcClient.current?.roomName && { roomName: webrtcClient.current.roomName }),
                  ...(webrtcClient.current?.maxParticipants && { maxParticipants: webrtcClient.current.maxParticipants }),
                  ...(webrtcClient.current?.isWaitingRoomEnabled !== undefined && { isWaitingRoomEnabled: webrtcClient.current.isWaitingRoomEnabled }),
                }));
                if (webrtcClient.current?.isWaitingRoomEnabled !== undefined) {
                  setRoomSettings(prev => ({
                    ...prev,
                    bypassWaitingRoom: !webrtcClient.current!.isWaitingRoomEnabled
                  }));
                }
              }
            } else if (state === 'waiting') {
              setIsMuted(true);
              setIsCameraOn(false);
              if (webrtcClient.current?.roomName || webrtcClient.current?.maxParticipants || webrtcClient.current?.isWaitingRoomEnabled !== undefined) {
                setMeetingInfo(prev => ({ 
                  ...prev, 
                  ...(webrtcClient.current?.roomName && { roomName: webrtcClient.current.roomName }),
                  ...(webrtcClient.current?.maxParticipants && { maxParticipants: webrtcClient.current.maxParticipants }),
                  ...(webrtcClient.current?.isWaitingRoomEnabled !== undefined && { isWaitingRoomEnabled: webrtcClient.current.isWaitingRoomEnabled }),
                }));
                if (webrtcClient.current?.isWaitingRoomEnabled !== undefined) {
                  setRoomSettings(prev => ({
                    ...prev,
                    bypassWaitingRoom: !webrtcClient.current!.isWaitingRoomEnabled
                  }));
                }
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
          webrtcClient.current?.setDesiredMicMuted(true, 'HOST_MUTE');
          webrtcClient.current?.pauseMic();
          webrtcClient.current?.sendMuteState(true);
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === (clientParticipantId || initialCurrentUser.id) ? { ...p, isMuted: true } : p
            )
          );
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

        client.onInitialPermissions = (perms) => {
          setScreenSharePolicyMode(perms.screenSharePolicyMode);
          const myParticipantId = clientParticipantId || initialCurrentUser.id || webrtcClient.current?.participantId;
          const myUserId = currentUser.userId || initialCurrentUser.userId || webrtcClient.current?.userId;
          setParticipantScreenSharePermissions(prev => {
            const next = { ...prev };
            if (perms.allParticipantPermissions) {
              Object.assign(next, perms.allParticipantPermissions);
            }
            if (myParticipantId) {
              next[myParticipantId] = perms.localScreenSharePermission;
              next[getParticipantIdentityKey(myParticipantId)] = perms.localScreenSharePermission;
            }
            if (myUserId) {
              next[myUserId] = perms.localScreenSharePermission;
              next[getParticipantIdentityKey(myUserId)] = perms.localScreenSharePermission;
            }
            return next;
          });
        };

        client.onScreenSharePolicyChanged = (mode, version) => {
          setScreenSharePolicyMode(mode);
        };

        client.onParticipantScreenSharePermissionChanged = (userId, permission, version, targetParticipantId) => {
          setParticipantScreenSharePermissions(prev => {
            const next = { ...prev };
            if (userId) {
              next[userId] = permission;
              next[getParticipantIdentityKey(userId)] = permission;
            }
            if (targetParticipantId) {
              next[targetParticipantId] = permission;
              next[getParticipantIdentityKey(targetParticipantId)] = permission;
            }
            const matchedParticipant = participantsRef.current?.find(p => 
              p.id === targetParticipantId || p.userId === userId || p.id === userId || p.userId === targetParticipantId
            );
            if (matchedParticipant) {
              if (matchedParticipant.id) {
                next[matchedParticipant.id] = permission;
                next[getParticipantIdentityKey(matchedParticipant.id)] = permission;
              }
              if (matchedParticipant.userId) {
                next[matchedParticipant.userId] = permission;
                next[getParticipantIdentityKey(matchedParticipant.userId)] = permission;
              }
            }
            return next;
          });
        };

        client.onScreenShareStoppedByHost = (userId, producerId) => {
          if (userId === (clientParticipantId || initialCurrentUser.id) || userId === client?.userId) {
            toast.error("Your screen sharing was stopped by the host.");
            setIsScreenSharing(false);
            client?.disableScreenShare({ serverAlreadyClosed: true });
            setParticipants(prev => prev.map(p =>
              p.id === (clientParticipantId || initialCurrentUser.id) ? { ...p, isScreenSharing: false, screenTrack: null } : p
            ));
          }
        };

        client.onScreenShareStopped = (userId, producerId, participantId) => {
          const isSelf = (participantId && (participantId === (clientParticipantId || initialCurrentUser.id) || participantId === client?.participantId)) ||
                         (userId && (userId === client?.userId || userId === initialCurrentUser.userId || userId === currentUser.userId));
          if (isSelf) {
            setIsScreenSharing(false);
            client?.disableScreenShare({ serverAlreadyClosed: true });
          }
          setParticipants(prev => prev.map(p => {
            const matches = (participantId && (p.id === participantId || p.userId === participantId)) ||
                            (userId && (p.id === userId || p.userId === userId)) ||
                            (producerId && (p.screenProducerId === producerId || p.screenAudioProducerId === producerId));
            if (matches) {
              return {
                ...p,
                isScreenSharing: false,
                screenTrack: undefined,
                screenAudioTrack: undefined,
                screenProducerId: undefined,
                screenConsumerId: undefined,
                screenTrackId: undefined,
                screenAudioProducerId: undefined,
                screenAudioConsumerId: undefined,
                screenAudioTrackId: undefined,
                screenStats: undefined
              };
            }
            return p;
          }));
        };

        client.onConsumerClosed = (producerId, appData) => {
          const targetConsumerId = appData?.consumerId;
          setParticipants(prev => prev.map(p => {
            // Audio producer/consumer cleanup — require non-empty ID matches (A04/R4)
            const matchesAudio = Boolean(
              (producerId && p.audioProducerId === producerId) ||
              (targetConsumerId && p.audioConsumerId === targetConsumerId)
            );
            if (matchesAudio) {
              return {
                ...p,
                audioTrack: undefined,
                audioProducerId: undefined,
                audioConsumerId: undefined,
                audioTrackId: undefined,
                isSpeaking: false,
              };
            }
            if (p.screenProducerId === producerId || p.screenAudioProducerId === producerId || (appData as any)?.source === 'screen') {
              if (
                (producerId && (p.screenProducerId === producerId || p.screenAudioProducerId === producerId)) ||
                (appData?.participantId && p.id === appData.participantId) ||
                (appData?.userId && p.userId === appData.userId)
              ) {
                return {
                  ...p,
                  isScreenSharing: false,
                  screenTrack: undefined,
                  screenAudioTrack: undefined,
                  screenProducerId: undefined,
                  screenConsumerId: undefined,
                  screenTrackId: undefined,
                  screenAudioProducerId: undefined,
                  screenAudioConsumerId: undefined,
                  screenAudioTrackId: undefined,
                  screenStats: undefined
                };
              }
            }
            if (producerId && p.cameraProducerId === producerId) {
              return {
                ...p,
                isCameraOn: false,
                videoTrack: undefined,
                cameraProducerId: undefined,
                cameraConsumerId: undefined,
                cameraTrackId: undefined,
                cameraStats: undefined
              };
            }
            return p;
          }));
        };

        client.onParticipantPingReceived = (ping) => {
          if (pingDedupeRef.current.has(ping.pingId)) return;
          pingDedupeRef.current.add(ping.pingId);
          setTimeout(() => pingDedupeRef.current.delete(ping.pingId), 15000);

          const now = Date.now();
          const shouldPlaySound = (now - lastPingSoundTimeRef.current) > 2000;
          if (shouldPlaySound) lastPingSoundTimeRef.current = now;

          const stats = {
            visualShown: true,
            audioAttempted: shouldPlaySound,
            audioPlayed: false,
            audioBlocked: false,
            hapticAttempted: false
          };

          const senderName = ping.senderDisplayName || 'The host';
          toast(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">🔔 Attention requested</span>
              <span className="text-sm opacity-90">{senderName} is trying to get your attention.</span>
            </div>, 
            { duration: 5000 }
          );

          if (shouldPlaySound) {
            try {
              const ctx = getSharedAudioContext();
              if (ctx && ctx.state !== 'suspended') {
                playNotificationSound(880, 0.2, 0.15); // Attention beep
                setTimeout(() => playNotificationSound(1100, 0.2, 0.15), 250);
                stats.audioPlayed = true;
              } else {
                stats.audioBlocked = true;
              }
            } catch (e) {
              stats.audioBlocked = true;
            }
          }

          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            stats.hapticAttempted = true;
            try { navigator.vibrate([200, 100, 200]); } catch (e) {}
          }

          client?.pingDeliveryAck(ping.pingId, stats);
        };

        client.onPingStatus = (status) => {
          if (status.status === 'SENT') {
            toast.success("Ping sent");
          } else if (status.status === 'DELIVERED') {
            toast.success("Ping delivered");
          } else if (status.status === 'NOT_REACHABLE') {
            toast.error("Unable to reach participant");
          } else if (status.status === 'RATE_LIMITED') {
            toast.error("You are sending pings too quickly");
          } else if (status.status === 'DENIED') {
            toast.error("Permission denied");
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
            
            if (newSettings.bypassWaitingRoom !== undefined) {
              setMeetingInfo(m => ({ ...m, isWaitingRoomEnabled: !newSettings.bypassWaitingRoom }));
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

        client.onRecordingStarted = () => {
          setIsRecording(true);
          setRecordingStatus('recording');
          toast.info("Recording has started.", { id: 'recording_status' });
        };

        client.onRecordingStopping = () => {
          setIsRecording(false);
          setRecordingStatus('stopping');
          toast.info("Recording is stopping and finalizing...", { id: 'recording_status' });
        };

        client.onRecordingStopped = () => {
          setIsRecording(false);
          setRecordingStatus('idle');
          toast.info("Recording has stopped.", { id: 'recording_status' });
        };

        client.onParticipantsList = (backendParticipants) => {
          setParticipants((prev) => {
            let duplicatesDetected = false;
            let staleRemoved = false;
            
            const localUserId = webrtcClient.current?.userId || currentUser.userId || initialCurrentUser.userId || initialCurrentUser.id;
            const currentPartId = clientParticipantId || webrtcClient.current?.participantId || currentUser.id || initialCurrentUser.id;

            const isLocalMatch = (pid?: string, uid?: string) => {
              return Boolean(
                (pid && (pid === currentPartId || pid === initialCurrentUser.id || isLocalIdentifier(pid) || (webrtcClient.current?.participantId && pid === webrtcClient.current.participantId))) ||
                (uid && (uid === localUserId || uid === initialCurrentUser.userId || isLocalIdentifier(uid) || (webrtcClient.current?.userId && uid === webrtcClient.current.userId)))
              );
            };

            // 1. Resolve local user from prev (never mutate in-place!)
            const prevLocal = prev.find(p => isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)));
            let currentLocalUser: Participant = prevLocal
              ? { ...prevLocal }
              : {
                  id: currentPartId,
                  userId: localUserId,
                  name: initialCurrentUser.name || "Me",
                  role: initialCurrentUser.role || "attendee",
                  isMuted: isMuted,
                  isCameraOn: isCameraOn,
                  audioTrack: localAudioTrackRef.current || undefined,
                  videoTrack: localCameraTrackRef.current || undefined,
                  isScreenSharing: isScreenSharing,
                  isHandRaised: false,
                  isSpeaking: false,
                  networkQuality: 'good',
                  joinedAt: new Date().toISOString(),
                  isConnecting: false,
                  isMobile: isMobileClient,
                };

            // Reconcile local entry from backendParticipants if present
            const backendLocal = backendParticipants.find(p => isLocalMatch(p.participantId, p.userId));
            if (backendLocal) {
              currentLocalUser = {
                ...currentLocalUser,
                role: (backendLocal.role as any) || currentLocalUser.role,
                isMobile: backendLocal.isMobile ?? currentLocalUser.isMobile,
                id: backendLocal.participantId || currentLocalUser.id,
                userId: backendLocal.userId || currentLocalUser.userId,
              };
            }

            // 2. Process remote participants with dedicated deduplication sets (A02, A15)
            const seenRemoteParticipantIds = new Set<string>();
            const seenRemoteUserIds = new Set<string>();
            const remoteParticipants: Participant[] = [];

            for (const p of backendParticipants) {
              if (isLocalMatch(p.participantId, p.userId)) {
                continue; // Handled in local user reconciliation above
              }

              if (
                (p.participantId && seenRemoteParticipantIds.has(p.participantId)) ||
                (p.userId && seenRemoteUserIds.has(p.userId))
              ) {
                duplicatesDetected = true;
                continue;
              }
              if (p.participantId) seenRemoteParticipantIds.add(p.participantId);
              if (p.userId) seenRemoteUserIds.add(p.userId);

              // Match existing remote participant from prev (never matching local user)
              const existing = prev.find(ep =>
                !isLocalIdentifier(ep.id) &&
                !isLocalIdentifier(ep.userId) &&
                ((p.participantId && ep.id === p.participantId) || (p.userId && ep.userId === p.userId))
              );

              const validName = p.name?.trim() ? p.name.trim() : (existing?.name?.trim() ? existing.name : `Participant ${p.participantId ? p.participantId.substring(0, 8) : ''}`);

              if (existing) {
                remoteParticipants.push({
                  ...existing,
                  id: p.participantId,
                  userId: p.userId,
                  name: validName,
                  role: (p.role as any) || existing.role,
                  isMobile: p.isMobile ?? existing.isMobile,
                  isCameraOn: p.isCameraOn ?? existing.isCameraOn,
                  isMuted: (p as any).isMuted !== undefined ? (p as any).isMuted : existing.isMuted,
                  audioOnlyMode: p.audioOnlyMode ?? existing.audioOnlyMode,
                  videoSuspendedReason: p.videoSuspendedReason ?? existing.videoSuspendedReason,
                  audioConnectionStatus: (p as any).audioConnectionStatus ?? existing.audioConnectionStatus
                });
              } else {
                remoteParticipants.push({
                  id: p.participantId,
                  userId: p.userId,
                  name: validName,
                  role: (p.role as any) || 'attendee',
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

            const nextParticipants: Participant[] = [currentLocalUser, ...remoteParticipants];

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
          const uniqueId = user.participantId || user.userId;
          setWaitingUsers(prev => prev.filter(u => u.userId !== user.userId));
          setParticipants((prev) => {
            const existingIndex = prev.findIndex(p => p.id === uniqueId || p.userId === user.userId || p.id === user.userId);
            const validName = user.name?.trim() ? user.name.trim() : (existingIndex >= 0 ? prev[existingIndex].name : `Participant ${uniqueId.substring(5, 9)}`);

            if (existingIndex >= 0) {
              return prev.map((p, idx) => idx === existingIndex ? { 
                ...p, 
                id: uniqueId,
                userId: user.userId,
                name: validName, 
                role: (user.role as any) || p.role, 
                isMobile: user.isMobile ?? p.isMobile, 
                isCameraOn: user.isCameraOn ?? p.isCameraOn, 
                isMuted: (user as any).isMuted !== undefined ? (user as any).isMuted : p.isMuted,
                audioOnlyMode: user.audioOnlyMode ?? p.audioOnlyMode, 
                videoSuspendedReason: user.videoSuspendedReason ?? p.videoSuspendedReason 
              } : p);
            }
            return [...prev, {
              id: uniqueId,
              userId: user.userId,
              name: validName,
              role: (user.role as any) || 'attendee',
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

        client.onRoleChanged = (userId, newRole, participantId) => {
          const targetId = resolveUserId(userId);
          setParticipants((prev) => prev.map(p => 
            (p.id === targetId || p.userId === userId || (participantId && p.id === participantId)) ? { ...p, role: newRole as any } : p
          ));
          if (targetId === (clientParticipantId || initialCurrentUser.id) || (participantId && participantId === (clientParticipantId || initialCurrentUser.id)) || userId === client?.userId) {
            toast.info(`Your role has been updated to ${newRole}`);
          }
        };

        client.onUserLeft = (userId) => {
          if (hasLeftMeetingRef.current) return;
          const isSelf = isLocalIdentifier(userId);
          if (isSelf) {
            console.warn(`[MeetingContext] Ignored user_left packet for local user identity: ${userId}`);
            return;
          }

          setParticipants((prev) => {
            const user = prev.find(p => (p.id === userId || p.userId === userId) && !isLocalIdentifier(p.id) && !isLocalIdentifier(p.userId));
            if (user && !isLocalIdentifier(user.id) && !isLocalIdentifier(user.userId)) {
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
            return prev.filter(p => isLocalIdentifier(p.id) || (p.userId && isLocalIdentifier(p.userId)) || (p.id !== userId && p.userId !== userId));
          });
        };

        client.onNewConsumer = (consumer, participantId, userName) => {
          const source = (consumer.appData as any)?.source || (consumer.kind === 'audio' ? 'audio' : 'camera');
          
          setParticipants((prev) => {
            const exists = prev.find((p) => p.id === participantId || p.userId === participantId);
            if (exists) {
              return prev.map((p) => {
                if (p.id === exists.id) {
                  const updatedName = (userName?.trim() && (!p.name || p.name.startsWith('Participant '))) ? userName.trim() : p.name;
                  if (consumer.kind === 'audio') {
                    if (source === 'screen-audio') {
                      return { 
                        ...p, 
                        name: updatedName,
                        screenAudioTrack: consumer.track as MediaStreamTrack,
                        screenAudioProducerId: consumer.producerId,
                        screenAudioConsumerId: consumer.id,
                        screenAudioTrackId: consumer.track.id
                      };
                    } else {
                      return { 
                        ...p, 
                        name: updatedName, 
                        audioTrack: consumer.track as MediaStreamTrack,
                        audioProducerId: consumer.producerId,
                        audioConsumerId: consumer.id,
                        audioTrackId: consumer.track.id,
                        isMuted: consumer.paused ? true : false
                      };
                    }
                  }
                  if (consumer.kind === 'video') {
                    if (source === 'screen') {
                      return { 
                        ...p, 
                        name: updatedName,
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
                        name: updatedName, 
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
              const resolvedName = userName?.trim() ? userName.trim() : `Participant ${participantId.substring(5, 9)}`;
              const existingRef = prev.find(p => p.id === participantId || p.userId === participantId);
              const isMutedIntent = consumer.kind === 'audio' && source !== 'screen-audio' 
                ? (consumer.paused ? true : false) 
                : (existingRef ? existingRef.isMuted : true);

              const newParticipant: Participant = {
                id: participantId,
                userId: participantId, // Fallback, though ideally we'd have the real userId
                name: resolvedName,
                role: "attendee",
                isMuted: isMutedIntent,
                isCameraOn: consumer.kind === "video" && source !== 'screen', // Defaults to true if video consumer is created first
                isScreenSharing: consumer.kind === "video" && source === 'screen',
                audioTrack: consumer.kind === "audio" && source !== 'screen-audio' ? (consumer.track as MediaStreamTrack) : undefined,
                audioProducerId: consumer.kind === "audio" && source !== 'screen-audio' ? consumer.producerId : undefined,
                audioConsumerId: consumer.kind === "audio" && source !== 'screen-audio' ? consumer.id : undefined,
                audioTrackId: consumer.kind === "audio" && source !== 'screen-audio' ? consumer.track.id : undefined,
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
  }, [roomSlug, initialCurrentUser.name, clientParticipantId, connectionRetryCount]);

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
            client.setDesiredMicMuted(isMuted, 'INIT_MEDIA');
            audioTrack = await client.enableMic(false, isMuted);
            localAudioTrackRef.current = audioTrack;
            registerLocalTrack(audioTrack);
            if (isMuted) {
              client.pauseMic();
            }
            client.sendMuteState(isMuted);
          } catch (e) {
            console.error("Failed to enable mic:", e);
          }

          setParticipants((prev) =>
            prev.map((p) => {
              if (p.id === (clientParticipantId || initialCurrentUser.id)) {
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
                  if (p.id === (clientParticipantId || initialCurrentUser.id)) {
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
        const saved = typeof window !== 'undefined' ? localStorage.getItem("conn3ct_devices") : null;
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

    setSelectedDevices(prev => {
      const next = { ...prev, [kind]: deviceId };
      localStorage.setItem("conn3ct_devices", JSON.stringify(next));
      return next;
    });

    if (kind === 'audioOutput') {
      return;
    }

    const type = kind === 'audioInput' ? 'audio' : 'video';
    try {
      const newTrack = await webrtcClient.current?.switchDevice(type, deviceId);
      
      if (newTrack) {
        if (type === 'audio') {
          localAudioTrackRef.current = newTrack;
          registerLocalTrack(newTrack);
        } else {
          localCameraTrackRef.current = newTrack;
          registerLocalTrack(newTrack);
          setParticipants(prev => prev.map(p => 
            p.id === (clientParticipantId || initialCurrentUser.id) ? { ...p, videoTrack: newTrack } : p
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

  // ── Timers (Overall Meeting Duration & Personal Time in Meeting) ───────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const updateTimers = () => {
      const now = Date.now();
      const start = meetingStartedAt || userJoinedAtRef.current;
      setMeetingDuration(Math.max(0, Math.floor((now - start) / 1000)));
      setUserDuration(Math.max(0, Math.floor((now - userJoinedAtRef.current) / 1000)));
    };

    updateTimers();
    timerRef.current = setInterval(updateTimers, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [meetingStartedAt]);

  // Handle browser close or page hide to immediately notify server of departure
  useEffect(() => {
    const handlePageDeparture = () => {
      try {
        if (!hasLeftMeetingRef.current && webrtcClient.current) {
          hasLeftMeetingRef.current = true;
          webrtcClient.current.sendLeaveMeeting();
          webrtcClient.current.disconnect();
        }
      } catch (e) {}
    };
    window.addEventListener('pagehide', handlePageDeparture);
    window.addEventListener('beforeunload', handlePageDeparture);
    return () => {
      window.removeEventListener('pagehide', handlePageDeparture);
      window.removeEventListener('beforeunload', handlePageDeparture);
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
          setParticipants((prev) => prev.map(p =>
            (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
              ? { ...p, isSpeaking: false }
              : p
          ));
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
          setParticipants((prev) => prev.map(p =>
            (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
              ? { ...p, isSpeaking: currentlySpeaking }
              : p
          ));
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
  }, [isMuted, audioTrackVersion, clientParticipantId, initialCurrentUser.id, initialCurrentUser.userId]);

  // ── Actions ──────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (isRecorderMode) return;
    const newState = !isMuted;
    webrtcClient.current?.setDesiredMicMuted(newState, newState ? 'USER_MUTE' : 'USER_UNMUTE');
    if (newState) webrtcClient.current?.pauseMic();
    else webrtcClient.current?.resumeMic();
    webrtcClient.current?.sendMuteState(newState);
    setIsMuted(newState);
    setParticipants(prev => prev.map(p =>
      (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
        ? { ...p, isMuted: newState }
        : p
    ));
  }, [isMuted, clientParticipantId, initialCurrentUser.id, initialCurrentUser.userId]);

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
        setParticipants(prev => prev.map(p =>
          (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
            ? { ...p, isCameraOn: newState, videoTrack: undefined }
            : p
        ));
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
        setParticipants(prev => prev.map(p =>
          (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
            ? { ...p, isCameraOn: newState, videoTrack: finalTrack, audioOnlyMode: false, videoSuspendedReason: undefined }
            : p
        ));
      }).catch(err => {
        console.log('camera_switch_failed_preserved_old_track');
        console.error("Failed to enable camera:", err);
        if (err.message && err.message.includes("Cameras are locked")) {
          toast.error("The host has locked cameras for this meeting.");
        } else {
          setCamError({ name: err.name || 'Camera Error', message: err.message || 'Unable to access your camera.' });
        }
        // Ensure UI stays off
        setIsCameraOn(false);
      }).finally(() => {
        cameraOperationInProgress.current = false;
      });
    }
  }, [isCameraOn, clientParticipantId, initialCurrentUser.id, initialCurrentUser.userId, vbMode, vbImageUrl]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        await webrtcClient.current?.disableScreenShare();
        setIsScreenSharing(false);
        setParticipants(prev => prev.map(p =>
          (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
            ? { ...p, isScreenSharing: false, screenTrack: null }
            : p
        ));
      } else {
        const screenTrack = await webrtcClient.current?.enableScreenShare();
        if (screenTrack) {
          localScreenTrackRef.current = screenTrack;
          registerLocalTrack(screenTrack);
          if (webrtcClient.current?.localScreenAudioTrack) {
            localScreenAudioTrackRef.current = webrtcClient.current.localScreenAudioTrack;
            registerLocalTrack(webrtcClient.current.localScreenAudioTrack);
          }
          setIsScreenSharing(true);
          setParticipants(prev => prev.map(p =>
            (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
              ? { ...p, isScreenSharing: true, screenTrack }
              : p
          ));
          screenTrack.onended = async () => {
            localScreenTrackRef.current = null;
            localScreenAudioTrackRef.current = null;
            await webrtcClient.current?.disableScreenShare();
            setIsScreenSharing(false);
            setParticipants(prev => prev.map(p =>
              (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
                ? { ...p, isScreenSharing: false, screenTrack: null }
                : p
            ));
          };
        }
      }
    } catch (e) {
      console.error("Screen share error:", e);
    }
  }, [isScreenSharing, clientParticipantId, initialCurrentUser.id, initialCurrentUser.userId]);
  const toggleRecording = useCallback(async () => {
    if (recordingStatus === 'recording') {
      webrtcClient.current?.sendStopRecording();
      setRecordingStatus('processing');
      toast.success("Recording stopping. It will be saved to cloud.", { id: 'recording_status' });
    } else if (recordingStatus === 'starting' || recordingStatus === 'processing') {
      return;
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
    setParticipants(prev => prev.map(p =>
      (p.id === clientParticipantId || p.id === initialCurrentUser.id || (!!initialCurrentUser.userId && p.userId === initialCurrentUser.userId) || (!!webrtcClient.current?.participantId && p.id === webrtcClient.current.participantId))
        ? { ...p, isHandRaised: newState }
        : p
    ));
  }, [isHandRaised, clientParticipantId, initialCurrentUser.id, initialCurrentUser.userId]);

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

  const handleSetCaptionLanguage = useCallback((lang: string) => {
    setCaptionLanguage(lang);
    if (lang && lang !== 'en' && lang !== 'en-US' && lang !== 'original') {
      webrtcClient.current?.setCaptionLanguage(lang);
    }
  }, []);

  const handleSetTranslationLanguage = useCallback((lang: string) => {
    setTranslationLanguage(lang);
    if (lang && lang !== 'en' && lang !== 'en-US' && lang !== 'original') {
      webrtcClient.current?.setCaptionLanguage(lang);
    }
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

  const setScreenSharePolicy = useCallback((mode: 'EVERYONE' | 'HOSTS_ONLY' | 'SELECTED', stopExistingShares: boolean) => {
    webrtcClient.current?.setScreenSharePolicy(mode, stopExistingShares);
  }, []);

  const setParticipantScreenSharePermission = useCallback((targetParticipantId: string, permission: 'DEFAULT' | 'ALLOW' | 'BLOCK') => {
    const target = participants.find(p => p.id === targetParticipantId || p.userId === targetParticipantId);
    setParticipantScreenSharePermissions(prev => {
      const next = { ...prev, [targetParticipantId]: permission };
      if (target?.userId) next[target.userId] = permission;
      if (target?.id) next[target.id] = permission;
      return next;
    });
    webrtcClient.current?.setParticipantScreenSharePermission(targetParticipantId, permission);
  }, [participants]);

  const stopParticipantScreenShare = useCallback((targetParticipantId: string) => {
    webrtcClient.current?.stopParticipantScreenShare(targetParticipantId);
  }, []);

  const stopAllParticipantScreenShares = useCallback(() => {
    webrtcClient.current?.stopAllParticipantScreenShares();
  }, []);

  const changeUserRole = useCallback((userId: string, newRole: string) => {
    webrtcClient.current?.sendChangeRole(userId, newRole);
    setParticipants(prev => prev.map(p => 
      (p.id === userId || p.userId === userId) ? { ...p, role: newRole as any } : p
    ));
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
    webrtcClient.current?.updateRoomSettings(settings);
    // Optimistic update
    setRoomSettings(prev => ({ ...prev, ...settings }));
    if (settings.bypassWaitingRoom !== undefined) {
      setMeetingInfo(prev => ({ ...prev, isWaitingRoomEnabled: !settings.bypassWaitingRoom }));
    }
  }, []);

  const endMeetingForAll = useCallback(() => {
    hasLeftMeetingRef.current = true;
    webrtcClient.current?.sendEndMeeting();
    webrtcClient.current?.disconnect();
  }, []);

  const leaveMeeting = useCallback(() => {
    hasLeftMeetingRef.current = true;
    try {
      webrtcClient.current?.sendLeaveMeeting();
    } catch (e) {
      console.warn("Failed to send leave_meeting", e);
    }
    setTimeout(() => {
      webrtcClient.current?.disconnect();
    }, 50);
  }, []);

  const broadcastECinema = useCallback((link: string | null) => {
    setECinemaLink(link); // Optimistic local update
    webrtcClient.current?.sendECinemaUpdate(link);
  }, []);

  const pingParticipant = useCallback((targetUserId: string) => {
    webrtcClient.current?.pingParticipant(targetUserId);
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
        screenSharePolicyMode,
        participantScreenSharePermissions,
        effectiveScreenSharePermission,
        isRecording,
        recordingStatus,
        isHandRaised,
        showLeaveDialog,
        showReactionPicker,
        showDonationModal,
        meetingDuration,
        userDuration,
        meetingStartedAt,
        clientParticipantId,
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
        setCaptionLanguage: handleSetCaptionLanguage,
        setTranslationLanguage: handleSetTranslationLanguage,
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
        setScreenSharePolicy,
        setParticipantScreenSharePermission,
        stopParticipantScreenShare,
        stopAllParticipantScreenShares,
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
        retryConnection,
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
        isWidescreenEnabled,
        setIsWidescreenEnabled: updateWidescreen,
        isMirrorVideoEnabled,
        setIsMirrorVideoEnabled: updateMirrorVideo,
        isOriginalRatioEnabled,
        setIsOriginalRatioEnabled: updateOriginalRatio,
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
        logoutUrl,
        pauseRemoteVideo,
        resumeRemoteVideo,
        micError,
        setMicError,
        camError,
        setCamError,
        webrtcClientRef: webrtcClient,
        isRecorderMode,
        playNotificationSound,
        pingParticipant,
      }}
    >
      <GlobalAudioRenderer 
        participants={participants} 
        currentUserId={currentUser.id} 
        outputVolume={outputVolume} 
        setAudioPlaybackError={setAudioPlaybackError}
        isLocalIdentifier={isLocalIdentifier}
        isLocalCapture={isLocalCapture}
      />
      {children}
    </MeetingContext.Provider>
  );
}

interface AudioSlot {
  participantId: string | null;
  lastActive: number;
}

const MAX_AUDIO_SLOTS = process.env.NEXT_PUBLIC_MAX_AUDIO_SLOTS ? parseInt(process.env.NEXT_PUBLIC_MAX_AUDIO_SLOTS, 10) : 8;

function GlobalAudioRenderer({ 
  participants, 
  currentUserId, 
  outputVolume, 
  setAudioPlaybackError,
  isLocalIdentifier,
  isLocalCapture
}: { 
  participants: Participant[]; 
  currentUserId: string; 
  outputVolume: number; 
  setAudioPlaybackError: (val: boolean) => void;
  isLocalIdentifier?: (id?: string | null) => boolean;
  isLocalCapture?: (track?: MediaStreamTrack | null) => boolean;
}) {
  const { selectedDevices, meetingInfo } = useMeeting();
  
  const isLocal = useCallback((p: Participant) => {
    return (
      p.id === currentUserId || 
      p.userId === currentUserId || 
      (isLocalIdentifier ? isLocalIdentifier(p.id) || (!!p.userId && isLocalIdentifier(p.userId)) : false)
    );
  }, [currentUserId, isLocalIdentifier]);

  const audioParticipants = useMemo(() => {
    if (meetingInfo?.roomType === 'webinar') {
      return participants.filter(p => p.role === 'host' || p.role === 'co-host' || p.role === 'presenter');
    }
    return participants;
  }, [participants, meetingInfo?.roomType]);

  const [slots, setSlots] = useState<AudioSlot[]>(
    Array(MAX_AUDIO_SLOTS).fill(null).map(() => ({ participantId: null, lastActive: 0 }))
  );

  const [blockedAudioSlots, setBlockedAudioSlots] = useState<Map<string, boolean>>(new Map());

  const handlePlaybackErrorChange = useCallback((key: string, hasError: boolean) => {
    setBlockedAudioSlots(prev => {
      const next = new Map(prev);
      if (hasError) {
        next.set(key, true);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setAudioPlaybackError(blockedAudioSlots.size > 0);
  }, [blockedAudioSlots, setAudioPlaybackError]);

  useEffect(() => {
    setSlots(prevSlots => {
      let newSlots = [...prevSlots];
      const now = Date.now();
      let changed = false;

      const currentParticipantIds = new Set(audioParticipants.filter(p => p.audioTrack && !isLocal(p)).map(p => p.id));
      
      // 1. Remove participants that left the room or don't have an audioTrack anymore
      for (let i = 0; i < MAX_AUDIO_SLOTS; i++) {
        if (newSlots[i].participantId && !currentParticipantIds.has(newSlots[i].participantId!)) {
          newSlots[i] = { participantId: null, lastActive: 0 };
          changed = true;
        }
      }

      // 2. Update lastActive for anyone currently speaking
      const speakingIds = new Set(audioParticipants.filter(p => p.audioTrack && !isLocal(p) && p.isSpeaking).map(p => p.id));
      for (let i = 0; i < MAX_AUDIO_SLOTS; i++) {
        if (newSlots[i].participantId && speakingIds.has(newSlots[i].participantId!)) {
          if (newSlots[i].lastActive !== now) {
             newSlots[i] = { ...newSlots[i], lastActive: now };
             changed = true;
          }
        }
      }

      // 3. Assign tracks to empty slots or evict oldest silent participant
      const allAudioParticipants = audioParticipants.filter(p => p.audioTrack && !isLocal(p));
      
      // Sort candidates: Speakers first, then Hosts/Presenters, then others
      const candidates = [...allAudioParticipants].sort((a, b) => {
         if (a.isSpeaking && !b.isSpeaking) return -1;
         if (!a.isSpeaking && b.isSpeaking) return 1;
         
         const aIsHost = a.role === 'host' || a.role === 'co-host' || a.role === 'presenter';
         const bIsHost = b.role === 'host' || b.role === 'co-host' || b.role === 'presenter';
         if (aIsHost && !bIsHost) return -1;
         if (!aIsHost && bIsHost) return 1;
         return 0;
      });

      for (const p of candidates) {
        // Is p already in a slot?
        if (newSlots.some(s => s.participantId === p.id)) {
           continue; 
        }

        // Try to find an empty slot
        const emptySlotIndex = newSlots.findIndex(s => s.participantId === null);
        if (emptySlotIndex !== -1) {
           newSlots[emptySlotIndex] = { participantId: p.id, lastActive: p.isSpeaking ? now : 0 };
           changed = true;
           continue;
        }

        // No empty slots. If p is NOT speaking, we don't force an eviction.
        if (!p.isSpeaking) continue;

        // p IS speaking, we must evict someone! Find the slot with the lowest "warmth" weight.
        let victimIndex = -1;
        let lowestWeight = Infinity;
        
        for (let i = 0; i < MAX_AUDIO_SLOTS; i++) {
          const slot = newSlots[i];
          const slotParticipant = allAudioParticipants.find(ap => ap.id === slot.participantId);
          
          let weight = slot.lastActive; 
          
          if (slotParticipant && (slotParticipant.role === 'host' || slotParticipant.role === 'co-host' || slotParticipant.role === 'presenter')) {
             weight += 10000000; // High immunity for VIPs
          }
          if (slotParticipant?.isSpeaking) {
             weight += 50000000; // Almost impossible to evict an active speaker
          }
          
          if (weight < lowestWeight) {
             lowestWeight = weight;
             victimIndex = i;
          }
        }

        // Only evict if the victim is not currently speaking (or if we strictly must, which means all 8 are speaking)
        if (victimIndex !== -1) {
           newSlots[victimIndex] = { participantId: p.id, lastActive: now };
           changed = true;
        }
      }

      return changed ? newSlots : prevSlots;
    });
  }, [audioParticipants, isLocal]);

  return (
    <>
      {/* Render the 8 fixed warm pool slots */}
      {slots.map((slot, index) => {
        const participant = slot.participantId ? audioParticipants.find(p => p.id === slot.participantId) : null;
        const participantIsLocal = !participant || isLocal(participant);
        return (
          <AudioRenderer 
            key={`pool-slot-${index}`}
            slotId={`pool-slot-${index}`}
            track={participant?.audioTrack} 
            isLocal={participantIsLocal} 
            audioOutput={selectedDevices.audioOutput} 
            outputVolume={outputVolume} 
            setAudioPlaybackError={setAudioPlaybackError}
            isLocalCapture={isLocalCapture}
            onPlaybackErrorChange={handlePlaybackErrorChange}
          />
        );
      })}
      
      {/* Screen share audio is rendered separately as there's usually only 1 */}
      {audioParticipants.filter(p => p.screenAudioTrack && !isLocal(p)).map(p => (
        <AudioRenderer 
          key={`screen-audio-${p.id}`} 
          slotId={`screen-audio-${p.id}`}
          track={p.screenAudioTrack} 
          isLocal={false} 
          audioOutput={selectedDevices.audioOutput} 
          outputVolume={outputVolume} 
          setAudioPlaybackError={setAudioPlaybackError}
          isLocalCapture={isLocalCapture}
          onPlaybackErrorChange={handlePlaybackErrorChange}
        />
      ))}
    </>
  );
}

export function AudioRenderer({ 
  track, 
  isLocal, 
  slotId,
  audioOutput, 
  outputVolume, 
  setAudioPlaybackError,
  isLocalCapture,
  onPlaybackErrorChange
}: { 
  track?: MediaStreamTrack | null; 
  isLocal: boolean; 
  slotId?: string;
  audioOutput: string; 
  outputVolume: number; 
  setAudioPlaybackError: (val: boolean) => void;
  isLocalCapture?: (track?: MediaStreamTrack | null) => boolean;
  onPlaybackErrorChange?: (key: string, hasError: boolean) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assignmentGenRef = useRef<number>(0);

  const applyAudioSink = async (el: HTMLAudioElement, sinkId: string) => {
    if (sinkId && typeof (el as any).setSinkId === "function") {
      try {
        await (el as any).setSinkId(sinkId);
      } catch (e) {
        console.warn("Failed to set audio output device, falling back to default:", e);
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
    if (audioRef.current) {
      applyAudioSink(audioRef.current, audioOutput);
    }
  }, [audioOutput]);

  const isLocalTrack = isLocal || (track ? (isLocalCapture ? isLocalCapture(track) : false) : false);

  useEffect(() => {
    assignmentGenRef.current += 1;
    const currentGen = assignmentGenRef.current;
    const errorKey = `${track?.id || 'none'}:${slotId || 'default'}:${currentGen}`;

    if (isLocalTrack || !track) {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current.muted = true;
      }
      onPlaybackErrorChange?.(errorKey, false);
      return;
    }

    if (audioRef.current && track && !isLocalTrack) {
      // Reconcile mute state: explicitly restore unmuted state for verified remote track (R3)
      audioRef.current.muted = (outputVolume === 0);
      audioRef.current.volume = outputVolume / 100;

      if (audioRef.current.srcObject) {
        const stream = audioRef.current.srcObject as MediaStream;
        if (stream.getAudioTracks()[0] !== track) {
          stream.getAudioTracks().forEach(t => stream.removeTrack(t));
          stream.addTrack(track);
        }
      } else {
        audioRef.current.srcObject = new MediaStream([track]);
      }
      
      const attemptPlay = () => {
        if (!audioRef.current || !track || isLocalTrack || assignmentGenRef.current !== currentGen) return;
        audioRef.current.play().then(() => {
          if (assignmentGenRef.current === currentGen) {
            setAudioPlaybackError(false);
            onPlaybackErrorChange?.(errorKey, false);
          }
        }).catch((e) => {
          if (assignmentGenRef.current !== currentGen) return;
          if (e.name === 'NotAllowedError') {
            console.warn("Autoplay blocked for global audio:", e);
            setTimeout(() => {
              if (assignmentGenRef.current !== currentGen) return;
              const anyPlaying = Array.from(document.querySelectorAll('audio[data-participant-audio="true"]'))
                .some(a => !(a as HTMLAudioElement).paused);
              
              if (!anyPlaying) {
                setAudioPlaybackError(true);
                onPlaybackErrorChange?.(errorKey, true);
              } else {
                setAudioPlaybackError(false);
                onPlaybackErrorChange?.(errorKey, false);
              }
            }, 300);
          } else if (e.name !== 'AbortError') {
            console.warn("Global audio play failed:", e);
          }
        });
      };

      attemptPlay();

      const onPause = () => {
        if (audioRef.current && track && !isLocalTrack && audioRef.current.srcObject) {
          console.log("Audio paused unexpectedly, attempting to resume...");
          attemptPlay();
        }
      };

      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && audioRef.current && track && !isLocalTrack) {
          console.log("App returned to foreground, resuming audio...");
          attemptPlay();
        }
      };

      const audioEl = audioRef.current;
      audioEl.addEventListener('pause', onPause);
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('pageshow', handleVisibility);

      return () => {
        if (audioEl) audioEl.removeEventListener('pause', onPause);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pageshow', handleVisibility);
        onPlaybackErrorChange?.(errorKey, false);
      };
    }
  }, [track, isLocalTrack, outputVolume, audioOutput, isLocalCapture, onPlaybackErrorChange, setAudioPlaybackError, slotId]);

  return <audio data-participant-audio="true" ref={audioRef} autoPlay playsInline muted={isLocalTrack || outputVolume === 0} style={{ display: 'none' }} />;
}
