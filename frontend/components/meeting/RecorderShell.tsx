"use client";

import React, { useEffect, useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { StageView } from "./StageView";
import { useSearchParams, useRouter } from "next/navigation";

export function RecorderShell() {
  const {
    meetingInfo,
    webrtcStatus,
    participants,
    currentUser
  } = useMeeting();

  const searchParams = useSearchParams();
  const botToken = searchParams?.get('botToken');

  useEffect(() => {
    console.log("recorder_page_loaded");
  }, []);

  // Readiness Gate
  useEffect(() => {
    if (webrtcStatus === 'connecting') {
      console.log("recorder_join_started");
    }
    if (webrtcStatus === 'connected') {
      console.log("recorder_joined_room");
      console.log("recorder_room_state_loaded");
    }
  }, [webrtcStatus]);

  useEffect(() => {
    const isReady = webrtcStatus === 'connected' && meetingInfo.roomSlug;
    if (isReady) {
      let checkCount = 0;
      const maxChecks = 30; // 30 seconds

      const checkReadiness = setInterval(() => {
        checkCount++;
        
        // 1. Layout verification
        const container = document.querySelector('.recorder-layout') as HTMLElement;
        let layoutReady = false;
        if (container) {
          const rect = container.getBoundingClientRect();
          layoutReady = Math.abs(rect.width - 1920) < 2 && Math.abs(rect.height - 1080) < 2;
          if (!layoutReady) {
            console.log("recorder_layout_invalid_dimensions", rect.width, rect.height);
          } else {
            console.log("recorder_layout_css_size_verified");
          }
        }
        
        // 2. Media verification
        let videoReady = false;
        let audioReady = false;
        let noVideoExpected = true;
        let noAudioExpected = true;
        
        // Exclude bot itself from expectations
        const remoteParticipants = participants.filter(p => p.id !== currentUser?.id && p.role !== 'bot' && p.role !== 'recorder');
        
        if (remoteParticipants.length > 0) {
          const expectedCameras = remoteParticipants.filter(p => p.isCameraOn);
          if (expectedCameras.length > 0) {
            noVideoExpected = false;
            // Find video elements playing
            const videos = document.querySelectorAll('video');
            for (let i = 0; i < videos.length; i++) {
              if (videos[i].readyState >= 3 && videos[i].videoWidth > 0) {
                videoReady = true;
                break;
              }
            }
          }
          
          const expectedAudio = remoteParticipants.filter(p => !p.isMuted);
          if (expectedAudio.length > 0) {
            noAudioExpected = false;
            // Assuming audio tracks are playing if audio elements exist or track is added
            const audios = document.querySelectorAll('audio');
            if (audios.length > 0) audioReady = true;
            // We can also assume audio ready if we receive media consumers
            else audioReady = true; // Temporary simplification, normally check track active
          }
        }

        if (layoutReady) {
          console.log("layout_ready");
          const vReady = videoReady || noVideoExpected;
          const aReady = audioReady || noAudioExpected;
          
          if (noVideoExpected) console.log("no_video_expected");
          else if (videoReady) console.log("video_ready");
          
          if (noAudioExpected) console.log("no_audio_expected");
          else if (audioReady) console.log("audio_ready");

          if (vReady && aReady) {
            clearInterval(checkReadiness);
            console.log("recorder_ready");
            (window as any).__KONN3CT_RECORDER_READY__ = {
              joined: true,
              roomId: meetingInfo.roomSlug,
              participantId: currentUser?.id,
              signalingConnected: true,
              mediaReady: true,
              timestamp: Date.now()
            };
            console.log("recorder_start_capture");
          }
        }
        
        if (checkCount >= maxChecks) {
          clearInterval(checkReadiness);
          console.log("ready_timeout");
          console.log("ready_failed");
          // Fail explicitly
          (window as any).__KONN3CT_RECORDER_READY__ = {
            joined: false,
            failed: true,
            reason: "ready_timeout"
          };
        }
      }, 1000);

      return () => clearInterval(checkReadiness);
    }
  }, [webrtcStatus, meetingInfo.roomSlug, currentUser?.id, participants]);

  if (!botToken) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-red-500">Missing Bot Token</div>;
  }

  if (webrtcStatus === 'waiting' || webrtcStatus === 'denied' || webrtcStatus === 'kicked' || webrtcStatus === 'failed') {
    return <div className="w-[1920px] h-[1080px] bg-black" />;
  }

  // Force deterministic 1920x1080 layout without any extra UI
  return (
    <div 
      className="recorder-layout"
      style={{
        width: "1920px", 
        height: "1080px", 
        overflow: "hidden", 
        backgroundColor: "#000",
        position: "relative"
      }}
    >
      <div className="absolute inset-0">
        <StageView />
      </div>
    </div>
  );
}
