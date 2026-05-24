import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import {
  Plus, Cast, Radio, Clock, Calendar, Check, ChevronsUpDown, StopCircle, PlayCircle, Globe, Video
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStreams,
  startStream,
  stopStreaming,
  getRooms,
  startComboStreaming,
} from "../api/streamApi";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { cn, formatDate } from "../lib/utils";
import { useToast } from "../hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "../components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { z } from "zod";
import { Skeleton } from "../components/ui/skeleton";

const Streaming = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const streamQuery = useQuery({
    queryKey: ["streams", { page }],
    queryFn: () => getStreams(page),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    refetchInterval: (query) => {
      const streamRows = query.state.data?.data;
      if (!Array.isArray(streamRows)) return 15_000;
      return streamRows.some((stream) => stream.status === 1) ? 15_000 : false;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const stopStreamMutation = useMutation({
    mutationFn: stopStreaming,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] });
      toast({ description: t("streaming.toasts.ended") });
    },
  });

  if (streamQuery.isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="w-full h-[500px] rounded-2xl" />
      </div>
    );
  }

  if (streamQuery.isError) {
    return (
      <section className="p-6">
        <Card className="p-6 rounded-2xl">
          <p className="font-medium">{t("streaming.states.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("streaming.states.loadErrorDescription")}
          </p>
        </Card>
      </section>
    );
  }

  const streamData = streamQuery.data ?? {};
  const streamRows = Array.isArray(streamData.data) ? streamData.data : [];
  const currentPage =
    Number.isFinite(Number(streamData.current_page)) &&
    Number(streamData.current_page) > 0
      ? Number(streamData.current_page)
      : 1;
  const lastPage =
    Number.isFinite(Number(streamData.last_page)) &&
    Number(streamData.last_page) > 0
      ? Number(streamData.last_page)
      : 1;

  const totalStreams = streamData.total ?? streamRows.length;
  const activeStreams = streamRows.filter((s) => s.status === 1).length;

  return (
    <div className="flex flex-col gap-8 pb-10 px-4 sm:px-6 lg:px-[33px] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Live Streams</h1>
          <p className="text-muted-foreground mt-1">Manage and broadcast your live sessions to external platforms.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button 
            className="h-11 rounded-xl px-5 bg-brand-blue hover:bg-[#0047E1] text-white shadow-lg shadow-brand-blue/20 transition-all flex-1 sm:flex-none"
            onClick={() => setOpenDialog(true)}
          >
            <Cast className="w-4 h-4 mr-2" />
            {t("streaming.actions.stream")}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10">
            <Radio className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalStreams}</p>
            <p className="text-xs text-muted-foreground">{t("streaming.stats.totalStreams")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10">
            <PlayCircle className="h-5 w-5 text-brand-green" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{activeStreams}</p>
            <p className="text-xs text-muted-foreground">{t("streaming.stats.activeStreams")}</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {streamRows.map((stream) => {
          const isRunning = stream.status === 1;
          const colorClass = isRunning ? "from-brand-green to-emerald-400" : "from-gray-400 to-gray-500";
          const iconBg = isRunning ? "bg-brand-green" : "bg-gray-400";
          
          let PlatformIcon = Globe;
          if (stream.type === "Youtube") PlatformIcon = Video;
          else if (stream.type === "Facebook") PlatformIcon = Cast;
          else if (stream.type === "Combo") PlatformIcon = Radio;

          return (
            <Card key={stream.id + stream.created_at} className="rounded-2xl border-border/60 bg-surface hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300 relative group overflow-hidden">
              <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${colorClass}`} />
              <CardContent className="p-5 flex flex-col h-full">
                {/* Top Section */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} shadow-sm`}>
                      <PlatformIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate" title={stream.room?.name}>
                        {stream.room?.name ?? t("streaming.states.temporaryRoom")}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{stream.type}</p>
                    </div>
                  </div>
                  <Badge variant={isRunning ? "default" : "secondary"} className={cn("px-2 py-0.5 text-[10px] font-bold rounded-md", isRunning ? "bg-brand-green/10 text-brand-green hover:bg-brand-green/20" : "")}>
                    {isRunning ? t("streaming.status.running") : t("streaming.status.ended")}
                  </Badge>
                </div>

                {/* Meta Information */}
                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center text-xs text-muted-foreground gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{t("streaming.table.startedAt")}: <span className="text-foreground">{formatDate(stream.created_at)}</span></span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t("streaming.table.endedAt")}: <span className="text-foreground">{stream.ended_at ? formatDate(stream.ended_at) : "---"}</span></span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-border/40 mt-auto">
                  {isRunning ? (
                    <Button
                      variant="destructive"
                      className="w-full h-9 text-xs rounded-lg font-bold"
                      onClick={() => stopStreamMutation.mutate(stream.id)}
                      disabled={stopStreamMutation.isPending}
                    >
                      <StopCircle className="w-3.5 h-3.5 mr-2" />
                      {t("streaming.actions.stopStreaming")}
                    </Button>
                  ) : (
                    <div className="w-full h-9 flex items-center justify-center bg-black/[0.02] rounded-lg text-xs font-semibold text-muted-foreground">
                      Stream Ended
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {streamRows.length === 0 && (
        <div className="flex justify-center items-center h-40">
          <p className="text-muted-foreground">{t("streaming.states.noData")}</p>
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <Pagination className="mt-6 flex justify-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={streamData.prev_page_url === null || currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="cursor-pointer"
              />
            </PaginationItem>
            <PaginationItem className="px-2 text-sm sm:hidden">
              {currentPage} / {lastPage}
            </PaginationItem>
            {Array.from({ length: lastPage }, (_, i) => 1 + i).map((index) => (
              <PaginationItem key={`page-${index}`} className="hidden sm:block">
                <PaginationLink
                  isActive={index === currentPage}
                  onClick={() => setPage(index)}
                  className="cursor-pointer"
                >
                  {index}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                disabled={streamData.next_page_url == null || currentPage >= lastPage}
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                className="cursor-pointer"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-xl rounded-2xl">
          <DialogTitle>{t("streaming.dialog.title")}</DialogTitle>
          <DialogDescription>{t("streaming.dialog.description")}</DialogDescription>
          <StreamForm setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Streaming;

const StreamForm = ({ setOpenDialog }) => {
  const { t } = useTranslation();
  const [openPopover, setOpenPopover] = useState(false);
  const { toast } = useToast();
  const [rooms, setRooms] = useState([]);
  const [roomLoading, setRoomLoading] = useState(true);

  const queryClient = useQueryClient();

  const types = [
    { value: "Youtube", label: t("streaming.form.types.youtube") },
    { value: "Facebook", label: t("streaming.form.types.facebook") },
    { value: "Combo", label: t("streaming.form.types.combo") },
  ];

  useEffect(() => {
    let cancelled = false;
    const loadRooms = async () => {
      try {
        const res = await getRooms();
        let list = res;
        if (!Array.isArray(list)) {
          if (list && typeof list === "object") {
            if (Array.isArray(list.data)) list = list.data;
            else if (Array.isArray(list.rooms)) list = list.rooms;
            else {
              const values = Object.values(list).filter((v) => Array.isArray(v));
              list = values.length > 0 ? values[0] : [];
            }
          } else list = [];
        }
        if (!cancelled) setRooms(list);
      } catch (err) {
        console.error("Failed to load rooms:", err);
        setRooms([]);
      } finally {
        if (!cancelled) setRoomLoading(false);
      }
    };
    loadRooms();
    return () => { cancelled = true; };
  }, []);

  const startStreamMutation = useMutation({
    mutationFn: startStream,
    onSuccess: (res) => {
      toast({ description: res.message || t("streaming.toasts.started") });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });

  const startComboMutation = useMutation({
    mutationFn: startComboStreaming,
    onSuccess: (res) => {
      toast({ description: res.message || t("streaming.toasts.comboStarted") });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });

  const formSchema = z.object({
    room_id: z.string().nonempty({ message: t("streaming.form.validation.roomRequired") }),
    type: z.enum(["Youtube", "Facebook", "Combo"], { message: t("streaming.form.validation.typeInvalid") }),
    key: z.string().optional(),
    youtube_key: z.string().optional(),
    facebook_key: z.string().optional(),
  }).superRefine((values, ctx) => {
    if (values.type === "Combo") {
      if (!values.youtube_key || values.youtube_key.trim() === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("streaming.form.validation.youtubeKeyRequired"), path: ["youtube_key"] });
      }
      if (!values.facebook_key || values.facebook_key.trim() === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("streaming.form.validation.facebookKeyRequired"), path: ["facebook_key"] });
      }
    } else {
      if (!values.key || values.key.trim() === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("streaming.form.validation.keyRequired"), path: ["key"] });
      }
    }
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { room_id: "", type: "Youtube", key: "", youtube_key: "", facebook_key: "" },
  });

  const selectedType = form.watch("type");

  const onSubmit = (data) => {
    if (data.type === "Combo") {
      startComboMutation.mutate({ room_id: data.room_id, youtube_key: data.youtube_key, facebook_key: data.facebook_key });
    } else {
      startStreamMutation.mutate({ room_id: data.room_id, type: data.type, key: data.key });
    }
    setOpenDialog(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
        <FormField control={form.control} name="room_id" render={({ field }) => (
          <FormItem>
            <label className="text-sm font-semibold text-foreground">{t("streaming.form.selectRoom")}</label>
            <FormControl>
              <select
                {...field} disabled={roomLoading}
                className="w-full h-11 rounded-xl border border-border/60 bg-black/[0.02] px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30"
              >
                <option value="">{roomLoading ? t("streaming.form.loadingRooms") : t("streaming.form.selectRoom")}</option>
                {Array.isArray(rooms) && rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.room_name || room.name || room.label || `Room ${room.id}`}</option>
                ))}
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <label className="text-sm font-semibold text-foreground">{t("streaming.form.type")}</label>
            <FormControl>
              <Popover open={openPopover} onOpenChange={setOpenPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openPopover} className="w-full h-11 justify-between bg-black/[0.02] border-border/60">
                    {field.value ? types.find((t) => t.value === field.value)?.label : t("streaming.form.selectType")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 max-w-[calc(100vw-2rem)] lg:!w-[300px]">
                  <Command>
                    <CommandInput placeholder={t("streaming.form.searchType")} />
                    <CommandList>
                      <CommandEmpty>{t("streaming.form.noTypeFound")}</CommandEmpty>
                      <CommandGroup>
                        {types.map((type) => (
                          <CommandItem key={type.value} value={type.value} onSelect={() => { field.onChange(type.value); setOpenPopover(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", field.value === type.value ? "opacity-100 text-brand-green" : "opacity-0")} />
                            {type.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {selectedType === "Combo" ? (
          <>
            <FormField control={form.control} name="youtube_key" render={({ field }) => (
              <FormItem>
                <label className="text-sm font-semibold text-foreground">{t("streaming.form.youtubeKey")}</label>
                <FormControl><Input placeholder={t("streaming.form.enterYouTubeKey")} className="h-11 bg-black/[0.02]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="facebook_key" render={({ field }) => (
              <FormItem>
                <label className="text-sm font-semibold text-foreground">{t("streaming.form.facebookKey")}</label>
                <FormControl><Input placeholder={t("streaming.form.enterFacebookKey")} className="h-11 bg-black/[0.02]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </>
        ) : (
          <FormField control={form.control} name="key" render={({ field }) => (
            <FormItem>
              <label className="text-sm font-semibold text-foreground">{t("streaming.form.key")}</label>
              <FormControl><Input placeholder={t("streaming.form.enterKey")} className="h-11 bg-black/[0.02]" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <Button type="submit" className="w-full h-11 rounded-xl bg-brand-blue hover:bg-[#0047E1] text-white shadow-lg mt-2" disabled={startStreamMutation.isPending || startComboMutation.isPending}>
          {startStreamMutation.isPending || startComboMutation.isPending ? "Starting..." : t("streaming.actions.submit")}
        </Button>
      </form>
    </Form>
  );
};
