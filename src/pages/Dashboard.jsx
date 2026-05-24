import React, { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { 
  Copy, Video, Calendar, Users, Clock, 
  ArrowRight, Play, MoreVertical, 
  CalendarDays, Share2, Globe, Lock, CreditCard
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { getUser } from "../api/userApi";
import { getMeetings, getRooms } from "../api/roomsApi";
import useAuth from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { capitalize } from "../lib/utils";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
} from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import join from "../assets/icons/add-square.svg";
import video from "../assets/icons/video-01.svg";
const Dashboard = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const userQuery = useQueries({
    queries: [
      {
        enabled: isAuthenticated,
        queryKey: ["profile"],
        queryFn: getUser,
        cacheTime: 1000 * 60 * 30,
      },
      { enabled: isAuthenticated, queryKey: ["rooms"], queryFn: getRooms },
      { enabled: isAuthenticated, queryKey: ["meetings"], queryFn: getMeetings },
    ],
  });

  const handleCopy = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ description: t("common.status.copiedToClipboard") });
    } else {
      toast({ description: t("common.status.noMeetingId") });
    }
  };

  const handleStartInstantMeeting = () => {
    navigate('/rooms');
  };

  if (userQuery.some((query) => query.isLoading)) {
    return (
      <div className="flex flex-col gap-8 pb-10">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!userQuery.every((query) => query.isSuccess)) {
    return null;
  }

  const user = userQuery[0]?.data?.user;
  const roomsData = userQuery[1]?.data;
  const meetingsData = userQuery[2]?.data?.data || [];
  const personalRoomId = roomsData?.personal_room?.id;
  
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
            {t("app.sidebar.home", `Welcome back, ${user?.firstname || "User"}`)} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Here's what's happening with your meetings today.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link to="/payments" className="w-full md:w-auto">
            <Button
              className="w-full h-12 rounded-xl px-6 bg-brand-green hover:bg-[#287854] text-white shadow-[0_8px_24px_rgba(32,116,80,0.25)] hover:shadow-[0_12px_32px_rgba(32,116,80,0.35)] transition-all"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              {t("common.actions.managePlan", "Manage Plan")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Stat Cards */}
        {[
          { title: t("dashboard.stats.totalRoom", "Total Rooms"), value: roomsData?.total_rooms ?? 0, icon: Users, color: "text-brand-blue", bg: "bg-brand-blue/10" },
          { title: t("dashboard.stats.activeRoom", "Active Rooms"), value: roomsData?.active_rooms ?? 0, icon: Calendar, color: "text-brand-green", bg: "bg-brand-green/10" },
          { title: t("dashboard.stats.inactiveRoom", "Inactive Rooms"), value: (roomsData?.total_rooms ?? 0) - (roomsData?.active_rooms ?? 0), icon: Play, color: "text-[#CC505C]", bg: "bg-[#CC505C]/10" },
          { title: t("dashboard.stats.privateRoom", "Private Rooms"), value: roomsData?.private_rooms ?? 0, icon: Lock, color: "text-amber-500", bg: "bg-amber-500/10" }
        ].map((stat, i) => (
          <div key={i} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
            <Card className="rounded-2xl border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 overflow-hidden relative group h-full bg-surface">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                    <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions / Schedule */}
        <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          


          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Upcoming Meetings</h2>
            <Link to="/rooms">
              <Button variant="ghost" className="text-brand-green hover:text-brand-green-soft hover:bg-brand-green/10 rounded-lg">
                View Calendar <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          <Card className="rounded-2xl border-border bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="divide-y divide-border">
              {meetingsData.length === 0 ? (
                <div className="p-5 flex justify-center text-muted-foreground text-sm">No upcoming meetings scheduled.</div>
              ) : meetingsData.slice(0, 5).map((meeting, i) => {
                const dotColor = ["bg-brand-blue", "bg-brand-green", "bg-amber-400"][i % 3];

                return (
                  <div key={i} className="flex items-center p-5 hover:bg-black/[0.02] transition-colors group">
                    <div className="flex flex-col items-center justify-center w-20 text-center shrink-0">
                      <span className="text-sm font-bold text-foreground">{meeting.time || "TBD"}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{meeting.date || ""}</span>
                    </div>
                    <div className={`w-1 h-12 rounded-full mx-4 opacity-70 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-foreground truncate">{meeting.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {t("dashboard.meetings.room", { room: meeting.roomname })}</span>
                        <span className="w-1 h-1 rounded-full bg-border"></span>
                        <span>Host: {meeting.hostname}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button onClick={() => handleCopy(meeting.id)} size="sm" variant="outline" className="rounded-lg h-9">
                        <Copy className="w-4 h-4 mr-2" />
                        ID
                      </Button>
                      <Link to="/join">
                        <Button size="sm" className="rounded-lg h-9 bg-brand-green hover:bg-[#287854] text-white">
                          Join
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Quick Start & Recent */}
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
          <Card className="rounded-2xl border-none bg-gradient-to-br from-brand-blue to-[#001D5C] text-white overflow-hidden relative shadow-xl">
            <div className="absolute top-[-20%] right-[-10%] w-[200px] h-[200px] rounded-full bg-white/10 blur-[40px] z-0" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[150px] h-[150px] rounded-full bg-brand-green/30 blur-[40px] z-0" />

            <CardContent className="p-6 relative z-10">
              <h3 className="text-lg font-bold mb-2">Instant Meeting</h3>
              <p className="text-white/80 text-sm mb-6">
                Connect and manage your meetings instantly.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => navigate('/join')}
                    className="w-full bg-white text-brand-blue hover:bg-gray-100 h-12 rounded-xl font-bold transition-transform active:scale-95 px-2"
                  >
                    <img src={join} alt="Join" className="w-4 h-4 mr-2" style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(90%) saturate(2250%) hue-rotate(209deg) brightness(97%) contrast(105%)' }} />
                    Join
                  </Button>
                  <Button
                    onClick={() => navigate('/rooms')}
                    className="w-full bg-brand-green text-white hover:bg-[#287854] h-12 rounded-xl font-bold transition-transform active:scale-95 px-2"
                  >
                    <img src={video} alt="Host" className="w-4 h-4 mr-2" style={{ filter: 'brightness(0) invert(1)' }} />
                    Host
                  </Button>
                </div>
                
                <Button
                  onClick={() => navigate('/dashboard/schedule/new')}
                  variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 h-12 rounded-xl bg-transparent hover:text-white"
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Schedule for later
                </Button>

                <div className="pt-2">
                  <p className="mb-1 text-xs font-semibold text-white/70 uppercase tracking-wider">{t("dashboard.personalMeetingId", "Personal Meeting ID")}</p>
                  <div className="flex items-center justify-between bg-black/20 rounded-lg p-3">
                    <p className="truncate text-sm font-medium">
                      {personalRoomId ?? t("dashboard.noIdAvailable", "No ID Available")}
                    </p>
                    <Copy
                      className="h-4 w-4 cursor-pointer text-white/70 hover:text-white transition-colors"
                      onClick={() => handleCopy(personalRoomId)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
            </div>
            <div className="space-y-3">
              {[
                { title: "Test Audio and Video", icon: Video, action: () => navigate("/rooms") },
                { title: "Manage Plan", icon: CreditCard, action: () => navigate("/payments") },
                { title: "Join Meeting", icon: Users, action: () => navigate("/join") }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-surface hover:border-brand-blue/40 hover:shadow-sm transition-all group cursor-pointer" onClick={item.action}>
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-brand-blue/10 transition-colors">
                    <item.icon className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Quick Action</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-muted-foreground hover:text-brand-blue"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
