"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type {
  Participant,
  ChatMessage,
  Poll,
  MeetingInfo,
  DocNote,
  Reaction,
  SidePanel,
  LayoutMode,
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
  currentUser: Participant;
  chatMessages: ChatMessage[];
  polls: Poll[];
  docs: DocNote[];
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

  // Actions
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleRecording: () => void;
  toggleHandRaise: () => void;
  setActivePanel: (panel: SidePanel) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  sendMessage: (content: string) => void;
  sendReaction: (emoji: string) => void;
  votePoll: (pollId: string, optionId: string) => void;
  createPoll: (question: string, options: string[]) => void;
  setShowLeaveDialog: (show: boolean) => void;
  setShowReactionPicker: (show: boolean) => void;
  setIsMobilePanelOpen: (open: boolean) => void;
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [polls, setPolls] = useState<Poll[]>(mockPolls);
  const [docs] = useState<DocNote[]>(mockDocs);
  const formattedTitle = roomSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const [meetingInfo] = useState<MeetingInfo>({
    ...mockMeetingInfo,
    title: formattedTitle,
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
  
  // ── WebRTC Instance ──────────────────────────────────
  const webrtcClient = useRef<WebRTCClient | null>(null);
  const localCameraTrackRef = useRef<MediaStreamTrack | null>(null);

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
            email: "guest@conn3ct.com" 
          })
        });

        const data = await res.json();
        
        if (!data.token) {
          throw new Error("Failed to get connection token");
        }

        client = new WebRTCClient(roomSlug, data.token);
        
        // --- Collaboration Event Listeners ---
        client.onChatMessage = (msg) => {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `m-${Date.now()}-${Math.random()}`,
              senderId: msg.userId,
              senderName: `Participant ${msg.userId.substring(5, 9)}`,
              senderRole: "attendee",
              content: msg.message,
              timestamp: msg.timestamp,
            },
          ]);
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

        client.onConnectionStateChange = (state) => {
          if (webrtcClient.current === client) {
            setWebrtcStatus(state);
          }
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

      // Handle Remote Streams
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

  // ── Actions ──────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (isMuted) webrtcClient.current?.resumeMic();
    else webrtcClient.current?.pauseMic();
    setIsMuted((v) => !v);
  }, [isMuted]);

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
  const toggleHandRaise = useCallback(() => setIsHandRaised((v) => !v), []);

  const sendMessage = useCallback(
    (content: string) => {
      webrtcClient.current?.sendChatMessage(content);
      const msg: ChatMessage = {
        id: `m-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        content,
        timestamp: new Date().toISOString(),
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
    const options = optionsText.map((t, i) => ({ id: `o${i+1}`, text: t, votes: 0 }));
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

  const handleSetActivePanel = useCallback(
    (panel: SidePanel) => {
      setActivePanel((prev) => (prev === panel ? null : panel));
      if (panel !== null) {
        setIsMobilePanelOpen(true);
      }
    },
    []
  );

  return (
    <MeetingContext.Provider
      value={{
        participants,
        currentUser,
        chatMessages,
        polls,
        docs,
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
        setShowLeaveDialog,
        setShowReactionPicker,
        setIsMobilePanelOpen,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
}
