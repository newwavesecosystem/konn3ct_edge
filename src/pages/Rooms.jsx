import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import React, { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
import { Card } from "../components/ui/card";
import activeIcon from "../assets/icons/active.svg";
import inactiveIcon from "../assets/icons/inactive.svg";
import scheduledIcon from "../assets/icons/scheduled.svg";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMeeting,
  deleteRoom,
  getRooms,
  startMeeting,
} from "../api/roomsApi";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../hooks/use-toast";
import { Skeleton } from "../components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { MeetingForm } from "./InviteHistory";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import UserIcon from "../assets/components/UserIcon";
import calendar from "../assets/icons/calendar-03.svg";
import clock from "../assets/icons/clock-05.svg";

const Rooms = () => {
  const roomQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const queryClient = useQueryClient();

  const deleteMeetingMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
    },
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
  const [meetingUrls, setMeetingUrls] = useState({});
  const [roomIdToDelete, setRoomIdToDelete] = useState(null);
  const [openScheduledSide, setOpenScheduleSide] = useState(false);

  useEffect(() => {
    if (!openDeleteDialog) setRoomIdToDelete(null);
  }, [openDeleteDialog]);

  const handleDeleteClick = (id) => {
    setRoomIdToDelete(id); // Set the ID of the room to delete
    setOpenDeleteDialog(true); // Open the dialog
  };

  const handleCopy = (url) => {
    const meeting_url = `https://k4.konn3ct.ng/join/${url}`;
    if (meeting_url) {
      navigator.clipboard.writeText(meeting_url);
      toast({ description: "Copied to clipboard" });
    }
  };

  const { toast } = useToast();

  const startMeetingMutation = useMutation({
    mutationFn: startMeeting,
    onSuccess: (res, id) => {
      toast({ description: "Meeting started successfully" });
      setMeetingUrls((prev) => ({ ...prev, [id]: res.data.url }));
      window.open(res.data.url, "_blank");
    },
  });

  if (roomQuery.isLoading)
    return (
      <div className="page container mx-auto">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  return (
    <section className="page container mx-auto">
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Card className="w-full min-h-full relative">
          <div className="py-5 flex gap-x-4">
            <DialogTrigger asChild>
              <Button>
                <Plus /> Create Room
              </Button>
            </DialogTrigger>
            <Button
              className="bg-[#E7F0FF] border border-[#2D8CFF] text-[#2D8CFF]"
              onClick={() => {
                setOpenScheduleDialog(true);
              }}
            >
              <Plus /> Schedule
            </Button>
          </div>
          <Separator />
          <div className="p-4 pt-10 flex items-center justify-between gap-x-4">
            <StatCard
              value={roomQuery.data.total_rooms}
              name="Total room"
              icon={roomsIcon}
            />
            <Separator orientation="vertical" className="h-[50px]" />
            <StatCard
              value={roomQuery.data.active_rooms}
              name="Active room"
              icon={activeIcon}
            />
            <Separator orientation="vertical" className="h-[50px]" />
            <div
              className="cursor-pointer"
              onClick={() => setOpenScheduleSide(true)}
            >
              <StatCard value={0} name="Scheduled Room" icon={scheduledIcon} />
            </div>
            <Separator orientation="vertical" className="h-[50px]" />
            <StatCard
              value={roomQuery.data.total_rooms - roomQuery.data.active_rooms}
              name="Inactive room"
              icon={inactiveIcon}
            />
          </div>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="">NAME</TableHead>
                <TableHead>ROOM URL</TableHead>
                <TableHead>
                  <div className="flex justify-between">
                    <p>ACTIONS</p>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomQuery.data.rooms.map(({ name, url, id }) => {
                return (
                  <TableRow key={id}>
                    <TableCell className="">{name}</TableCell>
                    <TableCell className="">{url}</TableCell>
                    <TableCell>
                      <div className="flex gap-x-2">
                        <Button
                          variant="outline"
                          onClick={() => handleCopy(url)}
                        >
                          Copy Link
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center px-4 border rounded-full whitespace-nowrap text-sm font-medium">
                            Manage
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem>Access Code</DropdownMenuItem>
                            <DropdownMenuItem>User Limit</DropdownMenuItem>
                            <DropdownMenuItem>
                              Meeting Room Banner Upload
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              Modify Pre-Registration
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              Pre-Registered Users
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              Disable Pre-Registration
                            </DropdownMenuItem>
                            <DropdownMenuItem>Transfer Room</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          disabled={startMeetingMutation.isPending}
                          onClick={() => startMeetingMutation.mutate(id)}
                        >
                          Start Meeting
                        </Button>
                        <Button
                          disabled={deleteMeetingMutation.isPending}
                          variant="destructive"
                          onClick={() => handleDeleteClick(id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {roomQuery.data.rooms.length === 0 && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
              <p>No data available for this table</p>
            </div>
          )}
        </Card>
        <DialogContent className="w-1/2">
          <DialogTitle>Create a new Meeting</DialogTitle>
          <DialogDescription>
            You will create a new meeting, accessible on the dashboard.
          </DialogDescription>
          <CreateMeetingDialog setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
      {/* //delete prompt */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="w-1/2">
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the room. This action cannot be
            undone, and all data associated with this room will be permanently
            deleted.
          </DialogDescription>
          <div className="flex gap-x-4">
            <Button
              variant="outline"
              onClick={() => setOpenDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMeetingMutation.mutate(roomIdToDelete); // Pass the stored room ID to the mutation
                setOpenDeleteDialog(false); // Close the dialog
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* //schedule */}
      <Dialog open={openScheduleDialog} onOpenChange={setOpenScheduleDialog}>
        <DialogContent className="top-[50%] w-[50%] h-[90%]  overflow-y-scroll">
          <DialogTitle>Schedule a new meeting</DialogTitle>
          <DialogDescription>
            Send an invite for a scheduled meeting
          </DialogDescription>
          <MeetingForm setOpenDialog={setOpenScheduleDialog} />
        </DialogContent>
      </Dialog>
      {/*  */}
      {/* //scheduled rooms */}
      <Sheet open={openScheduledSide} onOpenChange={setOpenScheduleSide}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Scheduled Meetings</SheetTitle>
            <SheetDescription>Your upcoming meetings.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 pb-12 flex flex-col gap-y-2 overflow-y-scroll h-[90vh] pr-3">
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
            <ScheduleMeetingCard />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};

export default Rooms;

const CreateMeetingDialog = ({ setOpenDialog }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: "Meeting created successfully" });
    },
  });

  const formSchema = z.object({
    name: z
      .string()
      .min(5, {
        message: "Meeting name must be at least 5 characters long.",
      })
      .refine((value) => value.trim().length > 0, {
        message: "Meeting name is required and cannot be empty or whitespace.",
      }),
    url: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
    },
  });

  const onSubmit = (data) => {
    createMeetingMutation.mutate(data);
    setOpenDialog(false);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-y-5 "
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meeting Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meeting url</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Optional" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="self-center">
          Create Meeting
        </Button>
      </form>
    </Form>
  );
};

const ScheduleMeetingCard = () => (
  <Card>
    <div className="flex justify-between text-[#707070]">
      <div className="flex gap-x-1">
        <img src={clock} alt="" />
        <p>8:30am</p>
      </div>
      <div className="flex gap-x-1">
        <img src={calendar} alt="" />
        <p>Tue Nov 2025</p>
      </div>
    </div>
    <h3 className="my-4 font-medium">Enhancing Agency and Collaboration</h3>
    <div className="flex gap-x-1 items-center text-[#707070]">
      <UserIcon />
      50
    </div>
  </Card>
);
