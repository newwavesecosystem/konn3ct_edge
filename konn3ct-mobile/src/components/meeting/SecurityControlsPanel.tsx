import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import {
  Shield,
  X,
  MicOff,
  Users,
} from "lucide-react-native";
import { meetingThemeTokens } from "../../theme/meetingTheme";
import { useMeetingStore } from "../../store/useMeetingStore";
import { MediasoupService } from "../../webrtc/MediasoupService";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  service: MediasoupService | null;
  onClose: () => void;
}

export function SecurityControlsPanel({ service, onClose }: Props) {
  const theme = useMeetingStore((state) => state.theme);
  const micLocked = useMeetingStore((state) => state.micLocked);
  const videoLocked = useMeetingStore((state) => state.videoLocked);
  const chatLocked = useMeetingStore((state) => state.chatLocked);
  const bypassWaitingRoom = useMeetingStore((state) => state.bypassWaitingRoom);

  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const insets = useSafeAreaInsets();
  const safeBottom =
    Platform.OS === "android" ? Math.max(insets.bottom, 24) : insets.bottom;

  const handleUpdateSetting = (
    setting: Partial<{
      micLocked: boolean;
      videoLocked: boolean;
      chatLocked: boolean;
      bypassWaitingRoom: boolean;
    }>
  ) => {
    if (!service) return;
    // Optimistically update store immediately so toggle reflects instantly
    useMeetingStore.getState().setRoomSettings(setting);
    // Send to server — server will echo back room_settings_updated to confirm
    service.updateRoomSettings(setting);
  };

  const handleMuteAttendees = () => {
    Alert.alert(
      "Mute Attendees",
      "Mute all participants except hosts?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute All",
          style: "destructive",
          onPress: () => service?.muteAll("all_except_hosts"),
        },
      ]
    );
  };

  const handleMuteExceptPresenters = () => {
    Alert.alert(
      "Mute Except Presenters",
      "Mute all participants except hosts and presenters?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "destructive",
          onPress: () => service?.muteAll("all_except_presenters"),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Drag Handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Shield color={tokens.textPrimary} size={20} />
          <Text style={styles.titleText}>Security & Controls</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          testID="close-security-btn"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>
        Manage room security and participant permissions.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeBottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleMuteAttendees}
            testID="mute-attendees-btn"
          >
            <View style={styles.actionIconWrap}>
              <Users color={tokens.primary} size={20} />
            </View>
            <Text style={styles.actionLabel}>Mute Attendees</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleMuteExceptPresenters}
            testID="mute-except-presenters-btn"
          >
            <View style={styles.actionIconWrap}>
              <MicOff color={tokens.primary} size={20} />
            </View>
            <Text style={styles.actionLabel}>Mute Except{"\n"}Presenters</Text>
          </TouchableOpacity>
        </View>

        {/* Toggle Rows */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Lock Microphones</Text>
              <Text style={styles.toggleDesc}>
                Prevent attendees from unmuting
              </Text>
            </View>
            <Switch
              value={micLocked}
              onValueChange={(val) => handleUpdateSetting({ micLocked: val })}
              trackColor={{ false: tokens.border, true: tokens.primary }}
              thumbColor="#fff"
              testID="lock-mic-switch"
            />
          </View>

          <View style={[styles.toggleRow, styles.toggleRowNoBorder]}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Lock Cameras</Text>
              <Text style={styles.toggleDesc}>
                Prevent attendees from sharing video
              </Text>
            </View>
            <Switch
              value={videoLocked}
              onValueChange={(val) => handleUpdateSetting({ videoLocked: val })}
              trackColor={{ false: tokens.border, true: tokens.primary }}
              thumbColor="#fff"
              testID="lock-camera-switch"
            />
          </View>
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Lock Chat</Text>
              <Text style={styles.toggleDesc}>
                Disable text chat for attendees
              </Text>
            </View>
            <Switch
              value={chatLocked}
              onValueChange={(val) => handleUpdateSetting({ chatLocked: val })}
              trackColor={{ false: tokens.border, true: tokens.primary }}
              thumbColor="#fff"
              testID="lock-chat-switch"
            />
          </View>

          <View style={[styles.toggleRow, styles.toggleRowNoBorder]}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Bypass Waiting Room</Text>
              <Text style={styles.toggleDesc}>Allow direct entry for all</Text>
            </View>
            <Switch
              value={bypassWaitingRoom}
              onValueChange={(val) =>
                handleUpdateSetting({ bypassWaitingRoom: val })
              }
              trackColor={{ false: tokens.border, true: tokens.primary }}
              thumbColor="#fff"
              testID="bypass-waiting-room-switch"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (t: any) =>
  StyleSheet.create({
    // Matches ChatPanel: absolute bottom sheet, covers toolbar
    container: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: "85%",
      backgroundColor: t.bgElevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: t.shadowOpacity,
      shadowRadius: 10,
      elevation: 20,
      zIndex: 100,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: t.border,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: 12,
      marginBottom: 4,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    headerTitle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    titleText: {
      fontSize: 18,
      fontWeight: "bold",
      color: t.textPrimary,
    },
    closeBtn: { padding: 4 },
    closeText: { color: t.textMuted, fontSize: 20 },
    description: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 4,
      fontSize: 13,
      color: t.textMuted,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 12,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 4,
    },
    actionCard: {
      flex: 1,
      backgroundColor: t.bgTile,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.border,
    },
    actionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.bgHover,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textPrimary,
      textAlign: "center",
    },
    toggleCard: {
      backgroundColor: t.bgTile,
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 4,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    toggleRowNoBorder: {
      borderBottomWidth: 0,
    },
    toggleInfo: {
      flex: 1,
      paddingRight: 16,
    },
    toggleTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: t.textPrimary,
      marginBottom: 3,
    },
    toggleDesc: {
      fontSize: 12,
      color: t.textMuted,
    },
  });
