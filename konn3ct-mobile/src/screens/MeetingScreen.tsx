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
  const { roomId } = route.params;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  
  const insets = useSafeAreaInsets();
  const serviceRef = useRef<MediasoupService | null>(null);
  
  // Zustand Store
  const { activePane, setActivePane, unreadChatCount, reset, currentUserRole, currentUserId, participants, isHandRaisedLocally, setIsHandRaisedLocally, theme, setTheme } = useMeetingStore();
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

        const initialStatus = await service.connect();
        if (!isMounted) return;
        
        if (initialStatus === 'active') {
          await service.broadcast(stream);
          setIsConnected(true);
        } else if (initialStatus === 'waiting') {
          setIsWaiting(true);
        }

      } catch (err) {
        console.error("Meeting failed to initialize", err);
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
    const meetingUrl = `https://konn3ctedge.konn3ct.net/join/${roomId}`;
    await Clipboard.setStringAsync(meetingUrl);
    Alert.alert("Link Copied!", "The meeting link has been copied to your clipboard.");
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
        videoTrack.enabled = !videoTrack.enabled;
        const newCameraState = !videoTrack.enabled;
        setIsCameraOff(newCameraState);
        
        if (serviceRef.current) {
          if (newCameraState) serviceRef.current.pauseCamera();
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
            <TouchableOpacity style={styles.topActionBtn} activeOpacity={0.7} onPress={copyMeetingLink}>
              <Copy size={16} color={tokens.textPrimary} />
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
              // Check if stream has video tracks to determine if camera is off
              const hasVideo = p.stream && p.stream.getVideoTracks().length > 0;
              
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
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.videoGradient} pointerEvents="none" />
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
                  <RTCView streamURL={localStream.toURL()} style={styles.rtcView} objectFit="cover" mirror={true} zOrder={1} />
                ) : (
                  <View style={styles.cameraOff}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>ME</Text>
                    </View>
                  </View>
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.videoGradient} pointerEvents="none" />
                <View style={styles.nameBadgeContainer}>
                  <Text style={styles.nameText}>Me</Text>
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
          <View style={styles.floatingBar}>
            <TouchableOpacity style={[!isMicMuted ? styles.toolBtnActive : styles.toolBtnMuted, { marginRight: 8 }]} onPress={toggleMic}>
              {isMicMuted ? <MicOff size={22} color={tokens.danger} /> : <Mic size={22} color={tokens.textInverse} strokeWidth={2.2} />}
            </TouchableOpacity>

            <TouchableOpacity style={[!isCameraOff ? styles.toolBtnNeutral : styles.toolBtnMuted, { marginRight: 8 }]} onPress={toggleCamera}>
              {isCameraOff ? <VideoOff size={22} color={tokens.danger} /> : <VideoIcon size={22} color={tokens.textPrimary} strokeWidth={2} />}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.toolBtnNeutral, { marginRight: 8 }]} onPress={() => setIsMoreMenuVisible(true)}>
              <MoreVertical size={22} color={tokens.textPrimary} strokeWidth={2} />
              {unreadChatCount > 0 && (
                <View style={styles.menuBadge} />
              )}
            </TouchableOpacity>

            <View style={[styles.toolbarDivider, { marginRight: 8 }]} />

            <TouchableOpacity style={styles.endCallBtn} onPress={handleLeave}>
              <View style={{ transform: [{ rotate: '135deg' }] }}>
                <Phone size={22} color={tokens.textInverse} strokeWidth={2.2} />
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
  waitingCard: { backgroundColor: t.bgElevated, padding: 32, borderRadius: 24, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: t.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: t.shadowOpacity, shadowRadius: 16, elevation: 4 },
  waitingIconWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.bgActiveBadge, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  waitingIcon: { color: t.primary, fontSize: 28, fontWeight: 'bold' },
  waitingTitle: { color: t.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  waitingSubtext: { color: t.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  leaveWaitingBtn: { backgroundColor: t.primary, width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: t.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: t.shadowOpacity, shadowRadius: 8, elevation: 4 },
  leaveText: { color: t.textInverse, fontWeight: '600', fontSize: 15 },
  
  // Top Overlay
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'android' ? 100 : 120, zIndex: 15 },
  topOverlay: { position: 'absolute', left: 16, right: 16, zIndex: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.toolbarBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: t.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: t.shadowOpacity * 0.5, shadowRadius: 3, elevation: 1 },
  lockIconContainer: { marginRight: 6, justifyContent: 'center', alignItems: 'center' },
  infoTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: t.textPrimary, maxWidth: 120 },
  infoDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 8 },
  infoDotActive: { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 2 },
  infoDotInactive: { backgroundColor: t.textMuted },
  infoTime: { fontFamily: 'Inter', fontSize: 11, fontWeight: '500', color: t.textSecondary },
  topRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topActionBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.toolbarBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: t.shadowOpacity * 0.5, shadowRadius: 3, elevation: 1 },
  
  // Screen Share
  screenShareContainer: { height: 340, backgroundColor: '#000', width: '100%' },
  screenShareView: { width: '100%', height: '100%' },
  screenShareLabel: { position: 'absolute', bottom: 16, left: 16, backgroundColor: 'rgba(25, 27, 35, 0.8)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  screenShareName: { color: 'white', fontSize: 12, fontWeight: '600' },
  
  // Grid
  videoGrid: { flex: 1, backgroundColor: t.bg },
  videoGridShrunk: { flex: 1, maxHeight: 180 },
  remoteGrid: { flex: 1, padding: 8 },
  gridInnerScroll: { flexGrow: 1, paddingBottom: 120 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', height: '100%' },
  gridInnerHorizontal: { flexDirection: 'row', flexWrap: 'nowrap' },
  
  // Card Sizes
  cardSingle: {
    width: '96%',
    height: '96%',
    backgroundColor: t.bgTile,
    margin: '2%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.shadowOpacity,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDouble: {
    width: '96%',
    height: '47%',
    backgroundColor: t.bgTile,
    marginHorizontal: '2%',
    marginVertical: '1.5%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.shadowOpacity,
    shadowRadius: 8,
    elevation: 2,
  },
  cardQuad: {
    width: '47%',
    height: '47%',
    backgroundColor: t.bgTile,
    margin: '1.5%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.shadowOpacity,
    shadowRadius: 8,
    elevation: 2,
  },
  cardGrid: {
    width: '47%',
    height: 180,
    backgroundColor: t.bgTile,
    margin: '1.5%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.shadowOpacity,
    shadowRadius: 8,
    elevation: 2,
  },
  remoteVideoWrapperHorizontal: { width: 140, height: 140, backgroundColor: t.bgTile, marginHorizontal: 6, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  activeSpeakerBorder: { borderWidth: 2.5, borderColor: t.primary },
  rtcView: { width: '100%', height: '100%' },
  videoGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  
  // Badges
  nameBadgeContainer: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  nameText: { color: 'white', fontSize: 12, fontWeight: '600', fontFamily: 'Inter' },
  raisedHandBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#ffcfbe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  raisedHandText: { color: '#802b00', fontSize: 10, fontWeight: '600', marginLeft: 4, fontFamily: 'Inter' },
  activeSpeakerBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: t.bgActiveBadge, padding: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  mutedBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 6, borderRadius: 16 },
  cameraOff: {
    flex: 1,
    backgroundColor: t.cameraOffBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: t.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: t.shadowOpacity,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: t.textInverse,
    fontSize: 40,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  
  // Toolbar
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: t.shadowOpacity,
    shadowRadius: 18,
    elevation: 8,
  },
  toolBtnActive: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bgActive, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  toolBtnMuted: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', backgroundColor: t.dangerHover, borderWidth: 1, borderColor: t.danger, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  toolBtnNeutral: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.bgElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  menuBadge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: t.danger, borderWidth: 1.5, borderColor: t.bgElevated },
  toolbarDivider: { width: 1, height: 32, backgroundColor: t.border, marginHorizontal: 4 },
  endCallBtn: { width: 72, height: 52, borderRadius: 20, backgroundColor: t.danger, justifyContent: 'center', alignItems: 'center', ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  endCallText: { color: t.textInverse, fontSize: 16, fontWeight: '600', fontFamily: 'Inter' },
  
  // Modal Sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: t.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  dragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: t.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: t.textPrimary, marginBottom: 16, textAlign: 'center', fontFamily: 'Inter' },
  reactionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border, marginBottom: 16 },
  reactionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.iconBtnBg, justifyContent: 'center', alignItems: 'center' },
  reactionText: { fontSize: 22 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 16 },
  gridOption: { width: '22%', alignItems: 'center', marginVertical: 12 },
  gridOptionActive: { opacity: 0.9 },
  optionIconContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.iconBtnBg, justifyContent: 'center', alignItems: 'center', marginBottom: 6, position: 'relative' },
  optionIconContainerActive: { backgroundColor: t.bgActive },
  recordingActiveContainer: { backgroundColor: t.dangerHover },
  optionLabel: { fontSize: 11, fontWeight: '500', color: t.textSecondary, textAlign: 'center', fontFamily: 'Inter' },
  optionBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: t.danger, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: t.bgElevated },
  optionBadgeText: { color: t.textInverse, fontSize: 9, fontWeight: 'bold' },
  
  // Misc
  pipIconWrapper: { width: 18, height: 14, borderWidth: 1.5, borderColor: t.textSecondary, borderRadius: 3, alignItems: 'flex-end', justifyContent: 'flex-end', padding: 1 },
  pipIconDot: { width: 7, height: 5, backgroundColor: t.textSecondary, borderRadius: 1 }
});

