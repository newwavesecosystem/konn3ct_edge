"use client";

import React from "react";
import { useMeetingTheme, type MeetingTheme } from "@/lib/meeting-theme-context";
import { useMeeting } from "@/lib/meeting-context";
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
  Focus
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const { theme, setTheme } = useMeetingTheme();
  const { 
    devices, 
    selectedDevices, 
    switchDevice, 
    isAINoiseSuppressionEnabled, 
    toggleAINoiseSuppression,
    isHDVideoEnabled,
    setIsHDVideoEnabled,
    isMirrorVideoEnabled,
    setIsMirrorVideoEnabled,
    isLowBandwidthEnabled,
    setIsLowBandwidthEnabled,
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
    setOutputVolume
  } = useMeeting();
  const { gridOverflowMode, setGridOverflowMode } = useMeeting();

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
            label="Mirror my video" 
            checked={isMirrorVideoEnabled} 
            onChange={setIsMirrorVideoEnabled}
          />

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
                <Ban className="w-5 h-5 mb-1 text-white/70" />
                <span className="text-[10px] text-white">None</span>
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
                <Focus className="relative z-10 w-5 h-5 mb-1 text-white/70" />
                <span className="relative z-10 text-[10px] text-white">Blur</span>
              </button>
              
              {[
                '/backgrounds/modern_office.png',
                '/backgrounds/cozy_cafe.png',
                '/backgrounds/minimalist_gradient.png'
              ].map((url, i) => (
                <button
                  key={url}
                  onClick={() => handleVbSelect('image', url)}
                  className={cn(
                    "rounded-xl overflow-hidden transition-all h-14",
                    vbMode === 'image' && vbImageUrl === url ? "ring-2 ring-brand-green" : "ring-1 ring-white/10 hover:ring-white/20"
                  )}
                >
                  <img src={url} alt={`BG ${i+1}`} className="w-full h-full object-cover" />
                </button>
              ))}

              {/* Custom Upload */}
              <label className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all h-14 cursor-pointer",
                vbMode === 'image' && vbImageUrl && !vbImageUrl.startsWith('/backgrounds') ? "ring-2 ring-brand-green bg-white/10" : "bg-white/5 hover:bg-white/10 ring-1 ring-white/10 border-dashed border-2"
              )}>
                <span className="text-lg text-white/50 leading-none mb-0.5">+</span>
                <span className="text-[9px] text-white/40">Upload</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      handleVbSelect('image', ev.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }} 
                />
              </label>
            </div>
          </div>
        </SettingsGroup>

        {/* General */}
        <SettingsGroup label="General">
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
              </button>
              <button
                onClick={() => setGridOverflowMode("paginate")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: gridOverflowMode === "paginate" ? "var(--mt-bg-active)" : "var(--mt-bg-control)",
                  border: gridOverflowMode === "paginate" ? "2px solid var(--color-brand-green)" : "2px solid var(--mt-border)",
                }}
              >
                <LayoutGrid className="w-4 h-4" style={{ color: gridOverflowMode === "paginate" ? "var(--mt-text)" : "var(--mt-text-muted)" }} />
                <span className="text-xs font-semibold" style={{ color: gridOverflowMode === "paginate" ? "var(--mt-text)" : "var(--mt-text-muted)" }}>Pages</span>
                <span className="text-[10px]" style={{ color: "var(--mt-text-faint)" }}>Dot pagination</span>
              </button>
            </div>
          </div>
        </SettingsGroup>
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
