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
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
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
import { useTranslation } from "react-i18next";

const SCHEDULE_PANEL_TOP_OFFSET = "80px";

const Rooms = () => {
  const { t } = useTranslation();
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
    if (
      !openAccessDialog &&
      !openLimitDialog &&
      !openBannerDialog &&
      !openTransferDialog
    ) {
      setSelectedRoomId(null);
    }
  }, [
    openDeleteDialog,
    openAccessDialog,
    openLimitDialog,
    openBannerDialog,
    openTransferDialog,
  ]);

  const handleDeleteClick = (id) => {
    setRoomIdToDelete(id);
    setOpenDeleteDialog(true);
  };

  const handleCopy = (url) => {
    const meeting_url = `${process.env.REACT_APP_BASE_BACKENED_URL}join/${url}`;
    if (meeting_url) {
      navigator.clipboard.writeText(meeting_url);
      toast({ description: t("dashboard.copied") });
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
      const meetingUrl = res?.data?.url;
      if (!meetingUrl) {
        toast({
          variant: "destructive",
          description: t("rooms.meetingStartedNoUrl"),
        });
        return;
      }

      toast({ description: t("rooms.meetingStartedSuccess") });
      window.open(meetingUrl, "_blank");
    },
  });

  const manageAccessCodeMutation = useMutation({
    mutationFn: manageAccessCode,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: t("rooms.accessCodeUpdatedSuccess") });
    },
  });

  const limitUserMutation = useMutation({
    mutationFn: limitUser,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: t("rooms.userLimitUpdatedSuccess") });
    },
  });

  const bannerUploadMutation = useMutation({
    mutationFn: bannerUpload,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: t("rooms.bannerUploadedSuccess") });
    },
  });

  const transferRoomMutation = useMutation({
    mutationFn: transferRoom,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
      toast({ description: t("rooms.roomTransferredSuccess") });
    },
  });

  if (roomQuery.isLoading || meetingQuery.isLoading)
    return (
      <div className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  if (roomQuery.isError || meetingQuery.isError) {
    return (
      <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Card className="p-6">
          <p className="font-medium">{t("rooms.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("rooms.loadErrorDescription")}
          </p>
        </Card>
      </section>
    );
  }

  const roomsData = roomQuery.data ?? {};
  const meetingData = meetingQuery.data ?? {};
  const rooms = Array.isArray(roomsData.rooms) ? roomsData.rooms : [];
  const scheduledMeetings = Array.isArray(meetingData.data)
    ? meetingData.data
    : [];
  const totalRooms =
    Number.isFinite(Number(roomsData.total_rooms)) &&
    Number(roomsData.total_rooms) >= 0
      ? Number(roomsData.total_rooms)
      : rooms.length;
  const activeRooms =
    Number.isFinite(Number(roomsData.active_rooms)) &&
    Number(roomsData.active_rooms) >= 0
      ? Number(roomsData.active_rooms)
      : 0;
  const inactiveRooms = Math.max(0, totalRooms - activeRooms);

  return (
    <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Card className="w-full min-h-full relative">
          <div className="py-5 flex flex-col gap-3 sm:flex-row sm:gap-x-4">
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus /> {t("rooms.createRoom")}
              </Button>
            </DialogTrigger>
            <Button
              className="w-full sm:w-auto bg-[#E7F0FF] border border-[#2D8CFF] text-[#2D8CFF]"
              onClick={() => {
                setOpenScheduleDialog(true);
              }}
            >
              <Plus /> {t("rooms.scheduleMeeting")}
            </Button>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 p-4 pt-6 lg:flex lg:items-center lg:justify-between lg:gap-x-4 lg:pt-10">
            <StatCard
              value={totalRooms}
              name={t("rooms.totalRoom")}
              icon={roomsIcon}
              className="w-full min-w-0 lg:w-[240px]"
            />
            <Separator
              orientation="vertical"
              className="hidden h-[50px] lg:block"
            />
            <StatCard
              value={activeRooms}
              name={t("rooms.activeRoom")}
              icon={activeIcon}
              className="w-full min-w-0 lg:w-[240px]"
            />
            <Separator
              orientation="vertical"
              className="hidden h-[50px] lg:block"
            />
            <StatCard
              value={scheduledMeetings.length}
              name={t("rooms.scheduledRoom")}
              icon={scheduledIcon}
              onIconClick={() => setOpenScheduleSide(true)}
              iconButtonLabel={t("rooms.scheduledMeetings")}
              className="w-full min-w-0 lg:w-[240px]"
            />

            <Separator
              orientation="vertical"
              className="hidden h-[50px] lg:block"
            />
            <StatCard
              value={inactiveRooms}
              name={t("rooms.inactiveRoom")}
              icon={inactiveIcon}
              className="w-full min-w-0 lg:w-[240px]"
            />
          </div>
          <Separator />
          <Table className="min-w-[980px] lg:min-w-0">
            <TableHeader>
            <TableRow>
                <TableHead>{t("rooms.name").toUpperCase()}</TableHead>
                <TableHead className="whitespace-nowrap">
                  {t("rooms.roomUrl").toUpperCase()}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <div className="flex justify-between">
                    <p>{t("rooms.actionsHeader").toUpperCase()}</p>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map(({ name, url, id }) => (
                <TableRow key={id}>
                  <TableCell>{name}</TableCell>
                  <TableCell className="whitespace-nowrap">{`${process.env.REACT_APP_BASE_BACKENED_URL}join/${url}`}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-2 md:flex-wrap lg:flex-nowrap">
                      <Button variant="outline" onClick={() => handleCopy(url)}>
                        {t("rooms.copyLink")}
                      </Button>
                      {/*<Button*/}
                      {/*  variant="outline"*/}
                      {/*  onClick={() => {*/}
                      {/*    if (accesscode) {*/}
                      {/*      navigator.clipboard.writeText(accesscode);*/}
                      {/*      toast({ description: "Access code copied to clipboard" });*/}
                      {/*    } else {*/}
                      {/*      toast({ description: "No access code available for this room" });*/}
                      {/*    }*/}
                      {/*  }}*/}
                      {/*>*/}
                      {/*  Copy Access Code*/}
                      {/*</Button>*/}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center px-4 border rounded-full whitespace-nowrap text-sm font-medium">
                          {t("rooms.manage")}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenAccessDialog(true);
                            }}
                          >
                            {t("rooms.accessCode")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenLimitDialog(true);
                            }}
                          >
                            {t("rooms.userLimit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenBannerDialog(true);
                            }}
                          >
                            {t("rooms.bannerUpload")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoomId(id);
                              setOpenTransferDialog(true);
                            }}
                          >
                            {t("rooms.transferRoom")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        disabled={startMeetingMutation.isPending}
                        onClick={() => startMeetingMutation.mutate(id)}
                      >
                        {t("rooms.startMeeting")}
                      </Button>
                      <Button
                        disabled={deleteMeetingMutation.isPending}
                        variant="destructive"
                        onClick={() => handleDeleteClick(id)}
                      >
                        {t("actions.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        {rooms.length === 0 && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
              <p>{t("generic.tableEmpty")}</p>
            </div>
        )}
      </Card>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-2xl lg:w-1/2">
          <DialogTitle>{t("rooms.createRoomTitle")}</DialogTitle>
          <DialogDescription>
            {t("rooms.createRoomDescription")}
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

      {/* Delete Prompt */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-xl lg:w-1/2">
          <DialogTitle>{t("rooms.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("rooms.deleteDescription")}
          </DialogDescription>
          <div className="flex gap-x-4">
            <Button variant="outline" onClick={() => setOpenDeleteDialog(false)}>
              {t("actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMeetingMutation.mutate(roomIdToDelete);
                setOpenDeleteDialog(false);
              }}
            >
              {t("actions.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule */}
      <Dialog open={openScheduleDialog} onOpenChange={setOpenScheduleDialog}>
        <DialogContent className="top-[50%] h-[90%] w-[calc(100%-2rem)] overflow-y-scroll md:w-[calc(100%-4rem)] md:max-w-3xl lg:w-[50%]">
          <DialogTitle>{t("rooms.scheduleTitle")}</DialogTitle>
          <DialogDescription>
            {t("rooms.scheduleDescription")}
          </DialogDescription>
          <MeetingForm setOpenDialog={setOpenScheduleDialog} />
        </DialogContent>
      </Dialog>

      {/* Scheduled Rooms */}
      <Sheet open={openScheduledSide} onOpenChange={setOpenScheduleSide}>
        <SheetContent
          side="right"
          className="flex w-full max-w-[min(32rem,100vw)] flex-col overflow-hidden px-4 sm:px-6"
          style={{
            top: SCHEDULE_PANEL_TOP_OFFSET,
            bottom: "auto",
            height: `calc(100svh - ${SCHEDULE_PANEL_TOP_OFFSET})`,
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("rooms.scheduledMeetings")}</SheetTitle>
            <SheetDescription>
              {t("rooms.scheduledMeetingsDescription")}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-y-3 overflow-y-auto overflow-x-hidden pb-12 pr-1 sm:pr-2">
            {scheduledMeetings.map(({ date, time, roomname, guest }) => (
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
  const { t } = useTranslation();
  const formSchema = z.object({
    type: z.enum(["auto", "manual", "remove"]),
    accesscode: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "auto", accesscode: "" },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: String(roomId), ...data }); // ✅ cast id to string
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md lg:w-1/3">
        <DialogTitle>{t("rooms.manageAccessCodeTitle")}</DialogTitle>
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
                  <FormLabel>{t("rooms.typeLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("rooms.typePlaceholder")} />
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
                  <FormLabel>{t("rooms.accessCodeManualLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">{t("actions.save")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const LimitUserDialog = ({ open, setOpen, roomId, mutation }) => {
  const { t } = useTranslation();
  const formSchema = z.object({
    users: z.string().min(1, t("generic.required")),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { users: "" },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: String(roomId), ...data }); // ✅ cast id to string
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md lg:w-1/3">
        <DialogTitle>{t("rooms.limitUsersTitle")}</DialogTitle>
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
                  <FormLabel>{t("rooms.userLimitLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">{t("actions.save")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const BannerUploadDialog = ({ open, setOpen, roomId, mutation }) => {
  const { t } = useTranslation();
  const formSchema = z.object({
    banner: z.any(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { banner: null },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: String(roomId), banner: data.banner[0] }); // ✅ cast id to string
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md lg:w-1/3">
        <DialogTitle>{t("rooms.uploadRoomBannerTitle")}</DialogTitle>
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
                  <FormLabel>{t("rooms.selectBanner")}</FormLabel>
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
            <Button type="submit">{t("actions.upload")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const TransferRoomDialog = ({ open, setOpen, roomId, mutation }) => {
  const { t } = useTranslation();
  const formSchema = z.object({
    email: z.string().email(t("auth.validation.invalidEmail")),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data) => {
    mutation.mutate({ id: String(roomId), ...data });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md lg:w-1/3">
        <DialogTitle>{t("rooms.transferRoomTitle")}</DialogTitle>
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
                  <FormLabel>{t("rooms.newOwnerEmail")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">{t("actions.transfer")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- Existing Create Meeting + Schedule ---------------- */

const CreateMeetingDialog = ({ setOpenDialog }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: (res) => {
      setOpenDialog(false);
      if (res?.success) {
        queryClient.invalidateQueries(["rooms"]);
        toast({ description: t("rooms.meetingCreatedSuccess") });
      } else {
        if (res.message?.includes("Maximum room")) {
          toast({
            variant: "destructive",
            title: t("rooms.planLimitReached"),
            description: t("rooms.planLimitDescription"),
          });
        } else {
          toast({
            variant: "destructive",
            title: t("rooms.errorTitle"),
            description: res?.message,
          });
        }
      }
    },
    onError: (error) => {
      if (error.response?.data?.message?.includes("maximum room")) {
        toast({
          variant: "destructive",
          title: t("rooms.planLimitReached"),
          description: t("rooms.planLimitDescriptionShort"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("rooms.errorTitle"),
          description: t("rooms.createMeetingError"),
        });
      }
    },
  });

  const formSchema = z.object({
    name: z
      .string()
      .min(5, {
        message: t("rooms.roomNameMin"),
      })
      .refine((value) => value.trim().length > 0, {
        message: t("rooms.roomNameRequired"),
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
              <FormLabel>{t("rooms.roomName")}</FormLabel>
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
              <FormLabel>{t("rooms.roomUrlField")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("generic.optional")} />
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
          {createMeetingMutation.isPending
            ? t("rooms.creating")
            : t("rooms.createRoom")}
        </Button>
      </form>
    </Form>
  );
};

const ScheduleMeetingCard = ({ date, time, roomname, guest }) => {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const guestList = String(guest ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  const previewGuests =
    guestList.length > 0
      ? `${guestList[0]}${
          guestList.length > 1 ? `, +${guestList.length - 1} more` : ""
        }`
      : t("generic.notAvailable");

  const formatDate = (dateString) => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card
      className="min-w-0 cursor-pointer overflow-hidden p-0 transition-colors hover:border-border/80"
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => setIsExpanded((prev) => !prev)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setIsExpanded((prev) => !prev);
        }
      }}
    >
      <div className="flex min-w-0 items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-y-2">
            <p className="break-words font-bold">{roomname}</p>
            <p className="break-words text-sm text-muted-foreground">
              {t("rooms.scheduledAt", { date: formatDate(date), time })}
            </p>
            <p className="break-all text-sm text-muted-foreground">
              {t("rooms.guests", { guest: previewGuests })}
            </p>
          </div>

          {isExpanded && (
            <div className="mt-4 border-t border-border/70 pt-3">
              <p className="text-sm font-medium text-foreground">
                {t("rooms.guests", { guest: guestList.length })}
              </p>
              <div className="mt-2 flex flex-col gap-y-2">
                {guestList.length > 0 ? (
                  guestList.map((email, index) => (
                    <p
                      key={`${email}-${index}`}
                      className="break-all text-sm text-muted-foreground"
                    >
                      {email}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("generic.notAvailable")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-0.5 shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>
    </Card>
  );
};
