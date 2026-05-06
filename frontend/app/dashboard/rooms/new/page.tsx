"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft, Globe, Lock, Video, Check, Palette
} from "lucide-react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";

export default function NewRoomPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [slug, setSlug] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("private");
  const [roomType, setRoomType] = useState("Team");
  const [color, setColor] = useState("from-brand-green to-emerald-400");

  const colors = [
    { value: "from-brand-blue to-blue-500", label: "Blue", bgClass: "bg-blue-500" },
    { value: "from-brand-green to-emerald-400", label: "Green", bgClass: "bg-emerald-500" },
    { value: "from-amber-500 to-orange-400", label: "Orange", bgClass: "bg-orange-500" },
    { value: "from-purple-500 to-pink-400", label: "Purple", bgClass: "bg-purple-500" },
    { value: "from-rose-500 to-red-400", label: "Red", bgClass: "bg-red-500" },
    { value: "from-cyan-500 to-blue-400", label: "Cyan", bgClass: "bg-cyan-500" },
  ];

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRoomName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Normally you'd save to API here
    setTimeout(() => router.push("/dashboard/rooms"), 500);
  };

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/rooms">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5 text-text-muted" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Create Room</h1>
          <p className="text-text-muted mt-1">Set up a new reusable meeting space.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Room Details */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3 flex items-center gap-2">
              <Video className="w-5 h-5 text-brand-green" /> Room Information
            </h3>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Room Name</label>
              <Input 
                required 
                value={roomName}
                onChange={handleNameChange}
                placeholder="e.g. Design Critique" 
                className="h-11 bg-black/[0.02]" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Custom URL</label>
              <div className="flex items-center gap-2">
                <span className="text-text-muted bg-black/[0.03] px-3 h-11 flex items-center rounded-xl border border-border/60 text-sm whitespace-nowrap">
                  konn3ct.com/
                </span>
                <Input 
                  required 
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="design-critique" 
                  className="h-11 bg-black/[0.02] flex-1" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Room Type</label>
              <Select
                value={roomType}
                onChange={setRoomType}
                options={[
                  { value: "Team", label: "Team", description: "Internal team meeting space" },
                  { value: "External", label: "External", description: "For clients and outside guests" },
                  { value: "Company", label: "Company", description: "Company-wide all-hands room" },
                  { value: "Private", label: "Private", description: "Restricted personal room" },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Customization */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-border/60 bg-surface">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3 flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand-green" /> Privacy
              </h3>
              <div className="space-y-3">
                {[
                  { key: "public", icon: Globe, label: "Public Room", desc: "Anyone with the link can join directly." },
                  { key: "private", icon: Lock, label: "Private Room", desc: "Guests must knock to enter the room." },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPrivacy(opt.key as any)}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                      ${privacy === opt.key ? "border-brand-green bg-brand-green/5" : "border-border/60 hover:border-border"}`}
                  >
                    <opt.icon className={`w-5 h-5 mt-0.5 ${privacy === opt.key ? "text-brand-green" : "text-text-muted"}`} />
                    <div>
                      <h4 className={`text-sm font-bold ${privacy === opt.key ? "text-brand-green" : "text-text-primary"}`}>{opt.label}</h4>
                      <p className="text-xs text-text-muted mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 bg-surface">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-lg font-bold text-text-primary border-b border-border/40 pb-3 flex items-center gap-2">
                <Palette className="w-5 h-5 text-brand-green" /> Room Color
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`relative h-14 rounded-xl flex items-center justify-center transition-all ${c.bgClass} hover:opacity-90
                      ${color === c.value ? "ring-2 ring-offset-2 ring-brand-green shadow-md scale-[1.02]" : "opacity-80"}
                    `}
                  >
                    {color === c.value && <Check className="w-5 h-5 text-white" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 pt-4 border-t border-border/60">
          <Link href="/dashboard/rooms">
            <Button variant="outline" type="button" className="h-12 px-6 rounded-xl border-border/60">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="h-12 px-8 rounded-xl bg-brand-green hover:bg-[#287854] text-white font-bold shadow-lg shadow-brand-green/20">
            Create Room
          </Button>
        </div>
      </form>
    </div>
  );
}
