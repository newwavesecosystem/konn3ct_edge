import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { 
  Video, Plus, Copy, MoreVertical, Users, Globe, Lock, Trash2, ExternalLink, LockKeyhole, ChevronDown, ChevronUp 
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  createMeeting, deleteRoom, getMeetings, getRooms, startMeeting, manageAccessCode, limitUser, bannerUpload, transferRoom,
} from "../api/roomsApi";
import {
  Dialog, DialogContent, DialogTrigger, DialogDescription, DialogTitle,
} from "../components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "../components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../hooks/use-toast";
import { Skeleton } from "../components/ui/skeleton";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "../components/ui/sheet";
import { Tooltip as ReactTooltip } from "react-tooltip";

const SCHEDULE_PANEL_TOP_OFFSET = "80px";
const ROOM_ACCESS_CODE_STORAGE_KEY = "room-access-code-map";
const ROOM_LOCK_TOOLTIP_ID = "room-lock-tooltip";

const readStoredRoomAccessCodes = () => {
  try {
    const raw = localStorage.getItem(ROOM_ACCESS_CODE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};

const writeStoredRoomAccessCodes = (value) => {
  try {
    localStorage.setItem(ROOM_ACCESS_CODE_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    // Ignore storage failures
  }
};

const meetingHasAccessCode = (meeting) =>
  Boolean(
    meeting?.accesscode ?? meeting?.accessCode ?? meeting?.access_code ?? meeting?.room_accesscode ?? meeting?.roomAccessCode
  );

const getRoomAccessCodeValue = (room, storedAccessCodes = {}) =>
  room?.accesscode ?? room?.accessCode ?? room?.access_code ?? storedAccessCodes[String(room?.id)] ?? "";

const updateRoomAccessCodeCache = (queryClient, roomId, nextAccessCode) => {
  queryClient.setQueryData(["rooms"], (previousData) => {
    if (!previousData || !Array.isArray(previousData.rooms)) return previousData;
    return {
      ...previousData,
      rooms: previousData.rooms.map((room) =>
        String(room.id) === String(roomId) ? { ...room, accesscode: nextAccessCode } : room
      ),
    };
  });
};

const Rooms = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const roomQuery = useQuery({ queryKey: ["rooms"], queryFn: getRooms });
  const meetingQuery = useQuery({ queryKey: ["meetings"], queryFn: getMeetings });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [roomIdToDelete, setRoomIdToDelete] = useState(null);
  const [openScheduledSide, setOpenScheduleSide] = useState(false);
  
  // Dropdown states for cards
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Manage dialogs
  const [openAccessDialog, setOpenAccessDialog] = useState(false);
  const [openLimitDialog, setOpenLimitDialog] = useState(false);
  const [openBannerDialog, setOpenBannerDialog] = useState(false);
  const [openTransferDialog, setOpenTransferDialog] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [storedRoomAccessCodes, setStoredRoomAccessCodes] = useState(() => readStoredRoomAccessCodes());

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
      toast({ description: t("rooms.toasts.linkCopied") });
    }
  };

  const deleteMeetingMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => { queryClient.invalidateQueries(["rooms"]); },
  });

  const startMeetingMutation = useMutation({
    mutationFn: startMeeting,
    onSuccess: (res, id) => {
      const meetingUrl = res?.data?.url;
      if (!meetingUrl) {
        toast({ variant: "destructive", description: t("rooms.toasts.meetingStartedMissingUrl") });
        return;
      }
      toast({ description: t("rooms.toasts.meetingStarted") });
      window.open(meetingUrl, "_blank");
    },
  });

  const manageAccessCodeMutation = useMutation({
    mutationFn: manageAccessCode,
    onSuccess: (_response, variables) => {
      const roomId = String(variables.id);
      const nextAccessCode = variables.type === "remove" ? "" : variables.accesscode?.trim() || "__LOCKED__";
      updateRoomAccessCodeCache(queryClient, roomId, nextAccessCode);
      setStoredRoomAccessCodes((previousValue) => {
        const nextValue = { ...previousValue };
        if (variables.type === "remove") delete nextValue[roomId];
        else nextValue[roomId] = nextAccessCode;
        writeStoredRoomAccessCodes(nextValue);
        return nextValue;
      });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ description: t("rooms.toasts.accessCodeUpdated") });
    },
  });

  const limitUserMutation = useMutation({
    mutationFn: limitUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ description: t("rooms.toasts.userLimitUpdated") });
    },
  });

  const bannerUploadMutation = useMutation({
    mutationFn: bannerUpload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ description: t("rooms.toasts.bannerUploaded") });
    },
  });

  const transferRoomMutation = useMutation({
    mutationFn: transferRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ description: t("rooms.toasts.roomTransferred") });
    },
  });

  if (roomQuery.isLoading || meetingQuery.isLoading)
    return <div className="p-6"><Skeleton className="w-full h-[500px] rounded-2xl" /></div>;

  if (roomQuery.isError || meetingQuery.isError) {
    return (
      <section className="p-6">
        <Card className="p-6 rounded-2xl">
          <p className="font-medium">{t("rooms.states.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("rooms.states.loadErrorDescription")}</p>
        </Card>
      </section>
    );
  }

  const roomsData = roomQuery.data ?? {};
  const meetingData = meetingQuery.data ?? [];
  const rooms = Array.isArray(roomsData.rooms) ? roomsData.rooms : [];
  const scheduledMeetings = Array.isArray(meetingData) ? meetingData : [];
  const totalRooms = Number.isFinite(Number(roomsData.total_rooms)) && Number(roomsData.total_rooms) >= 0 ? Number(roomsData.total_rooms) : rooms.length;
  const activeRooms = Number.isFinite(Number(roomsData.active_rooms)) && Number(roomsData.active_rooms) >= 0 ? Number(roomsData.active_rooms) : 0;
  const inactiveRooms = Math.max(0, totalRooms - activeRooms);

  const colors = [
    "from-brand-blue to-blue-500",
    "from-brand-green to-emerald-400",
    "from-amber-500 to-orange-400",
    "from-purple-500 to-pink-400"
  ];

  return (
    <div className="flex flex-col gap-8 pb-10 px-4 sm:px-6 lg:px-[33px] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Rooms</h1>
          <p className="text-muted-foreground mt-1">Create and manage your meeting rooms.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button 
            variant="outline"
            className="h-11 rounded-xl px-5 border-border/60 bg-surface flex-1 sm:flex-none hover:bg-black/[0.02]"
            onClick={() => navigate("/dashboard/schedule/new")}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("rooms.actions.scheduleMeeting")}
          </Button>
          <Button 
            className="h-11 rounded-xl px-5 bg-brand-green hover:bg-[#287854] text-white shadow-lg shadow-brand-green/20 transition-all flex-1 sm:flex-none"
            onClick={() => navigate("/dashboard/rooms/new")}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("rooms.actions.createRoom")}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10">
            <Video className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalRooms}</p>
            <p className="text-xs text-muted-foreground">{t("rooms.stats.totalRoom", "Total Rooms")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10">
            <Users className="h-5 w-5 text-brand-green" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{activeRooms}</p>
            <p className="text-xs text-muted-foreground">{t("rooms.stats.activeRoom", "Active Rooms")}</p>
          </div>
        </div>
        <div 
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4 cursor-pointer hover:border-border transition-colors"
          onClick={() => setOpenScheduleSide(true)}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Globe className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{scheduledMeetings.length}</p>
            <p className="text-xs text-muted-foreground">{t("rooms.stats.scheduledRoom", "Scheduled Rooms")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
            <Lock className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{inactiveRooms}</p>
            <p className="text-xs text-muted-foreground">{t("rooms.stats.inactiveRoom", "Inactive Rooms")}</p>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room, index) => {
          const roomAccessCode = getRoomAccessCodeValue(room, storedRoomAccessCodes);
          const isLocked = Boolean(roomAccessCode);
          const color = colors[index % colors.length];

          return (
            <Card key={room.id} className="rounded-2xl border-border/60 bg-surface hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300 group relative">
              <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${color}`} />
              <CardContent className="p-5 space-y-4">
                {/* Title Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-sm`}>
                      <Video className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{room.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">/{room.url}</p>
                    </div>
                  </div>
                  
                  {/* Dropdown Menu */}
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === room.id ? null : room.id);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/[0.04] text-muted-foreground transition-all ${openDropdownId === room.id ? 'opacity-100 bg-black/[0.04]' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    
                    {openDropdownId === room.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }} />
                        <div className="absolute right-0 top-8 w-48 rounded-xl border border-border/60 bg-surface shadow-lg z-50 overflow-hidden animate-in zoom-in-95 duration-150">
                          <div className="p-1.5 space-y-0.5">
                            <button onClick={() => { setSelectedRoomId(room.id); setOpenAccessDialog(true); setOpenDropdownId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-black/[0.04]">
                              <LockKeyhole className="h-4 w-4 text-muted-foreground" /> {t("rooms.manageMenu.accessCode", "Access Code")}
                            </button>
                            <button onClick={() => { setSelectedRoomId(room.id); setOpenLimitDialog(true); setOpenDropdownId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-black/[0.04]">
                              <Users className="h-4 w-4 text-muted-foreground" /> {t("rooms.manageMenu.userLimit", "User Limit")}
                            </button>
                            <button onClick={() => { setSelectedRoomId(room.id); setOpenBannerDialog(true); setOpenDropdownId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-black/[0.04]">
                              <Globe className="h-4 w-4 text-muted-foreground" /> {t("rooms.manageMenu.bannerUpload", "Banner Upload")}
                            </button>
                            <button onClick={() => { setSelectedRoomId(room.id); setOpenTransferDialog(true); setOpenDropdownId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-black/[0.04]">
                              <Users className="h-4 w-4 text-muted-foreground" /> {t("rooms.manageMenu.transferRoom", "Transfer Room")}
                            </button>
                            <div className="h-px w-full bg-border/60 my-1" />
                            <button onClick={() => { handleDeleteClick(room.id); setOpenDropdownId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10">
                              <Trash2 className="h-4 w-4" /> {t("common.actions.delete", "Delete")}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Meta Row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Live
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  {isLocked ? (
                    <span className="flex items-center gap-1 text-red-500"><Lock className="h-3 w-3" /> Locked</span>
                  ) : (
                    <span className="flex items-center gap-1 text-brand-green"><Globe className="h-3 w-3" /> Open</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground">ID: {room.id}</span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => handleCopy(room.url)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand-green/10 text-muted-foreground hover:text-brand-green transition-colors bg-black/[0.02]" 
                      title={t("rooms.actions.copyLink")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => startMeetingMutation.mutate(room.id)}
                      disabled={startMeetingMutation.isPending}
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand-blue/10 text-muted-foreground hover:text-brand-blue transition-colors bg-black/[0.02]" 
                      title={t("rooms.actions.startMeeting")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {rooms.length === 0 && (
        <div className="flex justify-center items-center h-40">
          <p className="text-muted-foreground">{t("rooms.states.noData")}</p>
        </div>
      )}

      {/* --- Modals --- */}

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md rounded-2xl">
          <DialogTitle>{t("rooms.dialogs.delete.title")}</DialogTitle>
          <DialogDescription>{t("rooms.dialogs.delete.description")}</DialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setOpenDeleteDialog(false)}>{t("common.actions.cancel")}</Button>
            <Button variant="destructive" disabled={deleteMeetingMutation.isPending} onClick={() => { deleteMeetingMutation.mutate(roomIdToDelete); setOpenDeleteDialog(false); }}>
              {t("common.actions.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Management Dialogs */}
      <AccessCodeDialog open={openAccessDialog} setOpen={setOpenAccessDialog} roomId={selectedRoomId} mutation={manageAccessCodeMutation} />
      <LimitUserDialog open={openLimitDialog} setOpen={setOpenLimitDialog} roomId={selectedRoomId} mutation={limitUserMutation} />
      <BannerUploadDialog open={openBannerDialog} setOpen={setOpenBannerDialog} roomId={selectedRoomId} mutation={bannerUploadMutation} />
      <TransferRoomDialog open={openTransferDialog} setOpen={setOpenTransferDialog} roomId={selectedRoomId} mutation={transferRoomMutation} />

      {/* Scheduled Meetings Sheet */}
      <Sheet open={openScheduledSide} onOpenChange={setOpenScheduleSide}>
        <SheetContent side="right" className="flex w-full max-w-[min(32rem,100vw)] flex-col px-4 sm:px-6" style={{ top: SCHEDULE_PANEL_TOP_OFFSET, bottom: "auto", height: `calc(100svh - ${SCHEDULE_PANEL_TOP_OFFSET})` }}>
          <SheetHeader>
            <SheetTitle>{t("rooms.scheduledSheet.title")}</SheetTitle>
            <SheetDescription>{t("rooms.scheduledSheet.description")}</SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-y-3 overflow-y-auto pb-12 pr-1 sm:pr-2">
            {scheduledMeetings.map((meeting) => (
              <ScheduleMeetingCard
                key={meeting.id ?? `${meeting.roomname}-${meeting.date}-${meeting.time}`}
                date={meeting.date} time={meeting.time} roomname={meeting.roomname} guest={meeting.guest} hasAccessCode={meetingHasAccessCode(meeting)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <ReactTooltip id={ROOM_LOCK_TOOLTIP_ID} place="top" />
    </div>
  );
};

export default Rooms;

/* ---------------- Manage Dialog Components ---------------- */

const AccessCodeDialog = ({ open, setOpen, roomId, mutation }) => {
  const { t } = useTranslation();
  const formSchema = z.object({ type: z.enum(["auto", "manual", "remove"]), accesscode: z.string().optional() });
  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: { type: "auto", accesscode: "" } });
  const onSubmit = (data) => { mutation.mutate({ id: String(roomId), ...data }); setOpen(false); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md rounded-2xl">
        <DialogTitle>{t("rooms.accessDialog.title")}</DialogTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("rooms.accessDialog.typeLabel")}</FormLabel>
                <FormControl><Input {...field} placeholder={t("rooms.accessDialog.typePlaceholder")} className="bg-black/[0.02] h-11" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="accesscode" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("rooms.accessDialog.accessCodeLabel")}</FormLabel>
                <FormControl><Input {...field} placeholder={t("rooms.accessDialog.accessCodePlaceholder")} className="bg-black/[0.02] h-11" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="self-end rounded-xl h-10 px-6 mt-2">{t("common.actions.save")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const LimitUserDialog = ({ open, setOpen, roomId, mutation }) => {
  const { t } = useTranslation();
  const formSchema = z.object({ users: z.string().min(1, t("rooms.limitDialog.validation.required")) });
  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: { users: "" } });
  const onSubmit = (data) => { mutation.mutate({ id: String(roomId), ...data }); setOpen(false); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md rounded-2xl">
        <DialogTitle>{t("rooms.limitDialog.title")}</DialogTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField control={form.control} name="users" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("rooms.limitDialog.userLimit")}</FormLabel>
                <FormControl><Input {...field} type="number" className="bg-black/[0.02] h-11" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="self-end rounded-xl h-10 px-6 mt-2">{t("common.actions.save")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const BannerUploadDialog = ({ open, setOpen, roomId, mutation }) => {
  const { t } = useTranslation();
  const formSchema = z.object({ banner: z.any() });
  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: { banner: null } });
  const onSubmit = (data) => { mutation.mutate({ id: String(roomId), banner: data.banner[0] }); setOpen(false); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md rounded-2xl">
        <DialogTitle>{t("rooms.bannerDialog.title")}</DialogTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField control={form.control} name="banner" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("rooms.bannerDialog.selectBanner")}</FormLabel>
                <FormControl>
                  <Input type="file" accept="image/*" className="h-11 bg-black/[0.02] cursor-pointer" onChange={(e) => field.onChange(e.target.files)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="self-end rounded-xl h-10 px-6 mt-2">{t("common.actions.upload")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const TransferRoomDialog = ({ open, setOpen, roomId, mutation }) => {
  const { t } = useTranslation();
  const formSchema = z.object({ email: z.string().email(t("rooms.transferDialog.validation.email")) });
  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: { email: "" } });
  const onSubmit = (data) => { mutation.mutate({ id: String(roomId), ...data }); setOpen(false); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md rounded-2xl">
        <DialogTitle>{t("rooms.transferDialog.title")}</DialogTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("rooms.transferDialog.newOwnerEmail")}</FormLabel>
                <FormControl><Input {...field} placeholder={t("rooms.transferDialog.newOwnerEmailPlaceholder")} className="bg-black/[0.02] h-11" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="self-end rounded-xl h-10 px-6 mt-2">{t("common.actions.transfer")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- Schedule Card ---------------- */

const ScheduleMeetingCard = ({ date, time, roomname, guest, hasAccessCode }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const guestList = String(guest ?? "").split(",").map((email) => email.trim()).filter(Boolean);
  const previewGuests = guestList.length > 0 ? `${guestList[0]}${guestList.length > 1 ? t("rooms.scheduledCard.moreGuests", { count: guestList.length - 1 }) : ""}` : t("rooms.scheduledCard.notAvailable");

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <Card className="min-w-0 cursor-pointer overflow-hidden p-0 transition-colors border-border/60 hover:border-border rounded-xl bg-surface" onClick={() => setIsExpanded((prev) => !prev)}>
      <div className="flex min-w-0 items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-y-1">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="break-words font-bold text-foreground text-sm">{roomname}</p>
              {hasAccessCode && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500" title={t("rooms.tooltips.meetingHasAccessCode")}>
                  <LockKeyhole className="h-3 w-3" /> Locked
                </span>
              )}
            </div>
            <p className="break-words text-[11px] text-muted-foreground">{t("rooms.scheduledCard.dateTime", { date: formatDate(date), time })}</p>
            <p className="break-all text-[11px] text-muted-foreground mt-1">{t("rooms.scheduledCard.guestsPreview", { guests: previewGuests })}</p>
          </div>
          {isExpanded && (
            <div className="mt-3 border-t border-border/40 pt-3">
              <p className="text-xs font-semibold text-foreground">{t("rooms.scheduledCard.guestCount", { count: guestList.length })}</p>
              <div className="mt-1.5 flex flex-col gap-y-1">
                {guestList.length > 0 ? guestList.map((email, index) => (
                  <p key={`${email}-${index}`} className="break-all text-[11px] text-muted-foreground">{email}</p>
                )) : (
                  <p className="text-[11px] text-muted-foreground">{t("rooms.scheduledCard.notAvailable")}</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
    </Card>
  );
};
