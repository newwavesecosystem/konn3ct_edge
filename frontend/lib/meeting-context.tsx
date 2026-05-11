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
  setECinemaLink: (link: string | null) => void;
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
    isCameraOn: true,
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
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState("disconnected");
  const [eCinemaLink, setECinemaLink] = useState<string | null>(null);

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

        // --- Collaboration Event Listeners ---
        client.onServerLoadHigh = () => {
          toast.warning("Server is under heavy load. Optimizing video feeds to maintain stability...");
          // Method 2: Graceful Quality Degradation (The "Zoom" approach)
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
          }
        };

        client.onServerReject = (msg) => {
          toast.error(msg);
          // Method 3: Hard limit on active cameras - revert the UI if blocked
          if (client) {
            client.pauseCamera();
            setIsCameraOn(false);
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
          setChatMessages((prev) => {
            // Prevent duplicates if same ID arrives
            if (msg.id && prev.some(m => m.id === msg.id)) return prev;

            return [
              ...prev,
              {
                id: msg.id || `m-${Date.now()}-${Math.random()}`,
                senderId: msg.userId,
                senderName: msg.userId === currentUser.id ? currentUser.name : participants.find(p => p.id === msg.userId)?.name || `Participant ${msg.userId.substring(5, 9)}`,
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
            senderName: `Participant ${msg.userId.substring(5, 9)}`,
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

        client.onHandRaise = (msg) => {
          setParticipants((prev) => prev.map(p =>
            p.id === msg.userId ? { ...p, isHandRaised: msg.isHandRaised } : p
          ));
        };

        client.onWaitingRoomRequest = (msg) => {
          console.log("🔥 Received waiting room request from server:", msg);
          setWaitingUsers(prev => {
            if (prev.find(u => u.userId === msg.userId)) return prev;
            toast(`${msg.name} is waiting to join`, {
              action: {
                label: 'Admit',
                onClick: () => webrtcClient.current?.admitUser(msg.userId)
              }
            });
            return [...prev, { userId: msg.userId, name: msg.name }];
          });
        };

        client.onConnectionStateChange = (state) => {
          if (webrtcClient.current === client) {
            setWebrtcStatus(state);
          }
        };

        // --- Participant Management Callbacks ---
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
                });
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
            }];
          });
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

        // Bind onNewConsumer BEFORE connect() to prevent missing initial producers
        client.onNewConsumer = (consumer, userId) => {
          setParticipants((prev) => {
            const exists = prev.find((p) => p.id === userId);
            if (exists) {
              return prev.map((p) => {
                if (p.id === userId) {
                  if (consumer.kind === "video") {
                    return { ...p, videoTrack: consumer.track as MediaStreamTrack, isCameraOn: true };
                  }
                  if (consumer.kind === "audio") {
                    return { ...p, audioTrack: consumer.track as MediaStreamTrack, isMuted: false };
                  }
                }
                return p;
              });
            } else {
              // Add new participant dynamically!
              const newParticipant: Participant = {
                id: userId,
                name: `Participant ${userId.substring(5, 9)}`,
                role: "attendee",
                isMuted: consumer.kind !== "audio",
                isCameraOn: consumer.kind === "video",
                isScreenSharing: false,
                isHandRaised: false,
                isSpeaking: false,
                joinedAt: new Date().toISOString(),
              };
              if (consumer.kind === "video") newParticipant.videoTrack = consumer.track as MediaStreamTrack;
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
          const videoTrack = await client.enableCamera();
          localCameraTrackRef.current = videoTrack;
          const audioTrack = await client.enableMic();
          localAudioTrackRef.current = audioTrack;

          setParticipants((prev) =>
            prev.map((p) => {
              if (p.id === currentUser.id) {
                return { ...p, videoTrack, audioTrack, isCameraOn: true, isMuted: false };
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

      // If volume is above threshold while muted
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
    if (isCameraOn) webrtcClient.current?.pauseCamera();
    else webrtcClient.current?.resumeCamera();
    setIsCameraOn((v) => !v);
  }, [isCameraOn]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        const newTrack = await webrtcClient.current?.disableScreenShare(localCameraTrackRef.current || undefined);
        if (newTrack) localCameraTrackRef.current = newTrack;
        setIsScreenSharing(false);
      } else {
        const screenTrack = await webrtcClient.current?.enableScreenShare();
        if (screenTrack) {
          setIsScreenSharing(true);
          // Listen for native "Stop sharing" button built into browsers
          screenTrack.onended = async () => {
            const newTrack = await webrtcClient.current?.disableScreenShare(localCameraTrackRef.current || undefined);
            if (newTrack) localCameraTrackRef.current = newTrack;
            setIsScreenSharing(false);
          };
        }
      }
    } catch (e) {
      console.error("Screen share error:", e);
    }
  }, [isScreenSharing]);

  const toggleRecording = useCallback(() => setIsRecording((v) => !v), []);
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
    webrtcClient.current?.admitUser(userId);
    setWaitingUsers(prev => prev.filter(u => u.userId !== userId));
  }, []);

  const denyUser = useCallback((userId: string) => {
    webrtcClient.current?.denyUser(userId);
    setWaitingUsers(prev => prev.filter(u => u.userId !== userId));
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
        eCinemaLink,
        setECinemaLink,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
}
