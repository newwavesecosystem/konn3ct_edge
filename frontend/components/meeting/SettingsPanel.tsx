"use client";

import React from "react";
import { useMeetingTheme, type MeetingTheme } from "@/lib/meeting-theme-context";
import { useMeeting } from "@/lib/meeting-context";
import { useMeetingDevicePreferences } from "@/lib/meeting-device-preferences";
import type { GridOverflowMode } from "@/lib/types/meeting";
import {
  Speaker,
  Mic,
  Video,
  Globe,
  Volume2,
  Moon,
  Sun,
  Cloudy,
  Palette,
  Leaf,
  LayoutGrid,
  ArrowLeftRight,
  Image as ImageIcon,
  Ban,
  Droplet,
  Info,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const { theme, setTheme } = useMeetingTheme();
  const { 
    devices, 
    selectedDevices, 
    switchDevice, 
    isAINoiseSuppressionEnabled, 
    toggleAINoiseSuppression,
    isHDVideoEnabled,
    setIsHDVideoEnabled,
    isWidescreenEnabled,
    setIsWidescreenEnabled,
    isMirrorVideoEnabled,
    setIsMirrorVideoEnabled,
    isOriginalRatioEnabled,
    setIsOriginalRatioEnabled,
    isLowBandwidthEnabled,
    setIsLowBandwidthEnabled,
    isAudioOnlyModeEnabled,
    setIsAudioOnlyModeEnabled,
    isAlwaysMuteOnJoin,
    setIsAlwaysMuteOnJoin,
    vbMode,
    vbImageUrl,
    handleVbSelect,
    translationLanguage,
    setTranslationLanguage,
    captionSize,
    setCaptionSize,
    outputVolume,
    setOutputVolume,
    roomFeatureFlags,
    roomSettings,
    updateRoomSettings,
    currentUser,
    playNotificationSound
  } = useMeeting();
  const { gridOverflowMode, setGridOverflowMode } = useMeeting();
  
  const { preferences, setMeetingDevicePreferences } = useMeetingDevicePreferences();
  const nPrefs = preferences.notifications;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--mt-border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>Settings</h3>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
        {/* Theme settings */}
        <SettingsGroup label="Theme">
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: "var(--mt-text-muted)" }}>
              <Palette className="w-4 h-4 inline mr-2" style={{ verticalAlign: "text-bottom" }} />
              Meeting Theme
            </p>
            <div className="grid grid-cols-4 gap-2">
              <ThemeOption
                themeName="sage"
                label="Sage"
                icon={<Leaf className="w-4 h-4" />}
                description="Fresh"
                active={theme === "sage"}
                onSelect={() => setTheme("sage")}
              />
              <ThemeOption
                themeName="midnight"
                label="Midnight"
                icon={<Moon className="w-4 h-4" />}
                description="Dark"
                active={theme === "midnight"}
                onSelect={() => setTheme("midnight")}
              />
              <ThemeOption
                themeName="soft"
                label="Soft"
                icon={<Sun className="w-4 h-4" />}
                description="Light"
                active={theme === "soft"}
                onSelect={() => setTheme("soft")}
              />
              <ThemeOption
                themeName="slate"
                label="Slate"
                icon={<Cloudy className="w-4 h-4" />}
                description="Premium"
                active={theme === "slate"}
                onSelect={() => setTheme("slate")}
              />
            </div>
          </div>
        </SettingsGroup>

        {/* Audio settings */}
        <SettingsGroup label="Audio">
          <SettingsSelect
            icon={<Mic className="w-4 h-4" />}
            label="Microphone"
            options={devices.audioInputs.map(d => ({ value: d.deviceId, label: d.label || 'Default Microphone' }))}
            value={selectedDevices.audioInput}
            onChange={(val) => switchDevice('audioInput', val)}
          />
          <SettingsSelect
            icon={<Speaker className="w-4 h-4" />}
            label="Speaker"
            options={devices.audioOutputs.map(d => ({ value: d.deviceId, label: d.label || 'Default Speaker' }))}
            value={selectedDevices.audioOutput}
            onChange={(val) => switchDevice('audioOutput', val)}
          />
          <SettingsSlider
            icon={<Volume2 className="w-4 h-4" />}
            label="Output Volume"
            value={outputVolume}
            onChange={setOutputVolume}
          />
        </SettingsGroup>

        {/* Video settings */}
        <SettingsGroup label="Video">
          <SettingsSelect
            icon={<Video className="w-4 h-4" />}
            label="Camera"
            options={devices.videoInputs.map(d => ({ value: d.deviceId, label: d.label || 'Default Camera' }))}
            value={selectedDevices.videoInput}
            onChange={(val) => switchDevice('videoInput', val)}
          />
          <SettingsToggle 
            label="HD Video" 
            checked={isHDVideoEnabled} 
            onChange={setIsHDVideoEnabled}
          />
          <SettingsToggle 
            label="Widescreen Capture (16:9)" 
            checked={isWidescreenEnabled} 
            onChange={setIsWidescreenEnabled}
          />
          <SettingsToggle 
            label="Mirror my video" 
            checked={isMirrorVideoEnabled} 
            onChange={setIsMirrorVideoEnabled}
          />
          <SettingsToggle 
            label="Original Ratio" 
            checked={isOriginalRatioEnabled} 
            onChange={setIsOriginalRatioEnabled}
          />

          {roomFeatureFlags.virtualBackgroundEnabled && !isIOS && (
            <div className="pt-2 border-t" style={{ borderColor: "var(--mt-border)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--mt-text-muted)" }}>
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs font-medium">Virtual Background</span>
              </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleVbSelect('none')}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all h-14",
                  vbMode === 'none' ? "ring-2 ring-brand-green bg-white/10" : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10"
                )}
                title="Turn off virtual background"
              >
                <Ban className="w-5 h-5 mb-1 text-black/70" />
                <span className="text-[10px] text-black">None</span>
              </button>
              
              <button
                onClick={() => handleVbSelect('blur')}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all h-14 relative overflow-hidden",
                  vbMode === 'blur' ? "ring-2 ring-brand-green bg-white/10" : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10"
                )}
                title="Blur your background"
              >
                <div className="absolute inset-0 backdrop-blur-md bg-white/5" />
                <Droplet className="relative z-10 w-5 h-5 mb-1 text-white/70" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/backgrounds/blur.png`} alt={`blur`} className="w-full h-full object-cover" />
              </button>
              
              {[
                '/backgrounds/modern_office.png',
                '/backgrounds/cozy_cafe.png',
                '/backgrounds/minimalist_gradient.png'
              ].map((url, i) => (
                <button
                  key={url}
                  title={`Use Background ${i + 1}`}
                  onClick={() => handleVbSelect('image', url)}
                  className={cn(
                    "rounded-xl overflow-hidden transition-all h-14",
                    vbMode === 'image' && vbImageUrl === url ? "ring-2 ring-brand-green" : "ring-1 ring-white/10 hover:ring-white/20"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`BG ${i+1}`} className="w-full h-full object-cover" />
                </button>
              ))}

              {/* Custom Upload */}
              <label 
                title="Upload custom background image"
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all h-14 cursor-pointer",
                  vbMode === 'image' && vbImageUrl && !vbImageUrl.startsWith('/backgrounds') ? "ring-2 ring-brand-green bg-white/10" : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 border-dashed border-2"
                )}>
                <span className="text-lg text-black/50 leading-none mb-0.5">+</span>
                <span className="text-[9px] text-black/40">Upload</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const { compressImage } = await import('@/lib/utils');
                        const compressedData = await compressImage(file);
                        handleVbSelect('image', compressedData);
                      } catch (err) {
                        console.error("Failed to compress background image", err);
                      }
                    }}
                />
              </label>
            </div>
            </div>
          )}
        </SettingsGroup>

        {/* Notifications */}
        <SettingsGroup label="Notifications">
          <div className="mb-4">
            <p className="text-xs mb-3" style={{ color: "var(--mt-text-muted)" }}>
              These settings are saved on this browser/device and will apply to future meetings you join from this device.
            </p>
            
            <div className="flex flex-col gap-2 p-3 rounded-md mb-4" style={{ backgroundColor: "var(--mt-bg-hover)" }}>
              <SettingsToggle 
                label="Enable all pop-up notifications" 
                checked={nPrefs.enableAllToasts} 
                onChange={(val) => setMeetingDevicePreferences({ notifications: { enableAllToasts: val } })}
              />
              <div className="flex items-center justify-between">
                <SettingsToggle 
                  label="Enable all notification sounds" 
                  checked={nPrefs.enableAllSounds} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { enableAllSounds: val } })}
                />
                <button 
                  onClick={() => playNotificationSound(800, 0.15, 0.1)} 
                  disabled={!nPrefs.enableAllSounds}
                  className="ml-2 px-2 py-1 text-[10px] uppercase font-bold rounded bg-brand-green/20 text-brand-green hover:bg-brand-green/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Test
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--mt-text-faint)" }}>Chat Messages</p>
                <SettingsToggle 
                  label="Show chat message popups" 
                  checked={nPrefs.showChatToasts} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { showChatToasts: val } })}
                />
                <SettingsToggle 
                  label="Play chat message sound" 
                  checked={nPrefs.playChatSound} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { playChatSound: val } })}
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--mt-text-faint)" }}>Participants</p>
                <SettingsToggle 
                  label="Show join/leave popups" 
                  checked={nPrefs.showJoinLeaveToasts} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { showJoinLeaveToasts: val } })}
                />
                <SettingsToggle 
                  label="Play join/leave sound" 
                  checked={nPrefs.playJoinLeaveSound} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { playJoinLeaveSound: val } })}
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--mt-text-faint)" }}>Mute / Unmute</p>
                <SettingsToggle 
                  label="Show mute/unmute popups" 
                  checked={nPrefs.showMuteUnmuteToasts} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { showMuteUnmuteToasts: val } })}
                />
                <SettingsToggle 
                  label="Play mute/unmute sound" 
                  checked={nPrefs.playMuteUnmuteSound} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { playMuteUnmuteSound: val } })}
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--mt-text-faint)" }}>System Notifications</p>
                <SettingsToggle 
                  label="Show system popups" 
                  checked={nPrefs.showSystemToasts} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { showSystemToasts: val } })}
                />
                <SettingsToggle 
                  label="Play system sound" 
                  checked={nPrefs.playSystemSound} 
                  onChange={(val) => setMeetingDevicePreferences({ notifications: { playSystemSound: val } })}
                />
              </div>
            </div>
          </div>
        </SettingsGroup>

        {/* General */}
        <SettingsGroup label="General">
          {roomFeatureFlags.captionsEnabled && (
            <>
              <div className="flex flex-col gap-2 pt-2 pb-3">
                <div className="flex items-center justify-between text-xs font-medium" style={{ color: "var(--mt-text-muted)" }}>
                  <span>Caption Size</span>
                  <span>{Math.round(captionSize * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1" 
                  value={captionSize} 
                  onChange={(e) => setCaptionSize(parseFloat(e.target.value))}
                  className="w-full accent-brand-green"
                />
              </div>
              <SettingsSelect
                icon={<Globe className="w-4 h-4" />}
                label="Caption Translation"
                options={[
                  { value: "original", label: "Original Language" },
                  { value: "en", label: "English" },
                  { value: "fr", label: "French" },
                  { value: "es", label: "Spanish" },
                  { value: "de", label: "German" },
                  { value: "zh", label: "Chinese" },
                  { value: "yo", label: "Yoruba" },
                  { value: "ha", label: "Hausa" },
                  { value: "ig", label: "Igbo" }
                ]}
                value={translationLanguage}
                onChange={(val) => setTranslationLanguage(val)}
              />
            </>
          )}
          <SettingsToggle 
            label="AI Noise Suppression (Premium)" 
            checked={isAINoiseSuppressionEnabled} 
            onChange={toggleAINoiseSuppression}
          />
          <SettingsToggle 
            label="Low bandwidth mode" 
            checked={isLowBandwidthEnabled} 
            onChange={setIsLowBandwidthEnabled}
          />
          <SettingsToggle 
            label="Audio-only mode" 
            checked={isAudioOnlyModeEnabled} 
            onChange={setIsAudioOnlyModeEnabled}
          />
          <SettingsToggle 
            label="Always mute on join" 
            checked={isAlwaysMuteOnJoin} 
            onChange={setIsAlwaysMuteOnJoin}
          />
        </SettingsGroup>

        {/* Display / Grid settings */}
        <SettingsGroup label="Display">
          <div>
            <div className="flex items-center gap-2 mb-2" style={{ color: "var(--mt-text-muted)" }}>
              <LayoutGrid className="w-4 h-4" />
              <span className="text-xs font-medium">Grid Overflow</span>
            </div>
            <p className="text-[10px] mb-2.5" style={{ color: "var(--mt-text-faint)" }}>
              How to handle many participants in grid view
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGridOverflowMode("scroll")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: gridOverflowMode === "scroll" ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
                  border: gridOverflowMode === "scroll" ? "2px solid var(--color-brand-green)" : "2px solid var(--mt-border)",
                }}
              >
                <ArrowLeftRight className="w-4 h-4 rotate-90" style={{ color: gridOverflowMode === "scroll" ? "var(--mt-text)" : "var(--mt-text-muted)" }} />
                <span className="text-xs font-semibold" style={{ color: gridOverflowMode === "scroll" ? "var(--mt-text)" : "var(--mt-text-muted)" }}>Scroll</span>
                <span className="text-[10px]" style={{ color: "var(--mt-text-faint)" }}>Scrollbar</span>
                <span className="text-xs font-medium">Scrollable</span>
                <span className="text-[10px] text-center" style={{ color: "var(--mt-text-faint)" }}>
                  Scroll vertically through all participants
                </span>
              </button>
              <button
                onClick={() => setGridOverflowMode("paginate")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: gridOverflowMode === "paginate" ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
                  border: gridOverflowMode === "paginate" ? "2px solid var(--color-brand-green)" : "2px solid var(--mt-border)",
                }}
              >
                <span className="text-xs font-medium">Pages</span>
                <span className="text-[10px] text-center" style={{ color: "var(--mt-text-faint)" }}>
                  Show arrows to paginate through participants
                </span>
              </button>
            </div>
          </div>
        </SettingsGroup>

        {/* Media & Network (Host Only) */}
        {(currentUser.role === 'host' || currentUser.role === 'co-host') && (
          <SettingsGroup label="Media & Network">
            <SettingsToggle 
              label="Enable Network Detection" 
              checked={roomSettings.networkDetectionEnabled ?? true}
              onChange={(c) => updateRoomSettings({ networkDetectionEnabled: c })}
            />
            
            <div className="flex gap-2 my-3">
              <button onClick={() => updateRoomSettings({ poorNetworkRttMs: 300, poorNetworkLossPercent: 8, poorNetworkJitterMs: 60, networkWindowSize: 5, networkMonitorIntervalMs: 2000 })} className="text-[10px] bg-[var(--mt-bg-control)] px-2 py-1 rounded border">Default</button>
              <button onClick={() => updateRoomSettings({ poorNetworkRttMs: 1000, poorNetworkLossPercent: 25, poorNetworkJitterMs: 220, networkWindowSize: 8, networkMonitorIntervalMs: 2000 })} className="text-[10px] bg-[var(--mt-bg-control)] px-2 py-1 rounded border">Nigeria Relaxed</button>
              <button onClick={() => updateRoomSettings({ poorNetworkRttMs: 300, poorNetworkLossPercent: 5, poorNetworkJitterMs: 50, networkWindowSize: 5, networkMonitorIntervalMs: 2000 })} className="text-[10px] bg-[var(--mt-bg-control)] px-2 py-1 rounded border">Strict</button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1">RTT Threshold (ms) <span title="Round-trip time measures how long it takes network/media packets to travel to the server and back. Higher values mean more delay."><Info className="w-3 h-3 text-brand-green"/></span></span>
                  <span>{roomSettings.poorNetworkRttMs ?? 300}ms</span>
                </div>
                <input type="range" min="100" max="3000" step="50" value={roomSettings.poorNetworkRttMs ?? 300} onChange={(e) => updateRoomSettings({ poorNetworkRttMs: parseInt(e.target.value) })} className="w-full accent-brand-green" />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1">Packet Loss (%) <span title="Packet loss means some audio/video packets are not arriving. High packet loss can cause frozen video, robotic audio or missing frames."><Info className="w-3 h-3 text-brand-green"/></span></span>
                  <span>{roomSettings.poorNetworkLossPercent ?? 8}%</span>
                </div>
                <input type="range" min="1" max="50" step="1" value={roomSettings.poorNetworkLossPercent ?? 8} onChange={(e) => updateRoomSettings({ poorNetworkLossPercent: parseFloat(e.target.value) })} className="w-full accent-brand-green" />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1">Jitter (ms) <span title="Jitter measures how inconsistent the network delay is. High jitter can cause unstable audio and video even when speed looks good."><Info className="w-3 h-3 text-brand-green"/></span></span>
                  <span>{roomSettings.poorNetworkJitterMs ?? 60}ms</span>
                </div>
                <input type="range" min="10" max="1000" step="10" value={roomSettings.poorNetworkJitterMs ?? 60} onChange={(e) => updateRoomSettings({ poorNetworkJitterMs: parseInt(e.target.value) })} className="w-full accent-brand-green" />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1">Window Size <span title="This controls how many recent samples are checked before deciding that the connection is poor. A larger window reduces false warnings."><Info className="w-3 h-3 text-brand-green"/></span></span>
                  <span>{roomSettings.networkWindowSize ?? 5}</span>
                </div>
                <input type="range" min="3" max="20" step="1" value={roomSettings.networkWindowSize ?? 5} onChange={(e) => updateRoomSettings({ networkWindowSize: parseInt(e.target.value) })} className="w-full accent-brand-green" />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1">Monitor Interval (ms) <span title="This controls how often Konn3ct checks WebRTC network stats. 2000ms means every 2 seconds."><Info className="w-3 h-3 text-brand-green"/></span></span>
                  <span>{roomSettings.networkMonitorIntervalMs ?? 2000}ms</span>
                </div>
                <input type="range" min="1000" max="10000" step="500" value={roomSettings.networkMonitorIntervalMs ?? 2000} onChange={(e) => updateRoomSettings({ networkMonitorIntervalMs: parseInt(e.target.value) })} className="w-full accent-brand-green" />
              </div>
            </div>
          </SettingsGroup>
        )}
      </div>
    </div>
  );
}

function ThemeOption({
  themeName,
  label,
  icon,
  description,
  active,
  onSelect,
}: {
  themeName: MeetingTheme;
  label: string;
  icon: React.ReactNode;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200"
      style={{
        backgroundColor: active ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
        border: active ? "2px solid var(--color-brand-green)" : "2px solid var(--mt-border)",
      }}
    >
      <div
        className="w-full aspect-[16/10] rounded-lg flex items-center justify-center"
        style={{
          backgroundColor:
            themeName === "sage" ? "#F2F5F2" :
            themeName === "midnight" ? "#18181B" :
            themeName === "slate" ? "#0F172A" : "#F0EFE9",
          border: "1px solid var(--mt-border)",
        }}
      >
        <div className="flex gap-1">
          <div
            className="w-6 h-4 rounded"
            style={{
              backgroundColor:
                themeName === "sage" ? "#9DB8A3" :
                themeName === "midnight" ? "#27272A" :
                themeName === "slate" ? "#1E293B" : "#E3E2DC",
            }}
          />
          <div
            className="w-6 h-4 rounded"
            style={{
              backgroundColor:
                themeName === "sage" ? "#9DB8A3" :
                themeName === "midnight" ? "#27272A" :
                themeName === "slate" ? "#1E293B" : "#E3E2DC",
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ color: active ? "var(--mt-text)" : "var(--mt-text-muted)" }}>{icon}</span>
        <span
          className="text-xs font-semibold"
          style={{ color: active ? "var(--mt-text)" : "var(--mt-text-muted)" }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-[10px]"
        style={{ color: "var(--mt-text-faint)" }}
      >
        {description}
      </span>
    </button>
  );
}

function SettingsGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="text-[11px] uppercase tracking-wider font-semibold mb-3"
        style={{ color: "var(--mt-text-faint)" }}
      >
        {label}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingsSelect({
  icon,
  label,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (val: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5" style={{ color: "var(--mt-text-muted)" }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-colors appearance-none"
        style={{
          backgroundColor: "var(--mt-bg-input)",
          border: "1px solid var(--mt-border)",
          color: "var(--mt-text-secondary)",
        }}
      >
        {options.length === 0 && <option value="">No devices found</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ backgroundColor: "var(--mt-option-bg)" }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingsToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange?: (val: boolean) => void;
}) {
  const [isOnLocal, setIsOnLocal] = React.useState(checked);
  const isOn = onChange ? checked : isOnLocal;

  const handleClick = () => {
    const newVal = !isOn;
    if (onChange) onChange(newVal);
    else setIsOnLocal(newVal);
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: "var(--mt-text-muted)" }}>{label}</span>
      <button
        aria-label={label}
        onClick={handleClick}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          isOn ? "bg-brand-green" : ""
        }`}
        style={!isOn ? { backgroundColor: "var(--mt-bg-control-hover)" } : undefined}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
            isOn ? "translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
}

function SettingsSlider({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange?: (val: number) => void;
}) {
  const [val, setVal] = React.useState(value);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVal(value);
  }, [value]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2" style={{ color: "var(--mt-text-muted)" }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
        <span className="ml-auto text-xs font-semibold">{val}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={val}
        onChange={(e) => {
          const newVal = parseInt(e.target.value, 10);
          setVal(newVal);
          onChange?.(newVal);
        }}
        className="w-full accent-brand-green bg-black/20 h-1.5 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}
