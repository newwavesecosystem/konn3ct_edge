import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import React, { useState } from "react";
import StatCard from "../components/StatCard";
import activeIcon from "../assets/icons/active.svg";
import inactiveIcon from "../assets/icons/inactive.svg";
import privateIcon from "../assets/icons/privateIcon.svg";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import calendar from "../assets/icons/calendar.svg";
import join from "../assets/icons/add-square.svg";
import video from "../assets/icons/video-01.svg";
import { Copy } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { getUser } from "../api/userApi";
import { capitalize, extractYouTubeID } from "../lib/utils";
import { getMeetings, getRooms } from "../api/roomsApi";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../hooks/use-toast";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { MeetingForm } from "./InviteHistory";
import { DialogTitle, DialogDescription } from "../components/ui/dialog";

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
      {
        enabled: isAuthenticated,
        queryKey: ["meetings"],
        queryFn: getMeetings,
      },
    ],
  });

  if (userQuery.every((query) => query.isLoading))
    return (
      <div className="page container mx-auto">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  const handleCopy = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ description: "Copied to clipboard" });
    }
  };

  if (userQuery.every((query) => query.isSuccess))
    return (
      <div className="container mx-auto page grid grid-cols-3 justify-evenly gap-5">
        <div className="flex flex-col gap-10 col-span-2">
          {/* Main detail Card */}
          <Card className="flex flex-col">
            <div className="flex items-center">
              <Avatar className="rounded-lg h-[78px] w-[78px]">
                <AvatarImage src={userQuery[0].data.user.profile_photo_url} />
                <AvatarFallback>AJ</AvatarFallback>
              </Avatar>
              <CardHeader>
                <CardTitle className="text-2xl">
                  {userQuery[0].data.user.lastname}{" "}
                  {userQuery[0].data.user.firstname}
                </CardTitle>
                <CardDescription className="text-black font-medium">
                  Your current plan: Konn3ct{" "}
                  {capitalize(userQuery[0]?.data?.user_plan?.name)}
                </CardDescription>
              </CardHeader>
            </div>
            <CardContent className="self-center mt-10">
              <Link to="/payments">
                <Button>Manage Plan</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Rooms Card */}
          <Card>
            <div className="flex gap-4 items-center justify-evenly">
              <div className="flex flex-col gap-y-10">
                <StatCard
                  value={userQuery[1].data.total_rooms}
                  name="Total room"
                  icon={roomsIcon}
                />
                <StatCard
                  value={userQuery[1].data.active_rooms}
                  name="Active room"
                  icon={activeIcon}
                />
              </div>
              <Separator orientation="vertical" className="h-[200px]" />
              <div className="flex flex-col gap-y-10">
                <StatCard
                  value={
                    userQuery[1].data.total_rooms -
                    userQuery[1].data.active_rooms
                  }
                  name="Inactive room"
                  icon={inactiveIcon}
                />
                <StatCard
                  value={userQuery[1].data.private_rooms}
                  name="Private room"
                  icon={privateIcon}
                />
              </div>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-10">
          <div className="max-w-[355px]">
            <h2 className="font-semibold text-[#707070] mb-3">
              Let's get you started
            </h2>
            <div className="h-[188px] outline rounded-xl">
              <iframe
                width="100%"
                height="100%"
                src={
                  `https://www.youtube.com/embed/` +
                  extractYouTubeID(userQuery[1].data.video_link)
                }
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
          </div>
          <Card className="flex flex-col items-center">
            <div className="flex justify-evenly w-full mb-6">
              <div className="flex flex-col items-center gap-y-4">
                <div
                  onClick={() => setOpenSchedule(true)}
                  className="cursor-pointer"
                >
                  <div className="w-[65px] h-[65px] bg-[#227451] flex justify-center items-center rounded-xl">
                    <img src={calendar} alt="schedule" />
                  </div>
                </div>
                Schedule
              </div>
              <div className="flex flex-col items-center gap-y-4">
                <Link to="/join">
                  <div className="w-[65px] h-[65px] bg-[#227451] flex justify-center items-center rounded-xl">
                    <img src={join} alt="join" />
                  </div>
                </Link>
                Join
              </div>
              <div className="flex flex-col items-center gap-y-4">
                <Link to="/rooms">
                  <div className="w-[65px] h-[65px] bg-[#012E89] flex justify-center items-center rounded-xl">
                    <img src={video} alt="host" />
                  </div>
                </Link>
                Host
              </div>
            </div>

            <p className="font-semibold mb-1">Personal Meeting ID</p>
            <div className="flex gap-x-2 items-center">
              <p className="text-base text-[#707070]">
                {userQuery[1].data.personal_room.id}
              </p>
              <Copy
                className="h-5 w-5 cursor-pointer"
                onClick={() => {
                  handleCopy(userQuery[1].data.personal_room.id);
                }}
              />
            </div>
          </Card>
          <Card>
            <div className="flex flex-row items-end justify-between space-y-0">
              <div className="text-2xl font-semibold">Meetings</div>
              <div>
                <Link
                  to="/rooms"
                  className="text-sm font-semibold text-[#2D8CFF] leading-7"
                >
                  Visit Meeting
                </Link>
              </div>
            </div>
            <div className="flex justify-center items-center flex-col">
              <div className="bg-[#F2F2F2] w-full rounded p-2 text-[#424242] font-semibold my-10">
                {userQuery[2].data.data.length === 0
                  ? "No upcoming Meetings"
                  : userQuery[2].data.data.map((meeting) => (
                      <>
                        <p key={meeting.title}>{meeting.title}</p>
                      </>
                    ))}
              </div>
              <Button variant="outline">Test Audio and Video</Button>
            </div>
          </Card>
        </div>
        <Dialog open={openSchedule} onOpenChange={setOpenSchedule}>
          <DialogContent className="top-[50%] w-[50%] h-[90%]  overflow-y-scroll">
            <DialogTitle>Send an new Invite</DialogTitle>
            <DialogDescription>
              Send an invite for a scheduled meeting
            </DialogDescription>
            <MeetingForm setOpenDialog={setOpenSchedule} />
          </DialogContent>
        </Dialog>
      </div>
    );
};

export default Dashboard;
