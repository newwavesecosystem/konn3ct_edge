import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert, Platform, NativeModules, DeviceEventEmitter, Modal, TouchableWithoutFeedback } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediasoupService, RemoteParticipant } from '../webrtc/MediasoupService';
import InCallManager from 'react-native-incall-manager';
import * as Clipboard from 'expo-clipboard';
import { useMeetingStore } from '../store/useMeetingStore';
import { Settings, Users, MessageSquare, Hand, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Phone, Radio, BarChart2, Disc, Square, UserPlus, Presentation, FileText, Gift, Copy, MoreVertical, SwitchCamera, Sun, Moon, Lock } from 'lucide-react-native';
import { useAuthStore } from '../store/useAuthStore';
import PipAndroid from 'react-native-pip-android';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Meeting'>;

export default function MeetingScreen({ route, navigation }: Props) {
  const { roomId, meetingToken } = route.params;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [cameraKey, setCameraKey] = useState(0); // bumped on every toggle to force RTCView remount
  const [isRecording, setIsRecording] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  
  const insets = useSafeAreaInsets();
  const serviceRef = useRef<MediasoupService | null>(null);
  
  // Zustand Store
  const { activePane, setActivePane, unreadChatCount, reset, currentUserRole, currentUserId, participants, isHandRaisedLocally, setIsHandRaisedLocally, theme, setTheme } = useMeetingStore();
  const user = useAuthStore((s) => s.user);
  const localUserName = user?.name || 'Me';
  const isHost = currentUserRole === 'host';
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);
  
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;
  const safeTop = insets.top > 0 ? insets.top + 8 : 16;

  const activeScreenShare = remoteStreams.find(p => p.screenStream != null);

  useEffect(() => {
    let isMounted = true;
    reset(); // Reset global store when joining
    
    // Setup PiP Listener for Android
    let pipListener: any = null;
    if (Platform.OS === 'android' && PipAndroid) {
      pipListener = PipAndroid.onPipModeChanged((isPip: Boolean) => {
        if (isMounted) setIsPipMode(isPip.valueOf());
      });
    }

    // Default to Speakerphone
    InCallManager.start({ media: 'video' });
    InCallManager.setForceSpeakerphoneOn(true);

    async function init() {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: { width: 1280, height: 720, frameRate: 30, facingMode: 'user' }
        });
        
        if (isMounted) setLocalStream(stream);

        const service = new MediasoupService(roomId);
        serviceRef.current = service;
        
        // Setup Media Callbacks
        service.onStreamUpdate((participants) => {
          if (isMounted) setRemoteStreams(participants);
        });

        service.onSessionStatusChange = async (status) => {
          if (!isMounted) return;
          if (status === 'waiting') {
            setIsWaiting(true);
            setIsConnected(false);
          } else if (status === 'active') {
            setIsWaiting(false);
            setIsConnected(true);
            if (stream) await service.broadcast(stream);
          }
        };

        // Setup Collaboration Callbacks
        service.onChatMessage = (msg) => useMeetingStore.getState().addChatMessage(msg);
        service.onChatHistory = (msgs) => useMeetingStore.getState().setChatHistory(msgs);
        service.onReaction = (reaction) => {
          reaction.id = Math.random().toString(36).substring(7);
          useMeetingStore.getState().addReaction(reaction);
        };
        service.onParticipantsList = (list) => {
          const inMeeting = list.filter(p => p.status !== 'waiting');
          const waiting = list.filter(p => p.status === 'waiting');
          useMeetingStore.getState().setParticipants(inMeeting);
          useMeetingStore.getState().waitingRoom = waiting;
        };
        service.onUserJoined = (user) => {
          useMeetingStore.getState().addParticipant(user);
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
        service.onPollCreate = (poll) => useMeetingStore.getState().addPoll(poll);
        service.onPollVote = (vote) => useMeetingStore.getState().updatePollVote(vote.pollId, vote.optionId);
        service.onPollHistory = (polls) => useMeetingStore.getState().setPolls(polls);
        service.onWaitingRoomRequest = (user) => useMeetingStore.getState().addWaitingRoomUser(user);
        service.onForceMute = () => {
          setIsMicMuted(true);
          if (stream) {
            const track = stream.getAudioTracks()[0];
            if (track) track.enabled = false;
          }
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

        const initialStatus = await service.connect(meetingToken);
        if (!isMounted) return;
        
        if (initialStatus === 'active') {
          await service.broadcast(stream);
          setIsConnected(true);
        } else if (initialStatus === 'waiting') {
          setIsWaiting(true);
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (pipListener) {
        pipListener.remove();
      }
      reset();
    };
  }, []);

  const handleLeave = () => {
    navigation.replace('MainTabs');
  };

  const copyMeetingLink = async () => {
    await Clipboard.setStringAsync(roomId);
    Alert.alert(
      "Room ID Copied! 🎉",
      `Room ID: ${roomId}\n\nShare this ID with others so they can tap Join and enter it to join your meeting.`,
      [{ text: 'OK' }]
    );
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMutedState = !audioTrack.enabled;
        setIsMicMuted(newMutedState);
        
        if (serviceRef.current) {
          if (newMutedState) serviceRef.current.pauseMic();
          else serviceRef.current.resumeMic();
        }
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        // Determine the INTENDED new state BEFORE flipping the track
        const cameraShouldBeOff = videoTrack.enabled; // currently on → turning off
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(cameraShouldBeOff);
        // Bump key to force RTCView to fully unmount/remount on Android.
        // Android's GL surface freezes when a track is disabled and won't
        // recover without a full remount — toggling enabled alone is not enough.
        setCameraKey(k => k + 1);
        
        if (serviceRef.current) {
          if (cameraShouldBeOff) serviceRef.current.pauseCamera();
          else serviceRef.current.resumeCamera();
        }
      }
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
    if (Platform.OS === 'android' && PipAndroid) {
      PipAndroid.enterPipMode();
    } else {
      Alert.alert("Not Supported", "Picture-in-Picture is only supported on Android.");
    }
  };

  if (isWaiting) {
    return (
      <SafeAreaView style={styles.waitingContainer}>
        <View style={styles.waitingCard}>
          <View style={styles.waitingIconWrapper}>
            <Text style={styles.waitingIcon}>K</Text>
          </View>
          <Text style={styles.waitingTitle}>Waiting for Host</Text>
          <Text style={styles.waitingSubtext}>You will join the meeting automatically once the host admits you.</Text>
          <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 32 }} />
          <TouchableOpacity style={styles.leaveWaitingBtn} onPress={handleLeave}>
            <Text style={styles.leaveText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {!isPipMode && <ReactionsLayer />}
      
      {/* Top Scrim Gradient */}
      {!isPipMode && (
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.08)', 'transparent']}
          style={styles.topScrim}
          pointerEvents="none"
        />
      )}

      {/* Top Overlay */}
      {!isPipMode && (
        <View style={[styles.topOverlay, { top: safeTop }]} pointerEvents="box-none">
          <View style={styles.infoPill}>
            <View style={styles.lockIconContainer}>
              <Lock size={12} color={tokens.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.infoTitle} numberOfLines={1}>{roomId || 'Product Sync'}</Text>
            <View style={[
              styles.infoDot,
              isConnected ? styles.infoDotActive : styles.infoDotInactive
            ]} />
            <Text style={[styles.infoTime, isConnected && { color: tokens.success, fontWeight: '600' }]}>
              {isConnected ? 'Active' : 'Wait'}
            </Text>
          </View>
          <View style={styles.topRightActions}>
            <TouchableOpacity
              style={styles.inviteBtn}
              activeOpacity={0.7}
              onPress={copyMeetingLink}
            >
              <UserPlus size={14} color="#fff" />
              <Text style={styles.inviteBtnText}>Invite</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.topActionBtn} activeOpacity={0.7} onPress={() => serviceRef.current?.switchCamera()}>
              <SwitchCamera size={16} color={tokens.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeScreenShare && activeScreenShare.screenStream && (
        <View style={styles.screenShareContainer}>
          <RTCView
            streamURL={activeScreenShare.screenStream.toURL()}
            style={styles.screenShareView}
            objectFit="contain"
          />
          <View style={styles.screenShareLabel}>
            <Text style={styles.screenShareName}>{activeScreenShare.name}'s Screen</Text>
          </View>
        </View>
      )}

      <View style={[styles.videoGrid, activeScreenShare && styles.videoGridShrunk]}>
        <ScrollView style={styles.remoteGrid} contentContainerStyle={styles.gridInnerScroll} horizontal={!!activeScreenShare}>
          <View style={[styles.gridInner, activeScreenShare && styles.gridInnerHorizontal]}>
            {remoteStreams.map((p) => {
              const storeParticipant = participants.find(up => up.userId === p.id);
              const isRaised = storeParticipant?.isHandRaised;
              const isSpeaking = storeParticipant?.isSpeaking;
              // Check if stream has an active, enabled, unmuted video track
              const videoTrack = p.stream?.getVideoTracks()?.[0];
              const hasVideo = !!videoTrack && videoTrack.enabled && !videoTrack.muted && videoTrack.readyState === 'live';
              
              const isRemoteMicMuted = !p.stream || p.stream.getAudioTracks().length === 0 || !p.stream.getAudioTracks()[0].enabled;
              
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
                      streamURL={p.stream.toURL()}
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
                participants.find(p => p.userId === currentUserId)?.isSpeaking && styles.activeSpeakerBorder
              ]}>
                {localStream && !isCameraOff ? (
                  // key forces a full unmount+remount on Android every toggle.
                  // Without this, the GL surface freezes green and won't recover.
                  <RTCView
                    key={`local-cam-${cameraKey}`}
                    streamURL={localStream.toURL()}
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
                {isMicMuted && (
                  <View style={styles.mutedBadge}>
                    <MicOff size={14} color="white" />
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {!isPipMode && (
        <View style={[
          styles.bottomToolbarContainer, 
          { bottom: safeBottom + 16 }
        ]}>
          <View style={[styles.floatingBar, { gap: 6 }]}>
            <TouchableOpacity style={!isMicMuted ? styles.toolBtnActive : styles.toolBtnMuted} onPress={toggleMic}>
              {isMicMuted ? <MicOff size={20} color={tokens.danger} /> : <Mic size={20} color={tokens.textInverse} strokeWidth={2.2} />}
            </TouchableOpacity>

            <TouchableOpacity style={!isCameraOff ? styles.toolBtnNeutral : styles.toolBtnMuted} onPress={toggleCamera}>
              {isCameraOff ? <VideoOff size={20} color={tokens.danger} /> : <VideoIcon size={20} color={tokens.textPrimary} strokeWidth={2} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtnNeutral} onPress={() => setIsMoreMenuVisible(true)}>
              <MoreVertical size={20} color={tokens.textPrimary} strokeWidth={2} />
              {unreadChatCount > 0 && (
                <View style={styles.menuBadge} />
              )}
            </TouchableOpacity>

            <View style={styles.toolbarDivider} />

            <TouchableOpacity style={styles.endCallBtn} onPress={handleLeave}>
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

                  {Platform.OS === 'android' && (
                    <TouchableOpacity
                      style={styles.gridOption}
                      onPress={() => {
                        setIsMoreMenuVisible(false);
                        enterPip();
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
  
  // Waiting Room
  waitingContainer: { flex: 1, backgroundColor: t.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  waitingCard: { backgroundColor: t.bgElevated, padding: 36, borderRadius: 28, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: t.border, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: t.shadowOpacity, shadowRadius: 24, elevation: 6 },
  waitingIconWrapper: { width: 72, height: 72, borderRadius: 36, backgroundColor: t.bgActiveBadge, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  waitingIcon: { color: t.primary, fontSize: 30, fontWeight: 'bold' },
  waitingTitle: { color: t.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 10, letterSpacing: -0.3 },
  waitingSubtext: { color: t.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  leaveWaitingBtn: { backgroundColor: t.primary, width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: t.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
  leaveText: { color: t.textInverse, fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  
  // Top Overlay
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'android' ? 110 : 130, zIndex: 15 },
  topOverlay: { position: 'absolute', left: 12, right: 12, zIndex: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.toolbarBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.shadowOpacity * 0.6,
    shadowRadius: 12,
    elevation: 3,
  },
  lockIconContainer: { marginRight: 6, justifyContent: 'center', alignItems: 'center' },
  infoTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: t.textPrimary, maxWidth: 120, letterSpacing: -0.2 },
  infoDot: { width: 7, height: 7, borderRadius: 3.5, marginHorizontal: 8 },
  infoDotActive: { backgroundColor: '#0FA97A', shadowColor: '#0FA97A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 5, elevation: 2 },
  infoDotInactive: { backgroundColor: t.textMuted },
  infoTime: { fontFamily: 'Inter', fontSize: 11, fontWeight: '600', color: t.textSecondary, letterSpacing: 0.2 },
  topRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.toolbarBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: t.shadowOpacity * 0.5,
    shadowRadius: 6,
    elevation: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: t.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    height: 40,
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  inviteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Inter', letterSpacing: 0.3 },

  // Screen Share
  screenShareContainer: { height: 340, backgroundColor: '#000', width: '100%' },
  screenShareView: { width: '100%', height: '100%' },
  screenShareLabel: { position: 'absolute', bottom: 16, left: 16, backgroundColor: 'rgba(25, 27, 35, 0.8)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  screenShareName: { color: 'white', fontSize: 12, fontWeight: '600' },
  
  // Grid
  videoGrid: { flex: 1, backgroundColor: t.bg },
  videoGridShrunk: { flex: 1, maxHeight: 180 },
  remoteGrid: { flex: 1, padding: 6 },
  gridInnerScroll: { flexGrow: 1, paddingBottom: 120 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', height: '100%' },
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
    borderRadius: 32,
    borderWidth: 1,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: t.shadowOpacity * 1.5,
    shadowRadius: 24,
    elevation: 10,
  },
  toolBtnActive: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.bgActive,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  toolBtnMuted: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.dangerHover,
    borderWidth: 1.5,
    borderColor: t.danger,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  toolBtnNeutral: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    width: 68,
    height: 50,
    borderRadius: 25,
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
  pipIconDot: { width: 7, height: 5, backgroundColor: t.textSecondary, borderRadius: 1 }
});

