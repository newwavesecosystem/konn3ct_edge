import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert, Platform, NativeModules, DeviceEventEmitter, Modal, TouchableWithoutFeedback, BackHandler } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import type { MediaStream } from 'react-native-webrtc';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediasoupService, RemoteParticipant } from '../webrtc/MediasoupService';
import { consumeActiveMeetingService } from '../webrtc/activeMeetingService';

let RTCView: any = View;
let mediaDevices: any = null;
let InCallManager: any = { start: () => {}, stop: () => {}, setKeepScreenOn: () => {}, setForceSpeakerphoneOn: () => {} };
if (Platform.OS !== 'web') {
  const webrtc = require('react-native-webrtc');
  RTCView = webrtc.RTCView;
  mediaDevices = webrtc.mediaDevices;
  InCallManager = require('react-native-incall-manager').default;
}

import * as Clipboard from 'expo-clipboard';
import { useMeetingStore } from '../store/useMeetingStore';
import { Settings, Users, MessageSquare, Hand, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Phone, Radio, BarChart2, Disc, Square, UserPlus, Presentation, FileText, Gift, Copy, MoreVertical, SwitchCamera, Sun, Moon, Lock } from 'lucide-react-native';
import { useAuthStore } from '../store/useAuthStore';
import PipService from '../native/KonnPip';
import { LinearGradient } from 'expo-linear-gradient';
import { meetingThemeTokens } from '../theme/meetingTheme';
// Components
import { ChatPanel } from '../components/meeting/ChatPanel';
import { ParticipantsPanel } from '../components/meeting/ParticipantsPanel';
import { PollsPanel } from '../components/meeting/PollsPanel';
import { SettingsPanel } from '../components/meeting/SettingsPanel';
import { StreamingPanel } from '../components/meeting/StreamingPanel';
import { WhiteboardPanel } from '../components/meeting/WhiteboardPanel';
import { DocsPanel } from '../components/meeting/DocsPanel';
import { DonationPanel } from '../components/meeting/DonationPanel';
import { ReactionsLayer } from '../components/meeting/ReactionsLayer';
import { CaptionsOverlay } from '../components/meeting/CaptionsOverlay';
import { APP_CONFIG } from '../config/appConfig';
import { useNetworkQuality } from '../hooks/useNetworkQuality';

type Props = NativeStackScreenProps<RootStackParamList, 'Meeting'>;

