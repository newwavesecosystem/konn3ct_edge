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
  getMeetings,
  getRooms,
  startMeeting,
  manageAccessCode,
  limitUser,
  bannerUpload,
  transferRoom,
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
import { capitalize } from "../lib/utils";

const Rooms = () => {
  const roomQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const meetingQuery = useQuery({
    queryKey: ["meetings"],
    queryFn: getMeetings,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ---------------- State for dialogs ----------------
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
  const [meetingUrls, setMeetingUrls] = useState({});
  const [roomIdToDelete, setRoomIdToDelete] = useState(null);
  const [openScheduledSide, setOpenScheduleSide] = useState(false);

  // Manage dialogs
  const [openAccessDialog, setOpenAccessDialog] = useState(false);
  const [openLimitDialog, setOpenLimitDialog] = useState(false);
  const [openBannerDialog, setOpenBannerDialog] = useState(false);
  const [openTransferDialog, setOpenTransferDialog] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState(null);

  useEffect(() => {
    if (!openDeleteDialog) setRoomIdToDelete(null);
    if (!openAccessDialog && !openLimitDialog && !openBannerDialog && !openTransferDialog) {
      setSelectedRoomId(null);
    }
  }, [openDeleteDialog, openAccessDialog, openLimitDialog, openBannerDialog, openTransferDialog]);

  const handleDeleteClick = (id) => {
    setRoomIdToDelete(id);
    setOpenDeleteDialog(true);
  };

  const handleCopy = (url) => {
    const meeting_url = `${process.env.REACT_APP_BASE_BACKENED_URL}join/${url}`;
    if (meeting_url) {
      navigator.clipboard.writeText(meeting_url);
      toast({ description: "Copied to clipboard" });
    }
  };

  // ---------------- Mutations ----------------
  const deleteMeetingMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
    },
  });

  const startMeetingMutation = useMutation({
    mutationFn: startMeeting,
    onSuccess: (res, id) => {
      toast({ description: "Meeting started successfully" });
      setMeetingUrls((prev) => ({ ...prev, [id]: res.data.url }));
      window.open(res.data.url, "_blank");
    },
  });

  const manageAccessCodeMutation = useMutation({
    mutationFn: manageAccessCode,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: "Access code updated successfully" });
    },
  });

  const limitUserMutation = useMutation({
    mutationFn: limitUser,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: "User limit updated successfully" });
    },
  });

  const bannerUploadMutation = useMutation({
    mutationFn: bannerUpload,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: "Banner uploaded successfully" });
    },
  });

  const transferRoomMutation = useMutation({
    mutationFn: transferRoom,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: "Room transferred successfully" });
    },
  });

  if (roomQuery.isLoading || meetingQuery.isLoading)
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
                <TableHead>NAME</TableHead>
                <TableHead>ROOM URL</TableHead>
                <TableHead>
                  <div className="flex justify-between">
                    <p>ACTIONS</p>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomQuery.data.rooms.map(({ name, url, id }) => (
                <TableRow key={id}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{`${process.env.REACT_APP_BASE_BACKENED_URL}join/${url}`}</TableCell>
                  <TableCell>
                    <div className="flex gap-x-2">
                      <Button variant="outline" onClick={() => handleCopy(url)}>
                        Copy Link
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center px-4 border rounded-full whitespace-nowrap text-sm font-medium">
                          Manage
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenAccessDialog(true);
                            }}
                          >
                            Access Code
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenLimitDialog(true);
                            }}
                          >
                            User Limit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenBannerDialog(true);
                            }}
                          >
                            Meeting Room Banner Upload
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenTransferDialog(true);
                            }}
                          >
                            Transfer Room
                          </DropdownMenuItem>
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
              ))}
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

      {/* Manage Forms */}
      <AccessCodeDialog
        open={openAccessDialog}
        setOpen={setOpenAccessDialog}
        roomId={selectedRoomId}
        mutation={manageAccessCodeMutation}
      />
      <LimitUserDialog
        open={openLimitDialog}
        setOpen={setOpenLimitDialog}
        roomId={selectedRoomId}
        mutation={limitUserMutation}
      />
      <BannerUploadDialog
        open={openBannerDialog}
        setOpen={setOpenBannerDialog}
        roomId={selectedRoomId}
        mutation={bannerUploadMutation}
      />
      <TransferRoomDialog
        open={openTransferDialog}
        setOpen={setOpenTransferDialog}
        roomId={selectedRoomId}
        mutation={transferRoomMutation}
      />

      {/* delete prompt */}
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
                deleteMeetingMutation.mutate(roomIdToDelete);
                setOpenDeleteDialog(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* schedule */}
      <Dialog open={openScheduleDialog} onOpenChange={setOpenScheduleDialog}>
        <DialogContent className="top-[50%] w-[50%] h-[90%] overflow-y-scroll">
          <DialogTitle>Schedule a new meeting</DialogTitle>
          <DialogDescription>
            Send an invite for a scheduled meeting
          </DialogDescription>
          <MeetingForm setOpenDialog={setOpenScheduleDialog} />
        </DialogContent>
      </Dialog>

      {/* scheduled rooms */}
      <Sheet open={openScheduledSide} onOpenChange={setOpenScheduleSide}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Scheduled Meetings</SheetTitle>
            <SheetDescription>Your upcoming meetings.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 pb-12 flex flex-col gap-y-2 overflow-y-scroll h-[90vh] pr-3">
            {meetingQuery.data.data.map(({ date, time, roomname, guest }) => (
              <ScheduleMeetingCard
                key={roomname + date}
                date={date}
                time={time}
                roomname={roomname}
                guest={guest}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};

export default Rooms;

/* ---------------- Manage Dialogs ---------------- */

const AccessCodeDialog = ({ open, setOpen, roomId, mutation }) => {
  const formSchema = z.object({
    type: z.enum(["auto", "manual", "remove"]),
    accesscode: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "auto", accesscode: "" },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: roomId, ...data });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-1/3">
        <DialogTitle>Manage Access Code</DialogTitle>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-y-4"
          >
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type (auto / manual / remove)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="auto / manual / remove" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accesscode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Code (if manual)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Save</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const LimitUserDialog = ({ open, setOpen, roomId, mutation }) => {
  const formSchema = z.object({
    users: z.string().min(1, "Required"),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { users: "" },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: roomId, ...data });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-1/3">
        <DialogTitle>Limit Users</DialogTitle>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-y-4"
          >
            <FormField
              control={form.control}
              name="users"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Limit</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Save</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const BannerUploadDialog = ({ open, setOpen, roomId, mutation }) => {
  const formSchema = z.object({
    banner: z.any(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { banner: null },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: roomId, banner: data.banner[0] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-1/3">
        <DialogTitle>Upload Room Banner</DialogTitle>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-y-4"
          >
            <FormField
              control={form.control}
              name="banner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Banner</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => field.onChange(e.target.files)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Upload</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const TransferRoomDialog = ({ open, setOpen, roomId, mutation }) => {
  const formSchema = z.object({
    email: z.string().email(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: roomId, ...data });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-1/3">
        <DialogTitle>Transfer Room</DialogTitle>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Owner Email</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Transfer</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- Existing Create Meeting + Schedule ---------------- */

const CreateMeetingDialog = ({ setOpenDialog }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: "Meeting created successfully" });
      setOpenDialog(false);
    },
    onError: (error) => {
      if (error.response?.data?.message?.includes("maximum room")) {
        toast({
          variant: "destructive",
          title: "Plan Limit Reached",
          description:
            "You’ve reached the maximum number of rooms for your current plan. Please upgrade to create more meetings.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Something went wrong while creating the meeting.",
        });
      }
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
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-y-5"
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
              <FormLabel>Meeting URL</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Optional" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="self-center"
          disabled={createMeetingMutation.isPending}
        >
          {createMeetingMutation.isPending ? "Creating..." : "Create Meeting"}
        </Button>
      </form>
    </Form>
  );
};

const ScheduleMeetingCard = ({ date, time, roomname, guest }) => {
  const formatDate = (dateString) => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="p-4 flex flex-col gap-y-2">
      <p className="font-bold">{roomname}</p>
      <p>{formatDate(date)} at {time}</p>
      <p>Guests: {guest}</p>
    </Card>
  );
};
