"use client";

import React from "react";
import { useMeetingTheme, type MeetingTheme } from "@/lib/meeting-theme-context";
import {
  Speaker,
  Mic,
  Video,
  Globe,
  Volume2,
  Sun,
  Moon,
  Palette,
} from "lucide-react";

export function SettingsPanel() {
  const { theme, setTheme } = useMeetingTheme();

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
            <div className="grid grid-cols-3 gap-2">
              <ThemeOption
                themeName="emerald"
                label="Emerald"
                icon={<Palette className="w-4 h-4" />}
                description="Default"
                active={theme === "emerald"}
                onSelect={() => setTheme("emerald")}
              />
              <ThemeOption
                themeName="konn3ct"
                label="Konn3ct"
                icon={<Sun className="w-4 h-4" />}
                description="Light"
                active={theme === "konn3ct"}
                onSelect={() => setTheme("konn3ct")}
              />
              <ThemeOption
                themeName="dark"
                label="Dark"
                icon={<Moon className="w-4 h-4" />}
                description="Cinematic"
                active={theme === "dark"}
                onSelect={() => setTheme("dark")}
              />
            </div>
          </div>
        </SettingsGroup>

        {/* Audio settings */}
        <SettingsGroup label="Audio">
          <SettingsSelect
            icon={<Mic className="w-4 h-4" />}
            label="Microphone"
            options={["Default - MacBook Pro Microphone", "External USB Mic"]}
          />
          <SettingsSelect
            icon={<Speaker className="w-4 h-4" />}
            label="Speaker"
            options={["Default - MacBook Pro Speakers", "External Speakers"]}
          />
          <SettingsSlider
            icon={<Volume2 className="w-4 h-4" />}
            label="Output Volume"
            value={75}
          />
        </SettingsGroup>

        {/* Video settings */}
        <SettingsGroup label="Video">
          <SettingsSelect
            icon={<Video className="w-4 h-4" />}
            label="Camera"
            options={["Default - FaceTime HD Camera", "External Webcam"]}
          />
          <SettingsToggle label="HD Video" checked={true} />
          <SettingsToggle label="Mirror my video" checked={true} />
        </SettingsGroup>

        {/* General */}
        <SettingsGroup label="General">
          <SettingsSelect
            icon={<Globe className="w-4 h-4" />}
            label="Language"
            options={["English", "French", "Yoruba", "Hausa", "Igbo"]}
          />
          <SettingsToggle label="Noise suppression" checked={true} />
          <SettingsToggle label="Low bandwidth mode" checked={false} />
          <SettingsToggle label="Always mute on join" checked={false} />
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
            themeName === "emerald" ? "#0B2B1E" :
            themeName === "dark" ? "#0d0d1a" : "#FCFCFC",
          border: "1px solid var(--mt-border)",
        }}
      >
        <div className="flex gap-1">
          <div
            className="w-6 h-4 rounded"
            style={{
              backgroundColor:
                themeName === "emerald" ? "#14412F" :
                themeName === "dark" ? "#1a1a2e" : "#F0F5F2",
            }}
          />
          <div
            className="w-6 h-4 rounded"
            style={{
              backgroundColor:
                themeName === "emerald" ? "#14412F" :
                themeName === "dark" ? "#1a1a2e" : "#F0F5F2",
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
}: {
  icon: React.ReactNode;
  label: string;
  options: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5" style={{ color: "var(--mt-text-muted)" }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <select
        className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-colors appearance-none"
        style={{
          backgroundColor: "var(--mt-bg-input)",
          border: "1px solid var(--mt-border)",
          color: "var(--mt-text-secondary)",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o} style={{ backgroundColor: "var(--mt-option-bg)" }}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingsToggle({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}) {
  const [isOn, setIsOn] = React.useState(checked);
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: "var(--mt-text-muted)" }}>{label}</span>
      <button
        onClick={() => setIsOn(!isOn)}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const [val, setVal] = React.useState(value);
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5" style={{ color: "var(--mt-text-muted)" }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
        <span className="ml-auto text-[10px]" style={{ color: "var(--mt-text-faint)" }}>{val}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none accent-brand-green"
        style={{ backgroundColor: "var(--mt-bg-control-hover)" }}
      />
    </div>
  );
}