export default function MeetingScreen({ route, navigation }: Props) {
  const { roomId, meetingToken, micOn, cameraOn } = route.params;
  const initialMicOn = micOn ?? true;
  const initialCameraOn = cameraOn ?? true;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(!initialMicOn);
  const [isCameraOff, setIsCameraOff] = useState(!initialCameraOn);
  const [cameraKey, setCameraKey] = useState(0); // bumped on every toggle to force RTCView remount
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPipMode, setIsPipMode] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  const insets = useSafeAreaInsets();
  const serviceRef = useRef<MediasoupService | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null); // Fix 10: ref for cleanup
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Zustand Store
  const { activePane, setActivePane, unreadChatCount, reset, currentUserRole, isHost, participants, waitingRoom, isHandRaisedLocally, setIsHandRaisedLocally, theme, setTheme } = useMeetingStore();
  const currentUserId = useMeetingStore(state => state.currentUserId);
  const isLocalUserSpeaking = useMeetingStore(state => state.isLocalUserSpeaking);
  const user = useAuthStore((s) => s.user);
  const localUserName = user?.name || 'Me';
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);
  
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;
  const safeTop = insets.top > 0 ? insets.top + 8 : 16;

  const activeScreenShare = remoteStreams.find(p => p.screenStream != null);

  // Fix 13: Network quality monitoring
  const { quality: networkQuality } = useNetworkQuality({
    service: serviceRef.current,
    isConnected,
    onQualityBad: () => {
      Alert.alert('Poor Connection', 'Your network connection is unstable. Video quality may be reduced.');
    },
    onQualityGood: () => {
      // Silently recover — no need to alert on good connection
      console.log('Network quality recovered to good');
    },
  });

  const handleAdmitUser = (userId: string) => {
    if (serviceRef.current) serviceRef.current.admitUser(userId);
  };

  const handleDenyUser = (userId: string) => {
    if (serviceRef.current) serviceRef.current.denyUser(userId);
  };

  useEffect(() => {
    let isMounted = true;
    reset(); // Reset global store when joining
    
    // Setup PiP Listener for Android
    let pipListener: any = null;
    if (PipService.isAvailable()) {
      // Tell native side a meeting is active — enables auto-PiP on Home press
      PipService.setMeetingActive(true);
      pipListener = PipService.onModeChanged((isInPip: boolean) => {
        if (isMounted) {
          setIsPipMode(isInPip);
          // Close any open overlay when entering PiP
          if (isInPip) {
            setIsMoreMenuVisible(false);
            setActivePane('none');
          }
        }
      });
    }

    // Default to Speakerphone
    InCallManager.start({ media: 'video' });
    InCallManager.setForceSpeakerphoneOn(true);

    async function init() {
      try {
        // We no longer aggressively grab the camera/mic on load!
        // We initialize with an empty MediaStream to bind the RTCView.
        const emptyStream = new MediaStream();
        if (isMounted) {
          setLocalStream(emptyStream);
          localStreamRef.current = emptyStream;
        }

        // ── Reuse pre-connected service from LobbyScreen if available ────────
        // When a user is admitted from the lobby, LobbyScreen stores the live
        // service via setActiveMeetingService() before navigating here.
        // Consuming it skips the WebSocket reconnect entirely.
        const handedOffService = consumeActiveMeetingService();
        const service = handedOffService ?? new MediasoupService(roomId);
        serviceRef.current = service;
        
        // Setup Media Callbacks
        service.onStreamUpdate((participants) => {
          if (isMounted) setRemoteStreams(participants);
        });

        service.onSessionStatusChange = async (status) => {
          if (!isMounted) return;
          const navigateAfterLeave = () => {
            const isGuest = !useAuthStore.getState().token;
            if (isGuest) {
              navigation.reset({ index: 0, routes: [{ name: 'GuestJoin' as any }] });
            } else {
              navigation.replace('MainTabs');
            }
          };
          if (status === 'active') {
            setIsConnected(true);
            // Re-enable existing hardware tracks on reconnect
            if (localStreamRef.current && serviceRef.current) {
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              const audioTrack = localStreamRef.current.getAudioTracks()[0];
              if (videoTrack && videoTrack.enabled) serviceRef.current.enableCamera(videoTrack);
              if (audioTrack && audioTrack.enabled) serviceRef.current.enableMic(audioTrack);
            }
          } else if (status === 'ended') {
            Alert.alert(
              'Meeting Ended',
              'The host has ended this meeting for everyone.',
              [{ text: 'OK', onPress: navigateAfterLeave }]
            );
          } else if (status === 'kicked') {
            Alert.alert(
              'Removed from Meeting',
              'You have been removed from the meeting by the host.',
              [{ text: 'OK', onPress: navigateAfterLeave }]
            );
          } else if (status === 'denied') {
            Alert.alert(
              'Entry Denied',
              'Your request to join was denied by the host.',
              [{ text: 'OK', onPress: navigateAfterLeave }]
            );
          }
        };

        // Fix 11: Reconnection UI callbacks
        service.onReconnecting = (attempt) => {
          if (isMounted) {
            setIsReconnecting(true);
            setReconnectAttempt(attempt);
          }
        };
        service.onReconnected = () => {
          if (isMounted) {
            setIsReconnecting(false);
            setReconnectAttempt(0);
          }
        };
        service.onReconnectFailed = () => {
          if (isMounted) {
            setIsReconnecting(false);
            Alert.alert(
              'Connection Lost',
              'Unable to reconnect to the meeting. Please rejoin.',
              [{ text: 'OK', onPress: () => navigation.replace('MainTabs') }]
            );
          }
        };

        // Setup Collaboration Callbacks
        service.onChatMessage = (msg) => {
          const state = useMeetingStore.getState();
          if (msg.userId === state.currentUserId) return;
          state.addChatMessage({
            id: msg.serverEventId || msg.id || `m-${Date.now()}`,
            userId: msg.userId,
            name: msg.name || msg.senderName || 'Someone',
            message: msg.message || msg.content || '',
            timestamp: msg.timestamp || new Date().toISOString(),
            isPrivate: !!msg.isPrivate,
            fileUrl: msg.fileUrl,
          });
        };
        service.onChatHistory = (msgs) => useMeetingStore.getState().setChatHistory(msgs);
        service.onReaction = (msg) => {
          const state = useMeetingStore.getState();
          // The local client already optimistically added this reaction, ignore the server echo
          if (msg.userId === state.currentUserId) return; 

          const reactionObj = {
            id: Math.random().toString(36).substring(7),
            userId: msg.userId,
            name: msg.name || 'Participant',
            emoji: msg.reaction || msg.emoji,
            timestamp: msg.timestamp || Date.now()
          };
          state.addReaction(reactionObj);
        };
        service.onParticipantsList = (list) => {
            const mapP = (p: any) => ({
              userId: p.userId,
              participantId: p.participantId || p.userId, // session routing ID
              name: p.name,
              role: p.role,
              isMobile: p.isMobile,
              isMuted: p.isMuted,
              isCameraOn: p.isCameraOn,
              status: p.status,
            });
            const inMeeting = list.filter((p: any) => p.status !== 'waiting').map(mapP);
            const waiting = list.filter((p: any) => p.status === 'waiting').map(mapP);
            useMeetingStore.getState().setParticipants(inMeeting);
            useMeetingStore.getState().setWaitingRoom(waiting);
          };
        service.onUserJoined = (user) => {
            useMeetingStore.getState().addParticipant({
              userId: user.userId,
              participantId: user.participantId || user.userId,
              name: user.name,
              role: user.role,
              isMobile: user.isMobile,
              isMuted: true,
              isCameraOn: false,
              status: 'active',
            });
            useMeetingStore.getState().removeWaitingRoomUser(user.userId);
          };
        service.onCaptionReceived = (userId, text, isFinal, lang) => {
          const sender = useMeetingStore.getState().participants.find((p) => p.userId === userId);
          const senderName = sender?.name || `Participant ${userId.substring(5, 9)}`;
          
          useMeetingStore.getState().setCaptions((currCaptions: any) => {
            const newCaptions = [...currCaptions];
            const lastIdx = newCaptions.findIndex(c => c.userId === userId && !c.isFinal);
            if (lastIdx >= 0) {
              newCaptions[lastIdx] = { userId, name: senderName, text, isFinal, timestamp: Date.now() };
            } else {
              newCaptions.push({ userId, name: senderName, text, isFinal, timestamp: Date.now() });
            }
            if (newCaptions.length > 4) return newCaptions.slice(newCaptions.length - 4);
            return newCaptions;
          });
        };
        service.onUserLeft = (userId) => {
          useMeetingStore.getState().removeParticipant(userId);
          useMeetingStore.getState().removeWaitingRoomUser(userId);
        };
        service.onPollCreate = (poll) => useMeetingStore.getState().addPoll({ ...poll, id: poll.pollId || poll.id, isActive: true });
        service.onPollVote = (vote) => useMeetingStore.getState().updatePollVote(vote.pollId, vote.optionId, vote.userId ? { userId: vote.userId, name: vote.name || 'Someone' } : undefined);
        service.onPollEnd = (data) => useMeetingStore.getState().endPoll(data.pollId);
        service.onPollHistory = (polls) => useMeetingStore.getState().setPolls(
          polls.map((p: any) => ({ ...p, id: p.pollId || p.id, isActive: p.isActive !== false }))
        );
        service.onWaitingRoomRequest = (user) => useMeetingStore.getState().addWaitingRoomUser(user);
        service.onForceMute = () => {
          setIsMicMuted(true);
          if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
              track.stop();
              localStreamRef.current.removeTrack(track);
            }
          }
          if (serviceRef.current) serviceRef.current.disableMic();
          Alert.alert("Muted by Host", "The host has muted your microphone.");
        };
        service.onHandRaise = (msg) => {
          if (msg.userId) {
            useMeetingStore.getState().updateParticipantHandRaise(msg.userId, msg.isHandRaised);
          }
        };
        service.onActiveSpeaker = (userIds) => {
          useMeetingStore.getState().updateParticipantSpeaking(userIds);
        };
        service.onRecordingStarted = () => {
          setIsRecording(true);
          Alert.alert("Recording Started", "The host has started cloud recording.");
        };
        service.onRecordingStopped = () => {
          setIsRecording(false);
          Alert.alert("Recording Stopped", "Cloud recording has been stopped.");
        };

        const applyInitialMedia = async () => {
          if (!localStreamRef.current || !serviceRef.current || !isMounted) return;
          
          if (initialMicOn) {
            try {
              const audioStream = await mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as any });
              const track = audioStream.getAudioTracks()[0];
              if (track) {
                localStreamRef.current.addTrack(track);
                await serviceRef.current.enableMic(track);
                setIsMicMuted(false);
              }
            } catch (err) {
              console.error('Failed to get initial mic', err);
            }
          }
      
          if (initialCameraOn) {
            try {
              const videoStream = await mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' }
              });
              const track = videoStream.getVideoTracks()[0];
              if (track) {
                localStreamRef.current.addTrack(track);
                await serviceRef.current.enableCamera(track);
                setIsCameraOff(false);
                setCameraKey(k => k + 1);
              }
            } catch (err) {
              console.error('Failed to get initial camera', err);
            }
          }
        };

        if (handedOffService) {
          // Already connected and admitted via LobbyScreen — start broadcasting immediately
          // Replay events (participants_list, chat_history, etc.) that fired
          // during the admit flow before these callbacks were registered.
          service.replayCachedEvents();
          if (isMounted) {
            await applyInitialMedia();
            setIsConnected(true);
          }
        } else {
          // Normal path: connect fresh (e.g. host starting a meeting directly)
          const initialStatus = await service.connect(meetingToken);
          if (!isMounted) return;
          
          if (initialStatus === 'active') {
            await applyInitialMedia();
            setIsConnected(true);
          }
        }

      } catch (err: any) {
        console.error("Meeting failed to initialize", err);
        if (isMounted) {
          const reason = err?.message || '';
          // The WS close reason contains HTTP status when upgrade fails
          const is404 = reason.includes('404');
          Alert.alert(
            is404 ? 'Room Not Found' : 'Connection Failed',
            is404
              ? `Could not find room "${roomId}".\n\nRoom IDs are case-sensitive — make sure the capitalisation matches exactly.`
              : 'Failed to connect to the meeting. Please check your connection and try again.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }
    }


    init();

    return () => {
      isMounted = false;
      InCallManager.stop();
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (pipListener) {
        pipListener.remove();
      }
      // Tell native side meeting is no longer active — disables auto-PiP on Home
      PipService.setMeetingActive(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      reset();
    };
  }, []);

  const leavingRef = useRef(false);

  const doLeave = useCallback(() => {
    leavingRef.current = true; // signal the beforeRemove guard to allow this navigation
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    // Guest users (no token) go back to the GuestJoin screen; logged-in users go to MainTabs
    const isGuest = !useAuthStore.getState().token;
    if (isGuest) {
      navigation.reset({ index: 0, routes: [{ name: 'GuestJoin' as any }] });
    } else {
      navigation.replace('MainTabs');
    }
  }, [navigation]);


  const handleLeave = useCallback(() => {
    if (isHost) {
      Alert.alert(
        'End or Leave Meeting?',
        'As the host, you can end the meeting for everyone or just leave the meeting.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave Meeting',
            onPress: doLeave,
          },
          {
            text: 'End Meeting for All',
            style: 'destructive',
            onPress: () => {
              if (serviceRef.current) {
                serviceRef.current.endMeetingForAll();
              }
              doLeave();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Leave meeting?',
        'Are you sure you want to leave this meeting?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave Meeting',
            style: 'destructive',
            onPress: doLeave,
          },
        ]
      );
    }
  }, [isHost, doLeave]);


  // Intercept hardware back (Android) and swipe-back gesture to show leave dialog
  useEffect(() => {
    // React Navigation: fires before the screen is removed by gesture or header back button
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (leavingRef.current) return; // doLeave set this — let the navigation through
      e.preventDefault();
      handleLeave();
    });

    // Android hardware back button
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleLeave();
      return true; // prevent default back behaviour
    });

    return () => {
      unsubscribe();
      backSub.remove();
    };
  }, [navigation, handleLeave]);

  const copyMeetingLink = async () => {
    const edgeFrontendUrl =
      process.env.EXPO_PUBLIC_EDGE_FRONTEND_URL ||
      'https://meetingapp.konn3ct.net';
    const meetingUrl = `${edgeFrontendUrl}/join/${roomId}`;
    await Clipboard.setStringAsync(meetingUrl);
    Alert.alert(
      "Meeting Link Copied! 🎉",
      `${meetingUrl}\n\nShare this link with others so they can join your meeting.`,
      [{ text: 'OK' }]
    );
  };

  const toggleMic = async () => {
    if (!localStream) return;
    
    if (isMicMuted) {
      // Turning ON
      try {
        const stream = await mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as any });
        const track = stream.getAudioTracks()[0];
        if (track) {
          localStream.addTrack(track);
          if (serviceRef.current) await serviceRef.current.enableMic(track);
          setIsMicMuted(false);
        }
      } catch (err) {
        console.error('Failed to get mic', err);
        Alert.alert('Microphone Error', 'Could not access the microphone.');
      }
    } else {
      // Turning OFF
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.stop();
        localStream.removeTrack(track);
      }
      if (serviceRef.current) serviceRef.current.disableMic();
      setIsMicMuted(true);
    }
  };

  const toggleCamera = async () => {
    if (!localStream) return;
    
    if (isCameraOff) {
      // Turning ON
      try {
        const stream = await mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' }
        });
        const track = stream.getVideoTracks()[0];
        if (track) {
          localStream.addTrack(track);
          if (serviceRef.current) await serviceRef.current.enableCamera(track);
          setIsCameraOff(false);
          setCameraKey(k => k + 1); // bump key to remount RTCView
        }
      } catch (err) {
        console.error('Failed to get camera', err);
        Alert.alert('Camera Error', 'Could not access the camera.');
      }
    } else {
      // Turning OFF
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.stop();
        localStream.removeTrack(track);
      }
      if (serviceRef.current) serviceRef.current.disableCamera();
      setIsCameraOff(true);
      setCameraKey(k => k + 1);
    }
  };

  const toggleHandRaise = () => {
    const newState = !isHandRaisedLocally;
    setIsHandRaisedLocally(newState);
    if (serviceRef.current) {
      serviceRef.current.sendHandRaise(newState);
    }
  };

  const toggleRecording = () => {
    // For now just toggle the UI state since backend is not fully setup
    if (!isRecording) {
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
    
    if (serviceRef.current) {
      if (!isRecording) {
        serviceRef.current.sendStartRecording();
      } else {
        serviceRef.current.sendStopRecording();
      }
    }
  };

  const sendReaction = (emoji: string) => {
    if (serviceRef.current) {
      serviceRef.current.sendReaction(emoji);
      // Show it locally
      useMeetingStore.getState().addReaction({
        id: Math.random().toString(36).substr(7),
        userId: 'me',
        name: 'You',
        emoji,
        timestamp: Date.now()
      });
    }
  };

  const enterPip = () => {
    console.log('[PiP] enterPip called. isAvailable:', PipService.isAvailable());
    if (PipService.isAvailable()) {
      console.log('[PiP] Calling PipService.enter(16, 9)...');
      PipService.enter(16, 9);
    } else {
      Alert.alert('Not Supported', 'Picture-in-Picture is only supported on Android.');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalItems = remoteStreams.length + (isPipMode ? 0 : 1);
  const isHorizontalLayout = !!activeScreenShare;

  const getCardStyle = () => {
    if (isHorizontalLayout) {
      return styles.remoteVideoWrapperHorizontal;
    }
    switch (totalItems) {
      case 1:
        return styles.cardSingle;
      case 2:
        return styles.cardDouble;
      case 3:
      case 4:
        return styles.cardQuad;
      default:
        return styles.cardGrid;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 1).toUpperCase();
  };

  const renderCards = () => (
    <>
      {remoteStreams.map((p) => {
        const storeParticipant = participants.find(up => up.userId === p.id);
        const isRaised = storeParticipant?.isHandRaised;
        const isSpeaking = storeParticipant?.isSpeaking;
        // Check if stream has an active, enabled, unmuted video track
        const videoTrack = p.stream?.getVideoTracks()?.[0];
        const hasVideo = !!videoTrack && videoTrack.enabled && !videoTrack.muted && videoTrack.readyState === 'live';
        
        // Prefer the server-signalled mute state (via mute_state WS message) stored in
        // the Zustand store. Fall back to track-existence check only when no signal has
        // been received yet (e.g. the participant joined before the handler was set up).
        const isRemoteMicMuted = storeParticipant?.isMuted !== undefined
          ? storeParticipant.isMuted
          : (!p.stream || p.stream.getAudioTracks().length === 0);
        
        return (
          <View key={p.id} style={[
            getCardStyle(), 
            isSpeaking && styles.activeSpeakerBorder
          ]}>
            {!hasVideo ? (
              <View style={styles.cameraOff}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{getInitials(p.name)}</Text>
                </View>
              </View>
            ) : (
              <RTCView
                streamURL={p.stream.toURL ? p.stream.toURL() : ''}
                style={styles.rtcView}
                objectFit="cover"
              />
            )}
            {hasVideo && <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.videoGradient} pointerEvents="none" />}
            <View style={styles.nameBadgeContainer}>
              <Text style={styles.nameText} numberOfLines={1}>{p.name}</Text>
              <View style={{ marginLeft: 6 }}>
                {isRemoteMicMuted ? (
                  <MicOff size={12} color="#ffb4ab" />
                ) : (
                  <Mic size={12} color="#c2e7ff" />
                )}
              </View>
            </View>
            {isRaised && (
              <View style={styles.raisedHandBadge}>
                <Hand size={12} color="#a83b00" fill="#a83b00" />
                <Text style={styles.raisedHandText}>Raised</Text>
              </View>
            )}
            {isSpeaking && (
              <View style={styles.activeSpeakerBadge}>
                <Radio size={12} color="#0b57d0" />
              </View>
            )}
            {isRemoteMicMuted && (
              <View style={styles.mutedBadge}>
                <MicOff size={14} color="white" />
              </View>
            )}
          </View>
        );
      })}
      
      {!isPipMode && (
        <View style={[
          getCardStyle(), 
          isLocalUserSpeaking && styles.activeSpeakerBorder
        ]}>
          {localStream && !isCameraOff ? (
            // key forces a full unmount+remount on Android every toggle.
            // Without this, the GL surface freezes green and won't recover.
            <RTCView
              key={`local-cam-${cameraKey}`}
              streamURL={localStream.toURL ? localStream.toURL() : ''}
              style={styles.rtcView}
              objectFit="cover"
              mirror={true}
              zOrder={0}
            />
          ) : (
            <View style={styles.cameraOff}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(localUserName)}</Text>
              </View>
            </View>
          )}
          {localStream && !isCameraOff && <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.videoGradient} pointerEvents="none" />}
          <View style={styles.nameBadgeContainer}>
            <Text style={styles.nameText}>{localUserName}</Text>
            <View style={{ marginLeft: 6 }}>
              {isMicMuted ? (
                <MicOff size={12} color="#ffb4ab" />
              ) : (
                <Mic size={12} color="#c2e7ff" />
              )}
            </View>
          </View>
          {isHandRaisedLocally && (
            <View style={styles.raisedHandBadge}>
              <Hand size={12} color="#a83b00" fill="#a83b00" />
              <Text style={styles.raisedHandText}>Raised</Text>
            </View>
          )}
          {isLocalUserSpeaking && (
            <View style={styles.activeSpeakerBadge}>
              <Radio size={12} color="#0b57d0" />
            </View>
          )}
          {isMicMuted && (
            <View style={styles.mutedBadge}>
              <MicOff size={14} color="white" />
            </View>
          )}
        </View>
      )}
    </>
  );

  /* ── PiP mode: show only the most relevant video ──────────────────────── */
  if (isPipMode) {
    // Priority: screen share → first remote with video → local camera
    const pipScreenShare = activeScreenShare?.screenStream;
    const firstRemoteWithVideo = remoteStreams.find(p => {
      const vt = p.stream?.getVideoTracks()?.[0];
      return vt && vt.enabled && !vt.muted && vt.readyState === 'live';
    });
    const pipStream = pipScreenShare || firstRemoteWithVideo?.stream || localStream;

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {pipStream ? (
          <RTCView
            streamURL={pipStream.toURL ? pipStream.toURL() : ''}
            style={{ flex: 1 }}
            objectFit={pipScreenShare ? 'contain' : 'cover'}
            zOrder={0}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 14 }}>Meeting in progress</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {!isPipMode && <ReactionsLayer />}
      
      {/* Header Bar */}
      {!isPipMode && (
        <View style={[styles.headerBar, { marginTop: safeTop + 6 }]}>
          <View style={styles.headerRow}>
            {/* Meeting Info */}
            <View style={styles.headerInfoGroup}>
              <View style={styles.securityIcon}>
                <Lock size={10} color={tokens.primary} strokeWidth={2.5} />
              </View>
              <View style={styles.headerTextStack}>
                <Text style={styles.headerTitle} numberOfLines={1}>{roomId || 'Meeting'}</Text>
                <View style={styles.headerMeta}>
                  <View style={[
                    styles.liveDot,
                    isConnected ? styles.liveDotActive : styles.liveDotInactive
                  ]} />
                  <Text style={[styles.headerMetaText, isConnected && { color: tokens.success }]}>
                    {isConnected ? 'Live' : 'Waiting'}
                  </Text>
                  <View style={styles.metaDivider} />
                  <Users size={10} color={tokens.textMuted} strokeWidth={2.5} />
                  <Text style={styles.headerMetaText}> {totalItems}</Text>
                  
                  {isRecording && (
                    <>
                      <View style={styles.metaDivider} />
                      <View style={[styles.liveDot, { backgroundColor: tokens.danger, opacity: 0.8 }]} />
                      <Text style={[styles.headerMetaText, { color: tokens.danger }]}> REC {formatTime(recordingTime)}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerInviteBtn}
                activeOpacity={0.7}
                onPress={copyMeetingLink}
              >
                <UserPlus size={14} color={tokens.primary} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (!isCameraOff && serviceRef.current) {
                    serviceRef.current.switchCamera(localStream);
                  }
                }}
              >
                <SwitchCamera size={14} color={isCameraOff ? tokens.textMuted : tokens.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      {/* Waiting Room Prompt overlay */}
      {!isPipMode && isHost && waitingRoom && waitingRoom.length > 0 && (
        <View style={styles.waitingRoomPrompt}>
          <View style={styles.waitingRoomPromptContent}>
            <Text style={styles.waitingRoomPromptTitle}>Waiting Room</Text>
            <Text style={styles.waitingRoomPromptText} numberOfLines={1}>
              <Text style={{fontWeight: 'bold'}}>{waitingRoom[0].name}</Text> is waiting to join.
              {waitingRoom.length > 1 && ` (+${waitingRoom.length - 1} more)`}
            </Text>
          </View>
          <View style={styles.waitingRoomPromptActions}>
            <TouchableOpacity style={styles.waitingRoomPromptBtnDeny} onPress={() => handleDenyUser(waitingRoom[0].userId)}>
              <Text style={styles.waitingRoomPromptBtnTextDeny}>Deny</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waitingRoomPromptBtnAdmit} onPress={() => handleAdmitUser(waitingRoom[0].userId)}>
              <Text style={styles.waitingRoomPromptBtnTextAdmit}>Admit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeScreenShare && activeScreenShare.screenStream && (
        <View style={styles.screenShareContainer}>
          <RTCView
            streamURL={activeScreenShare.screenStream.toURL ? activeScreenShare.screenStream.toURL() : ''}
            style={styles.screenShareView}
            objectFit="contain"
          />
          <View style={styles.screenShareLabel}>
            <Text style={styles.screenShareName}>{activeScreenShare.name}'s Screen</Text>
          </View>
        </View>
      )}

      <View style={[styles.videoGrid, activeScreenShare && styles.videoGridShrunk]}>
        {totalItems <= 4 && !activeScreenShare ? (
          <View style={[
            styles.gridInner,
            styles.remoteGrid,
            { height: '100%' },
            (!activeScreenShare && !isPipMode) && {
              paddingBottom: safeBottom + 78,
            }
          ]}>
            {renderCards()}
          </View>
        ) : (
          <ScrollView
            style={styles.remoteGrid}
            contentContainerStyle={[
              styles.gridInnerScroll,
              (!activeScreenShare && !isPipMode) && {
                paddingBottom: safeBottom + 120,
              }
            ]}
            horizontal={!!activeScreenShare}
          >
            <View style={[styles.gridInner, activeScreenShare && styles.gridInnerHorizontal]}>
              {renderCards()}
            </View>
          </ScrollView>
        )}
      </View>

      {!isPipMode && (
        <View style={[
          styles.bottomToolbarContainer, 
          { bottom: safeBottom + 16 }
        ]}>
          <View style={[styles.floatingBar, { gap: 6 }]}>
            <TouchableOpacity style={!isMicMuted ? styles.toolBtnActive : styles.toolBtnMuted} onPress={toggleMic} testID="toggle-mic">
              {isMicMuted ? <MicOff size={20} color={tokens.danger} /> : <Mic size={20} color={tokens.textInverse} strokeWidth={2.2} />}
            </TouchableOpacity>

            <TouchableOpacity style={!isCameraOff ? styles.toolBtnNeutral : styles.toolBtnMuted} onPress={toggleCamera} testID="toggle-camera">
              {isCameraOff ? <VideoOff size={20} color={tokens.danger} /> : <VideoIcon size={20} color={tokens.textPrimary} strokeWidth={2} />}
            </TouchableOpacity>

            <TouchableOpacity style={isHandRaisedLocally ? styles.toolBtnActive : styles.toolBtnNeutral} onPress={toggleHandRaise}>
              <Hand size={20} color={isHandRaisedLocally ? tokens.textInverse : tokens.textPrimary} fill={isHandRaisedLocally ? tokens.textInverse : "none"} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtnNeutral} onPress={() => setIsMoreMenuVisible(true)} testID="more-button">
              <MoreVertical size={20} color={tokens.textPrimary} strokeWidth={2} />
              {unreadChatCount > 0 && (
                <View style={styles.menuBadge} />
              )}
            </TouchableOpacity>

            <View style={styles.toolbarDivider} />

            <TouchableOpacity style={styles.endCallBtn} onPress={handleLeave} testID="leave-button">
              <View style={{ transform: [{ rotate: '135deg' }] }}>
                <Phone size={20} color={tokens.textInverse} strokeWidth={2.2} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Side Panels Overlay */}
      {!isPipMode && activePane === 'chat' && <ChatPanel service={serviceRef.current} />}
      {!isPipMode && activePane === 'participants' && <ParticipantsPanel service={serviceRef.current} />}
      {!isPipMode && activePane === 'polls' && <PollsPanel service={serviceRef.current} />}
      {!isPipMode && activePane === 'whiteboard' && <WhiteboardPanel />}
      {!isPipMode && activePane === 'docs' && <DocsPanel />}
      {!isPipMode && activePane === 'donation' && <DonationPanel />}
      {!isPipMode && activePane === 'settings' && <SettingsPanel service={serviceRef.current} />}
      {!isPipMode && activePane === 'streaming' && <StreamingPanel roomId={roomId} />}

      {/* Overlays */}
      {!isPipMode && <CaptionsOverlay />}

      {/* Fix 11: Reconnecting overlay */}
      {isReconnecting && (
        <View style={styles.reconnectingOverlay}>
          <View style={styles.reconnectingBox}>
            <ActivityIndicator size="small" color={tokens.primary} />
            <Text style={styles.reconnectingText}>
              Reconnecting{reconnectAttempt > 0 ? ` (${reconnectAttempt}/5)` : ''}...
            </Text>
          </View>
        </View>
      )}

      {/* More Options Modal Bottom Sheet */}
      <Modal
        visible={isMoreMenuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsMoreMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsMoreMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[
                styles.sheetContent, 
                { paddingBottom: safeBottom + 32 }
              ]}>
                {/* Drag Handle */}
                <View style={styles.dragHandle} />
                
                <Text style={styles.sheetTitle}>Meeting Options</Text>

                {/* Quick Reactions */}
                <View style={styles.reactionsRow}>
                  {['👏', '👍', '❤️', '😂', '🎉', '😮'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionBtn}
                      onPress={() => {
                        sendReaction(emoji);
                        setIsMoreMenuVisible(false);
                      }}
                    >
                      <Text style={styles.reactionText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Grid Options */}
                <View style={styles.optionsGrid}>
                  <TouchableOpacity
                    style={[styles.gridOption, isHandRaisedLocally && styles.gridOptionActive]}
                    onPress={() => {
                      toggleHandRaise();
                      setIsMoreMenuVisible(false);
                    }}
                  >
                    <View style={[styles.optionIconContainer, isHandRaisedLocally && styles.optionIconContainerActive]}>
                      <Hand size={22} color={isHandRaisedLocally ? tokens.textInverse : tokens.textSecondary} fill={isHandRaisedLocally ? tokens.textInverse : "none"} />
                    </View>
                    <Text style={styles.optionLabel}>{isHandRaisedLocally ? "Lower Hand" : "Raise Hand"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridOption}
                    onPress={() => {
                      setIsMoreMenuVisible(false);
                      setActivePane(activePane === 'chat' ? 'none' : 'chat');
                    }}
                    testID="chat-menu-button"
                  >
                    <View style={styles.optionIconContainer}>
                      <MessageSquare size={22} color={tokens.textSecondary} />
                      {unreadChatCount > 0 && (
                        <View style={styles.optionBadge}>
                          <Text style={styles.optionBadgeText}>{unreadChatCount}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.optionLabel}>Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridOption}
                    onPress={() => {
                      setIsMoreMenuVisible(false);
                      setActivePane(activePane === 'participants' ? 'none' : 'participants');
                    }}
                  >
                    <View style={styles.optionIconContainer}>
                      <Users size={22} color={tokens.textSecondary} />
                    </View>
                    <Text style={styles.optionLabel}>Participants</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridOption}
                    onPress={() => {
                      setIsMoreMenuVisible(false);
                      setActivePane(activePane === 'polls' ? 'none' : 'polls');
                    }}
                  >
                    <View style={styles.optionIconContainer}>
                      <BarChart2 size={22} color={tokens.textSecondary} />
                    </View>
                    <Text style={styles.optionLabel}>Polls</Text>
                  </TouchableOpacity>

                  {!APP_CONFIG.GOV_LOGIN && (
                    <>
                      <TouchableOpacity
                        style={styles.gridOption}
                        onPress={() => {
                          setIsMoreMenuVisible(false);
                          setActivePane(activePane === 'whiteboard' ? 'none' : 'whiteboard');
                        }}
                      >
                        <View style={styles.optionIconContainer}>
                          <Presentation size={22} color={tokens.textSecondary} />
                        </View>
                        <Text style={styles.optionLabel}>Whiteboard</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.gridOption}
                        onPress={() => {
                          setIsMoreMenuVisible(false);
                          setActivePane(activePane === 'docs' ? 'none' : 'docs');
                        }}
                      >
                        <View style={styles.optionIconContainer}>
                          <FileText size={22} color={tokens.textSecondary} />
                        </View>
                        <Text style={styles.optionLabel}>Docs</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.gridOption}
                        onPress={() => {
                          setIsMoreMenuVisible(false);
                          setActivePane(activePane === 'donation' ? 'none' : 'donation');
                        }}
                      >
                        <View style={styles.optionIconContainer}>
                          <Gift size={22} color={tokens.textSecondary} />
                        </View>
                        <Text style={styles.optionLabel}>Donation</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {isHost && (
                    <TouchableOpacity
                      style={styles.gridOption}
                      onPress={() => {
                        toggleRecording();
                        setIsMoreMenuVisible(false);
                      }}
                    >
                      <View style={[styles.optionIconContainer, isRecording && styles.recordingActiveContainer]}>
                        {isRecording ? (
                          <Square size={22} color={tokens.danger} fill={tokens.danger} />
                        ) : (
                          <Disc size={22} color={tokens.textSecondary} />
                        )}
                      </View>
                      <Text style={styles.optionLabel}>{isRecording ? "Stop Rec" : "Record"}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.gridOption}
                    onPress={() => {
                      setIsMoreMenuVisible(false);
                      setActivePane(activePane === 'streaming' ? 'none' : 'streaming');
                    }}
                  >
                    <View style={styles.optionIconContainer}>
                      <Radio size={22} color={tokens.textSecondary} />
                    </View>
                    <Text style={styles.optionLabel}>Streaming</Text>
                  </TouchableOpacity>

                  {PipService.isAvailable() && (
                    <TouchableOpacity
                      style={styles.gridOption}
                      onPress={() => {
                        setIsMoreMenuVisible(false);
                        setTimeout(() => {
                          enterPip();
                        }, 300);
                      }}
                    >
                      <View style={styles.optionIconContainer}>
                        <View style={styles.pipIconWrapper}>
                          <View style={styles.pipIconDot} />
                        </View>
                      </View>
                      <Text style={styles.optionLabel}>PiP Mode</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.gridOption}
                    onPress={() => {
                      setTheme(theme === 'sage' ? 'midnight' : 'sage');
                    }}
                  >
                    <View style={styles.optionIconContainer}>
                      {theme === 'sage' ? <Moon size={22} color={tokens.textSecondary} /> : <Sun size={22} color={tokens.textSecondary} />}
                    </View>
                    <Text style={styles.optionLabel}>{theme === 'sage' ? 'Dark Mode' : 'Light Mode'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridOption}
                    onPress={() => {
                      setIsMoreMenuVisible(false);
                      setActivePane(activePane === 'settings' ? 'none' : 'settings');
                    }}
                  >
                    <View style={styles.optionIconContainer}>
                      <Settings size={22} color={tokens.textSecondary} />
                    </View>
                    <Text style={styles.optionLabel}>Settings</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  
  
  // ── Meeting UI styles below ──────────────────────────────────────────────
  // Header Bar — Compact floating pill
  headerBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
    backgroundColor: t.toolbarBg,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  securityIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: t.bgActiveBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTextStack: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: t.textPrimary,
    fontFamily: 'Inter',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  liveDotActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  liveDotInactive: {
    backgroundColor: t.textMuted,
  },
  headerMetaText: {
    fontSize: 10,
    fontWeight: '600',
    color: t.textSecondary,
    fontFamily: 'Inter',
    letterSpacing: 0.2,
  },
  metaDivider: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: t.textMuted,
    marginHorizontal: 6,
    opacity: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerInviteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: t.bgTile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: t.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border,
  },

  // Screen Share
  screenShareContainer: { height: 340, backgroundColor: '#000', width: '100%' },
  screenShareView: { width: '100%', height: '100%' },
  screenShareLabel: { position: 'absolute', bottom: 16, left: 16, backgroundColor: 'rgba(25, 27, 35, 0.8)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  screenShareName: { color: 'white', fontSize: 12, fontWeight: '600' },
  
  // Grid
  videoGrid: { flex: 1, backgroundColor: t.bg },
  videoGridShrunk: { flex: 1, maxHeight: 180 },
  remoteGrid: { flex: 1, padding: 4 },
  gridInnerScroll: { flexGrow: 1 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-start' },
  gridInnerHorizontal: { flexDirection: 'row', flexWrap: 'nowrap' },
  
  // Card Sizes — Modern rounded cards
  cardSingle: {
    width: '96%',
    height: '96%',
    backgroundColor: t.bgTile,
    margin: '2%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  cardDouble: {
    width: '96%',
    height: '47%',
    backgroundColor: t.bgTile,
    marginHorizontal: '2%',
    marginVertical: '1.5%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  cardQuad: {
    width: '47%',
    height: '47%',
    backgroundColor: t.bgTile,
    margin: '1.5%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  cardGrid: {
    width: '47%',
    height: 180,
    backgroundColor: t.bgTile,
    margin: '1.5%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  remoteVideoWrapperHorizontal: { width: 140, height: 140, backgroundColor: t.bgTile, marginHorizontal: 6, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  activeSpeakerBorder: { borderColor: t.primary },
  rtcView: { width: '100%', height: '100%' },
  videoGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70 },
  
  // Badges
  nameBadgeContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: { color: 'white', fontSize: 12, fontWeight: '600', fontFamily: 'Inter' },
  raisedHandBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  raisedHandText: { color: '#E65100', fontSize: 10, fontWeight: '700', marginLeft: 5, fontFamily: 'Inter', letterSpacing: 0.2 },
  activeSpeakerBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: t.bgActiveBadge, padding: 6, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  mutedBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0, 0, 0, 0.45)', padding: 6, borderRadius: 14 },
  cameraOff: {
    flex: 1,
    backgroundColor: t.cameraOffBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: t.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: t.textInverse,
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Inter',
    letterSpacing: 1,
  },
  
  // Toolbar — Modern floating pill bar
  bottomToolbarContainer: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.toolbarBg,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: t.shadowOpacity * 1.5,
    shadowRadius: 24,
    elevation: 10,
  },
  toolBtnActive: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.bgActive,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  toolBtnMuted: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.dangerHover,
    borderWidth: 1.5,
    borderColor: t.danger,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  toolBtnNeutral: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: t.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  menuBadge: { position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 4.5, backgroundColor: t.danger, borderWidth: 2, borderColor: t.bgElevated },
  toolbarDivider: { width: 1, height: 28, backgroundColor: t.border, marginHorizontal: 6, borderRadius: 1 },
  endCallBtn: {
    width: 58,
    height: 42,
    borderRadius: 21,
    backgroundColor: t.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: t.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  endCallText: { color: t.textInverse, fontSize: 16, fontWeight: '600', fontFamily: 'Inter' },
  captionSubtext: { color: t.textPrimary, fontSize: 13, lineHeight: 18, fontFamily: 'Inter', opacity: 0.8 },
  waitingRoomPrompt: { position: 'absolute', top: 90, left: 16, right: 16, backgroundColor: t.bgElevated, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8, borderWidth: 1, borderColor: t.border },
  waitingRoomPromptContent: { flex: 1, marginRight: 12 },
  waitingRoomPromptTitle: { color: t.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  waitingRoomPromptText: { color: t.textPrimary, fontSize: 14 },
  waitingRoomPromptActions: { flexDirection: 'row', gap: 8 },
  waitingRoomPromptBtnDeny: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: t.dangerHover },
  waitingRoomPromptBtnTextDeny: { color: t.danger, fontSize: 13, fontWeight: 'bold' },
  waitingRoomPromptBtnAdmit: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: t.primary },
  waitingRoomPromptBtnTextAdmit: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  
  // Modal Sheet — Modern bottom sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: t.bgElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.border, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: t.textPrimary, marginBottom: 16, textAlign: 'center', fontFamily: 'Inter', letterSpacing: -0.2 },
  reactionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.border, marginBottom: 18 },
  reactionBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.iconBtnBg, justifyContent: 'center', alignItems: 'center' },
  reactionText: { fontSize: 24 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 16 },
  gridOption: { width: '22%', alignItems: 'center', marginVertical: 14 },
  gridOptionActive: { opacity: 0.9 },
  optionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: t.iconBtnBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  optionIconContainerActive: { backgroundColor: t.bgActive },
  recordingActiveContainer: { backgroundColor: t.dangerHover },
  optionLabel: { fontSize: 11, fontWeight: '600', color: t.textSecondary, textAlign: 'center', fontFamily: 'Inter', letterSpacing: 0.1 },
  optionBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: t.danger, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: t.bgElevated },
  optionBadgeText: { color: t.textInverse, fontSize: 9, fontWeight: 'bold' },
  
  // Misc
  pipIconWrapper: { width: 18, height: 14, borderWidth: 1.5, borderColor: t.textSecondary, borderRadius: 3, alignItems: 'flex-end', justifyContent: 'flex-end', padding: 1 },
  pipIconDot: { width: 7, height: 5, backgroundColor: t.textSecondary, borderRadius: 1 },
  
  // Reconnecting overlay
  reconnectingOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  reconnectingBox: {
    backgroundColor: t.bgElevated,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  reconnectingText: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

