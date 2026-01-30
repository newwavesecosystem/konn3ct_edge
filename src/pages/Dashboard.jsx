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
      { enabled: isAuthenticated, queryKey: ["meetings"], queryFn: getMeetings },
    ],
  });

  if (userQuery.every((query) => query.isLoading))
    return (
      <div className="page container mx-auto px-4 sm:px-0">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  const handleCopy = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ description: "Copied to clipboard" });
    } else {
      toast({ description: "No Meeting ID found" });
    }
  };

  if (userQuery.every((query) => query.isSuccess))
    return (
      <div className="container mx-auto page grid grid-cols-1 lg:grid-cols-3 gap-5 px-4 sm:px-0">
        {/* Left Side */}
        <div className="flex flex-col gap-10 lg:col-span-2">
          {/* Main detail Card */}
          <Card className="flex flex-col">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <Avatar className="rounded-lg h-[78px] w-[78px]">
                <AvatarImage
                  src={userQuery[0]?.data?.user?.profile_photo_url}
                />
                <AvatarFallback>AJ</AvatarFallback>
              </Avatar>
              <CardHeader className="p-0 sm:p-6">
                <CardTitle className="text-2xl text-center sm:text-left">
                  {userQuery[0]?.data?.user?.lastname}{" "}
                  {userQuery[0]?.data?.user?.firstname}
                </CardTitle>
                <CardDescription className="text-black font-medium text-center sm:text-left">
                  Your current plan: Konn3ct{" "}
                  {capitalize(userQuery[0]?.data?.user_plan?.name || "")}
                </CardDescription>
              </CardHeader>
            </div>
            <CardContent className="self-center mt-6 sm:mt-10">
              <Link to="/payments">
                <Button className="w-full sm:w-auto">Manage Plan</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Rooms Card */}
          <Card>
            <div className="flex flex-col sm:flex-row gap-8 sm:gap-4 items-center justify-evenly">
              <div className="flex flex-col gap-y-6 sm:gap-y-10">
                <StatCard
                  value={userQuery[1]?.data?.total_rooms ?? 0}
                  name="Total room"
                  icon={roomsIcon}
                />
                <StatCard
                  value={userQuery[1]?.data?.active_rooms ?? 0}
                  name="Active room"
                  icon={activeIcon}
                />
              </div>
              <Separator
                orientation="vertical"
                className="hidden sm:block h-[200px]"
              />
              <div className="flex flex-col gap-y-6 sm:gap-y-10">
                <StatCard
                  value={
                    (userQuery[1]?.data?.total_rooms ?? 0) -
                    (userQuery[1]?.data?.active_rooms ?? 0)
                  }
                  name="Inactive room"
                  icon={inactiveIcon}
                />
                <StatCard
                  value={userQuery[1]?.data?.private_rooms ?? 0}
                  name="Private room"
                  icon={privateIcon}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side */}
        <div className="flex flex-col gap-10">
          <div className="max-w-full lg:max-w-[355px] p-1">
            <h2 className="font-semibold text-[#707070] mb-3 text-center lg:text-left">
              Let's get you started
            </h2>
            <div className="h-[200px] sm:h-[188px] outline rounded-xl p-1">
              <iframe
              className="rounded-xl"
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/eTFcF4cgNn0"
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
          </div>

          {/* Quick Actions */}
          <Card className="flex flex-col items-center">
            <div className="flex justify-evenly w-full mb-6 flex-wrap gap-6 sm:gap-0">
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
              <p className="text-base text-[#707070] truncate max-w-[200px]">
                {userQuery[1]?.data?.personal_room?.id ?? "No ID available"}
              </p>
              <Copy
                className="h-5 w-5 cursor-pointer"
                onClick={() =>
                  handleCopy(userQuery[1]?.data?.personal_room?.id)
                }
              />
            </div>
          </Card>

          {/* Meetings */}
          <Card>
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between space-y-2 sm:space-y-0">
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
              <div className="bg-[#F2F2F2] w-full rounded p-3 text-[#424242] my-6 sm:my-10 space-y-3">
                {userQuery[2]?.data?.data?.length === 0 ? (
                  <p className="font-semibold text-center">No upcoming Meetings</p>
                ) : (
                  userQuery[2]?.data?.data?.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="bg-white rounded-lg p-3 shadow-sm"
                    >
                      {/* Meeting Title */}
                      <p className="font-semibold text-base">
                        {meeting.title}
                      </p>

                      {/* Room Name */}
                      <p className="text-sm text-gray-700">
                        Room: {meeting.roomname}
                      </p>

                      {/* Hostname */}
                      <p className="text-xs text-gray-600 mt-1">
                        Host: <span className="font-medium">{meeting.hostname}</span>
                      </p>

                      {/* Date & Time */}
                      <p className="text-xs text-gray-500 mt-1">
                        {meeting.date} • {meeting.time}
                      </p>
                    </div>
                  ))
                )}
              </div>


              <Button variant="outline" className="w-full sm:w-auto">
                Test Audio and Video
              </Button>
            </div>
          </Card>
        </div>

        {/* Dialog */}
        <Dialog open={openSchedule} onOpenChange={setOpenSchedule}>
          <DialogContent className="top-[50%] w-[90%] lg:w-[50%] h-[90%] overflow-y-scroll">
            <DialogTitle>Send a new Invite</DialogTitle>
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
