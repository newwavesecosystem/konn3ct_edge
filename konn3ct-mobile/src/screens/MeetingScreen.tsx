import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediasoupService, RemoteParticipant } from '../webrtc/MediasoupService';
import InCallManager from 'react-native-incall-manager';

type Props = NativeStackScreenProps<RootStackParamList, 'Meeting'>;

export default function MeetingScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  
  const serviceRef = useRef<MediasoupService | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    // Default to Speakerphone as requested
    InCallManager.start({ media: 'video' });
    InCallManager.setForceSpeakerphoneOn(true);

    async function init() {
      try {
        // 1. Get Local Camera Stream
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: 1280,
            height: 720,
            frameRate: 30,
            facingMode: 'user'
          }
        });
        
        if (isMounted) setLocalStream(stream);

        // 2. Initialize Mediasoup Service
        const service = new MediasoupService(roomId);
        serviceRef.current = service;
        
        service.onStreamUpdate((participants) => {
          if (isMounted) setRemoteStreams(participants);
        });

        // 3. Connect to Signaling Server
        await service.connect();
        
        // 4. Broadcast local stream to others
        await service.broadcast(stream);
        
        if (isMounted) setIsConnected(true);

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
    };
  }, []);

  const handleLeave = () => {
    navigation.replace('MainTabs');
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

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <View className="flex-row justify-between items-center p-4 bg-slate-800">
        <Text className="text-white text-lg font-bold">Room: {roomId}</Text>
        <Text className={isConnected ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </Text>
      </View>

      <View className="flex-1">
        {/* Remote Streams Grid */}
        <ScrollView className="flex-1 p-2">
          <View className="flex-row flex-wrap justify-center">
            {remoteStreams.map((p) => (
              <View key={p.id} className="w-40 h-48 bg-slate-800 m-1 rounded-xl overflow-hidden relative border border-slate-700 shadow-lg shadow-black">
                <RTCView
                  streamURL={p.stream.toURL()}
                  className="w-full h-full"
                  objectFit="cover"
                />
                <View className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded">
                  <Text className="text-white text-xs font-semibold">{p.name}</Text>
                </View>
              </View>
            ))}
            
            {remoteStreams.length === 0 && (
              <View className="w-full h-48 justify-center items-center">
                <Text className="text-slate-400 italic">Waiting for others to join...</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Local Stream PIP */}
        <View className="absolute bottom-4 right-4 w-28 h-40 bg-black rounded-xl overflow-hidden border-2 border-slate-600 shadow-xl shadow-black">
          {localStream && !isCameraOff ? (
            <RTCView
              streamURL={localStream.toURL()}
              className="w-full h-full"
              objectFit="cover"
              mirror={true}
            />
          ) : (
            <View className="flex-1 justify-center items-center bg-slate-800">
              <Text className="text-3xl">📷</Text>
              <Text className="text-slate-400 text-xs mt-1">Camera Off</Text>
            </View>
          )}
        </View>
      </View>

      {/* Meeting Controls Bar */}
      <View className="flex-row justify-around items-center p-6 bg-slate-800 border-t border-slate-700 rounded-t-3xl shadow-xl shadow-black">
        
        {/* Audio Toggle */}
        <TouchableOpacity 
          onPress={toggleMic}
          className={`w-14 h-14 rounded-full justify-center items-center ${isMicMuted ? 'bg-red-500/20 border border-red-500' : 'bg-slate-700'}`}
        >
          <Text className="text-2xl">{isMicMuted ? '🔇' : '🎤'}</Text>
        </TouchableOpacity>

        {/* Video Toggle */}
        <TouchableOpacity 
          onPress={toggleCamera}
          className={`w-14 h-14 rounded-full justify-center items-center ${isCameraOff ? 'bg-red-500/20 border border-red-500' : 'bg-slate-700'}`}
        >
          <Text className="text-2xl">{isCameraOff ? '🚫' : '📷'}</Text>
        </TouchableOpacity>

        {/* End Call Button */}
        <TouchableOpacity 
          onPress={handleLeave}
          className="w-20 h-14 rounded-full bg-red-600 justify-center items-center shadow-lg shadow-red-900"
        >
          <Text className="text-white font-bold text-lg">Leave</Text>
        </TouchableOpacity>
        
      </View>
    </SafeAreaView>
  );
}
