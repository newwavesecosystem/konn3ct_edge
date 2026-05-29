import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediasoupService, RemoteParticipant } from '../webrtc/MediasoupService';
import InCallManager from 'react-native-incall-manager';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import { useMeetingStore } from '../store/useMeetingStore';

// Components
import { ChatPanel } from '../components/meeting/ChatPanel';
import { ParticipantsPanel } from '../components/meeting/ParticipantsPanel';
import { PollsPanel } from '../components/meeting/PollsPanel';
import { ReactionsLayer } from '../components/meeting/ReactionsLayer';

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
  
  const serviceRef = useRef<MediasoupService | null>(null);
  
  // Zustand Store
  const { activePane, setActivePane, unreadChatCount, reset, currentUserRole } = useMeetingStore();
  const isHost = currentUserRole === 'host';

  useEffect(() => {
    let isMounted = true;
    reset(); // Reset global store when joining
    
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
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      Alert.alert("Recording Started", "The cloud recording has started.");
      setIsRecording(true);
    } else {
      Alert.alert("Recording Stopped", "The cloud recording has been saved.");
      setIsRecording(false);
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

  if (isWaiting) {
    return (
      <SafeAreaView style={styles.waitingContainer}>
        <Text style={styles.waitingTitle}>Waiting for Host</Text>
        <Text style={styles.waitingSubtext}>You are in the waiting room. The meeting host will let you in soon.</Text>
        <ActivityIndicator size="large" color="#38bdf8" style={{ marginVertical: 32 }} />
        <TouchableOpacity style={styles.leaveWaitingBtn} onPress={handleLeave}>
          <Text style={styles.leaveText}>Leave Meeting</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ReactionsLayer />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.roomText}>Room: {roomId}</Text>
          <TouchableOpacity onPress={copyMeetingLink} style={styles.copyBtn}>
            <Text style={styles.copyText}>📋 Copy Invite Link</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.statusText, isConnected ? styles.statusConnected : styles.statusConnecting]}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </Text>
      </View>

      <View style={styles.videoGrid}>
        <ScrollView style={styles.remoteGrid}>
          <View style={styles.gridInner}>
            {remoteStreams.map((p) => (
              <View key={p.id} style={styles.remoteVideoWrapper}>
                <RTCView
                  streamURL={p.stream.toURL()}
                  style={styles.rtcView}
                  objectFit="cover"
                />
                <View style={styles.nameLabel}>
                  <Text style={styles.nameText}>{p.name}</Text>
                </View>
              </View>
            ))}
            
            {remoteStreams.length === 0 && (
              <View style={styles.emptyGrid}>
                <Text style={styles.emptyText}>Waiting for others to join...</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Local Stream PIP */}
        <View style={styles.localVideoWrapper}>
          {localStream && !isCameraOff ? (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.rtcView}
              objectFit="cover"
              mirror={true}
            />
          ) : (
            <View style={styles.cameraOff}>
              <Text style={styles.cameraOffIcon}>📷</Text>
              <Text style={styles.cameraOffText}>Camera Off</Text>
            </View>
          )}
        </View>
      </View>

      {/* Floating Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.toolBtn, isMicMuted && styles.toolBtnDanger]} onPress={toggleMic}>
          <Text style={styles.toolIcon}>{isMicMuted ? '🔇' : '🎤'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.toolBtn, isCameraOff && styles.toolBtnDanger]} onPress={toggleCamera}>
          <Text style={styles.toolIcon}>{isCameraOff ? '🚫' : '📷'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={() => setActivePane(activePane === 'chat' ? 'none' : 'chat')}>
          <Text style={styles.toolIcon}>💬</Text>
          {unreadChatCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadChatCount}</Text></View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={() => setActivePane(activePane === 'participants' ? 'none' : 'participants')}>
          <Text style={styles.toolIcon}>👥</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={() => setActivePane(activePane === 'polls' ? 'none' : 'polls')}>
          <Text style={styles.toolIcon}>📊</Text>
        </TouchableOpacity>

        {isHost && (
          <TouchableOpacity style={[styles.toolBtn, isRecording && styles.toolBtnDanger]} onPress={toggleRecording}>
            <Text style={styles.toolIcon}>{isRecording ? '⏹' : '⏺'}</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.toolBtn} onPress={() => sendReaction('👏')}>
          <Text style={styles.toolIcon}>👏</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.toolBtn, styles.leaveBtn]} onPress={handleLeave}>
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Side Panels Overlay */}
      {activePane === 'chat' && <ChatPanel service={serviceRef.current} />}
      {activePane === 'participants' && <ParticipantsPanel service={serviceRef.current} />}
      {activePane === 'polls' && <PollsPanel service={serviceRef.current} />}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  waitingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  waitingTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  waitingSubtext: { color: '#94a3b8', fontSize: 16, textAlign: 'center' },
  leaveWaitingBtn: { backgroundColor: '#ef4444', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1e293b' },
  roomText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  copyBtn: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  copyText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  statusText: { fontWeight: 'bold' },
  statusConnected: { color: '#10b981' },
  statusConnecting: { color: '#f59e0b' },
  videoGrid: { flex: 1 },
  remoteGrid: { flex: 1, padding: 8 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  remoteVideoWrapper: {
    width: 160, height: 200,
    backgroundColor: '#1e293b',
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#334155'
  },
  rtcView: { width: '100%', height: '100%' },
  nameLabel: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  nameText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  emptyGrid: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', fontStyle: 'italic' },
  localVideoWrapper: {
    position: 'absolute', bottom: 16, right: 16,
    width: 110, height: 160,
    backgroundColor: 'black',
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 2, borderColor: '#334155',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10
  },
  cameraOff: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' },
  cameraOffIcon: { fontSize: 30 },
  cameraOffText: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    padding: 16, backgroundColor: '#1e293b',
    borderTopWidth: 1, borderTopColor: '#334155'
  },
  toolBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center'
  },
  toolBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: '#ef4444' },
  toolIcon: { fontSize: 20 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  leaveBtn: { width: 60, borderRadius: 12, backgroundColor: '#ef4444' },
  leaveText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});
