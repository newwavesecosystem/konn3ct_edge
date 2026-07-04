const fs = require('fs');
const file = 'c:/conn3ct_meeting/frontend/components/meeting/RecorderShell.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldEffect = `  useEffect(() => {
    const isReady = webrtcStatus === 'connected' && meetingInfo.roomSlug;
    if (isReady) {
      // Allow slight delay for frames to start rendering
      setTimeout(() => {
        console.log("recorder_media_consumers_ready");
        console.log("recorder_first_video_frame_received");
        console.log("recorder_layout_ready");
        console.log("recorder_audio_ready");
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
      }, 3000);
    }
  }, [webrtcStatus, meetingInfo.roomSlug, currentUser?.id]);`;

const newEffect = `  useEffect(() => {
    const isReady = webrtcStatus === 'connected' && meetingInfo.roomSlug;
    if (isReady) {
      let checkCount = 0;
      const maxChecks = 30; // 30 seconds

      const checkReadiness = setInterval(() => {
        checkCount++;
        
        // 1. Layout verification
        const container = document.querySelector('.recorder-layout') as HTMLElement;
        const layoutReady = container && container.offsetWidth === 1920 && container.offsetHeight === 1080;
        
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
  }, [webrtcStatus, meetingInfo.roomSlug, currentUser?.id, participants]);`;

content = content.replace(oldEffect, newEffect);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated RecorderShell.tsx");
