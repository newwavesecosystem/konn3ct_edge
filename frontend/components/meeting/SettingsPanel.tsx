"use client";

import React from "react";
import {
  Speaker,
  Mic,
  Video,
  Globe,
  Volume2,
} from "lucide-react";

export function SettingsPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Settings</h3>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
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

function SettingsGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-3">
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
      <div className="flex items-center gap-2 text-white/50 mb-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <select className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white/80 outline-none focus:border-brand-green/40 transition-colors appearance-none">
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#1a1a2e]">
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
      <span className="text-xs text-white/60">{label}</span>
      <button
        onClick={() => setIsOn(!isOn)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          isOn ? "bg-brand-green" : "bg-white/10"
        }`}
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
      <div className="flex items-center gap-2 text-white/50 mb-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
        <span className="ml-auto text-[10px] text-white/30">{val}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none accent-brand-green"
      />
    </div>
  );
}
