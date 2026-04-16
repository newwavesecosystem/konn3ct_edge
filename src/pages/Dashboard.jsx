import React, { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";

import { getUser } from "../api/userApi";
import { getMeetings, getRooms } from "../api/roomsApi";
import useAuth from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { capitalize } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import StatCard from "../components/StatCard";
import { gettingStartedVideoUrl } from "../lib/externalLinks";
import { MeetingForm } from "./InviteHistory";
import activeIcon from "../assets/icons/active.svg";
import calendar from "../assets/icons/calendar.svg";
import inactiveIcon from "../assets/icons/inactive.svg";
import join from "../assets/icons/add-square.svg";
import privateIcon from "../assets/icons/privateIcon.svg";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import video from "../assets/icons/video-01.svg";

const DASHBOARD_TEXT = {
  copied: "Copied to clipboard",
  noMeetingIdFound: "No Meeting ID found",
  managePlan: "Manage Plan",
  totalRoom: "Total room",
  activeRoom: "Active room",
  inactiveRoom: "Inactive room",
  privateRoom: "Private room",
  gettingStarted: "Let's get you started",
  schedule: "Schedule",
  join: "Join",
  host: "Host",
  personalMeetingId: "Personal Meeting ID",
  noMeetingId: "No ID available",
  meetings: "Meetings",
  visitMeeting: "Visit Meeting",
  noUpcomingMeetings: "No upcoming Meetings",
  roomLabel: (room) => `Room: ${room}`,
  hostLabel: (host) => `Host: ${host}`,
  testAudioVideo: "Test Audio and Video",
  sendInviteTitle: "Send a new Invite",
  sendInviteDescription: "Send an invite for a scheduled meeting",
};

const Dashboard = () => {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [openSchedule, setOpenSchedule] = useState(false);

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

  if (userQuery.every((query) => query.isLoading)) {
    return (
      <div className="page container mx-auto px-4 sm:px-0">
        <Skeleton className="relative min-h-full w-full" />
      </div>
    );
  }

  const handleCopy = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ description: DASHBOARD_TEXT.copied });
    } else {
      toast({ description: DASHBOARD_TEXT.noMeetingIdFound });
    }
  };

  if (!userQuery.every((query) => query.isSuccess)) {
    return null;
  }

  const currentPlanName = capitalize(userQuery[0]?.data?.user_plan?.name || "");

  return (
    <div className="container mx-auto page grid grid-cols-1 gap-5 px-4 sm:px-0 lg:grid-cols-3">
      <div className="flex flex-col gap-10 lg:col-span-2">
        <Card className="flex flex-col">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-[78px] w-[78px] rounded-lg">
              <AvatarImage src={userQuery[0]?.data?.user?.profile_photo_url} />
              <AvatarFallback>AJ</AvatarFallback>
            </Avatar>
            <CardHeader className="p-0 sm:p-6">
              <CardTitle className="text-center text-2xl sm:text-left">
                {userQuery[0]?.data?.user?.lastname}{" "}
                {userQuery[0]?.data?.user?.firstname}
              </CardTitle>
              <CardDescription className="text-center font-medium sm:text-left">
                {`Your current plan: Konn3ct ${currentPlanName}`}
              </CardDescription>
            </CardHeader>
          </div>
          <CardContent className="mt-6 self-center sm:mt-10">
            <Link to="/payments">
              <Button className="w-full sm:w-auto">
                {DASHBOARD_TEXT.managePlan}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <div className="flex flex-col items-center justify-evenly gap-8 sm:flex-row sm:gap-4">
            <div className="flex flex-col gap-y-6 sm:gap-y-10">
              <StatCard
                value={userQuery[1]?.data?.total_rooms ?? 0}
                name={DASHBOARD_TEXT.totalRoom}
                icon={roomsIcon}
              />
              <StatCard
                value={userQuery[1]?.data?.active_rooms ?? 0}
                name={DASHBOARD_TEXT.activeRoom}
                icon={activeIcon}
              />
            </div>
            <Separator
              orientation="vertical"
              className="hidden h-[200px] sm:block"
            />
            <div className="flex flex-col gap-y-6 sm:gap-y-10">
              <StatCard
                value={
                  (userQuery[1]?.data?.total_rooms ?? 0) -
                  (userQuery[1]?.data?.active_rooms ?? 0)
                }
                name={DASHBOARD_TEXT.inactiveRoom}
                icon={inactiveIcon}
              />
              <StatCard
                value={userQuery[1]?.data?.private_rooms ?? 0}
                name={DASHBOARD_TEXT.privateRoom}
                icon={privateIcon}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-10">
        <div className="max-w-full p-1 lg:max-w-[355px]">
          <h2 className="mb-3 text-center font-semibold text-muted-foreground lg:text-left">
            {DASHBOARD_TEXT.gettingStarted}
          </h2>
          <div className="h-[200px] rounded-xl border border-border/70 p-1 shadow-sm transition-colors duration-300 sm:h-[188px]">
            <iframe
              className="rounded-xl"
              width="100%"
              height="100%"
              src={gettingStartedVideoUrl}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            ></iframe>
          </div>
        </div>

        <Card className="flex flex-col items-center">
          <div className="mb-6 flex w-full flex-wrap justify-evenly gap-6 sm:gap-0">
            <div className="flex flex-col items-center gap-y-4">
              <div
                onClick={() => setOpenSchedule(true)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpenSchedule(true);
                  }
                }}
              >
                <div className="flex h-[65px] w-[65px] items-center justify-center rounded-xl bg-[#227451] shadow-sm transition-transform duration-300 hover:scale-[1.02]">
                  <img src={calendar} alt="schedule" />
                </div>
              </div>
              {DASHBOARD_TEXT.schedule}
            </div>
            <div className="flex flex-col items-center gap-y-4">
              <Link to="/join">
                <div className="flex h-[65px] w-[65px] items-center justify-center rounded-xl bg-[#227451] shadow-sm transition-transform duration-300 hover:scale-[1.02]">
                  <img src={join} alt="join" />
                </div>
              </Link>
              {DASHBOARD_TEXT.join}
            </div>
            <div className="flex flex-col items-center gap-y-4">
              <Link to="/rooms">
                <div className="flex h-[65px] w-[65px] items-center justify-center rounded-xl bg-[#012E89] shadow-sm transition-transform duration-300 hover:scale-[1.02]">
                  <img src={video} alt="host" />
                </div>
              </Link>
              {DASHBOARD_TEXT.host}
            </div>
          </div>

          <p className="mb-1 font-semibold">{DASHBOARD_TEXT.personalMeetingId}</p>
          <div className="flex items-center gap-x-2">
            <p className="max-w-[200px] truncate text-base text-muted-foreground">
              {userQuery[1]?.data?.personal_room?.id ??
                DASHBOARD_TEXT.noMeetingId}
            </p>
            <Copy
              className="h-5 w-5 cursor-pointer"
              onClick={() => handleCopy(userQuery[1]?.data?.personal_room?.id)}
            />
          </div>
        </Card>

        <Card>
          <div className="flex flex-col items-start justify-between space-y-2 sm:flex-row sm:items-end sm:space-y-0">
            <div className="text-2xl font-semibold">{DASHBOARD_TEXT.meetings}</div>
            <div>
              <Link
                to="/rooms"
                className="text-sm font-semibold leading-7 text-[#2D8CFF]"
              >
                {DASHBOARD_TEXT.visitMeeting}
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="my-6 w-full space-y-3 rounded-lg border border-border/70 bg-muted/50 p-3 text-foreground transition-colors duration-300 sm:my-10">
              {userQuery[2]?.data?.data?.length === 0 ? (
                <p className="text-center font-semibold">
                  {DASHBOARD_TEXT.noUpcomingMeetings}
                </p>
              ) : (
                userQuery[2]?.data?.data?.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="rounded-lg border border-border/70 bg-background p-3 shadow-sm transition-colors duration-300"
                  >
                    <p className="text-base font-semibold">{meeting.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {DASHBOARD_TEXT.roomLabel(meeting.roomname)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {DASHBOARD_TEXT.hostLabel(meeting.hostname)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {meeting.date} {" \u2022 "} {meeting.time}
                    </p>
                  </div>
                ))
              )}
            </div>

            <Button variant="outline" className="w-full sm:w-auto">
              {DASHBOARD_TEXT.testAudioVideo}
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={openSchedule} onOpenChange={setOpenSchedule}>
        <DialogContent className="top-[50%] h-[90%] w-[90%] overflow-y-scroll md:w-[calc(100%-4rem)] md:max-w-3xl lg:w-[50%]">
          <DialogTitle>{DASHBOARD_TEXT.sendInviteTitle}</DialogTitle>
          <DialogDescription>
            {DASHBOARD_TEXT.sendInviteDescription}
          </DialogDescription>
          <MeetingForm setOpenDialog={setOpenSchedule} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
