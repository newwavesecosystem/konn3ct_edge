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
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStreams,
  startStream,
  stopStreaming,
  getRooms,
  startComboStreaming, // ✅ NEW
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
import { Input } from "../components/ui/input";
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
import { useTranslation } from "react-i18next";

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
    // Poll only while streams are actively running to avoid request spam.
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
      toast({ description: t("streams.streamingEndedSuccess") });
    },
  });

  if (streamQuery.isLoading)
    return (
      <div className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  if (streamQuery.isError) {
    return (
      <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Card className="p-6">
          <p className="font-medium">{t("streams.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("streams.loadErrorDescription")}
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

  return (
    <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
      <Card className="relative w-full min-h-full pb-6 lg:pb-16">
        <div className="flex flex-col gap-4 p-4 pt-6 lg:flex-row lg:items-center lg:gap-20 lg:pt-10">
          <Button className="w-full sm:w-auto" onClick={() => setOpenDialog(true)}>
            <Plus /> {t("streams.stream")}
          </Button>

          <StatCard
            value={streamData.total ?? streamRows.length}
            name={t("streams.totalStreams")}
            icon={roomsIcon}
          />

          <Separator orientation="vertical" className="hidden h-[50px] lg:block" />

          <StatCard
            value={
              streamRows.filter((stream) => stream.status === 1).length
            }
            name={t("streams.activeStreams")}
            icon={activeIcon}
          />
        </div>

        <Separator />

        <Table className="min-w-[780px] lg:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="">{t("streams.number")}</TableHead>
              <TableHead>{t("streams.roomName")}</TableHead>
              <TableHead>{t("streams.type")}</TableHead>
              <TableHead className="text-center">{t("streams.status")}</TableHead>
              <TableHead>{t("streams.startedAt")}</TableHead>
              <TableHead>{t("streams.endedAt")}</TableHead>
              <TableHead>{t("streams.action")}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {streamRows.map(
              ({ room, id, type, status, created_at, ended_at }) => (
                <TableRow key={id + created_at}>
                  <TableCell>{id}</TableCell>
                  <TableCell>{room?.name ?? t("streams.temporaryRoom")}</TableCell>
                  <TableCell>{type}</TableCell>

                  <TableCell className="text-center">
                    <Badge variant={status === 1 ? "" : "destructive"}>
                      {status === 1 ? t("streams.running") : t("streams.ended")}
                    </Badge>
                  </TableCell>

                  <TableCell>{formatDate(created_at)}</TableCell>

                  <TableCell>
                    {ended_at === null ? (
                      <Badge>{t("streams.running")}</Badge>
                    ) : (
                      formatDate(ended_at)
                    )}
                  </TableCell>

                  {status === 1 && (
                    <TableCell>
                      <Button
                        className="whitespace-nowrap"
                        variant="destructive"
                        onClick={() => stopStreamMutation.mutate(id)}
                      >
                        {t("streams.stopStreaming")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>

        {streamRows.length === 0 && (
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center px-4 text-center">
            <p>{t("generic.tableEmpty")}</p>
          </div>
        )}

        <Pagination className="mt-4 mb-2 flex items-center justify-center lg:absolute lg:bottom-0 lg:left-1/2 lg:mb-0 lg:-translate-x-1/2 lg:-translate-y-1/2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={streamData.prev_page_url === null || currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              />
            </PaginationItem>

            <PaginationItem className="px-2 text-sm sm:hidden">
              {currentPage} / {lastPage}
            </PaginationItem>

            {Array.from(
              { length: lastPage },
              (_, i) => 1 + i
            ).map((index) => (
              <PaginationItem key={`page-${index}`} className="hidden sm:block">
                <PaginationLink
                  disabled={index === currentPage}
                  onClick={() => setPage(index)}
                >
                  {index}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                disabled={streamData.next_page_url == null || currentPage >= lastPage}
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-2xl lg:w-1/2">
          <DialogTitle>{t("streams.createTitle")}</DialogTitle>
          <DialogDescription>
            {t("streams.createDescription")}
          </DialogDescription>
          <StreamForm setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </section>
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
    { value: "Youtube", label: "Youtube" },
    { value: "Facebook", label: "Facebook" },
    { value: "Combo", label: "Combo (YouTube + Facebook)" }, // ✅ NEW
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
    return () => {
      cancelled = true;
    };
  }, []);

  const startStreamMutation = useMutation({
    mutationFn: startStream,
    onSuccess: (res) => {
      toast({ description: res.message || t("streams.streamStarted") });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });

  const startComboMutation = useMutation({
    mutationFn: startComboStreaming,
    onSuccess: (res) => {
      toast({ description: res.message || t("streams.comboStreamStarted") });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });

  const formSchema = z
    .object({
      room_id: z.string().nonempty({ message: t("streams.roomRequired") }),
      type: z.enum(["Youtube", "Facebook", "Combo"], {
        message: t("streams.invalidType"),
      }),

      // single platform
      key: z.string().optional(),

      // combo
      youtube_key: z.string().optional(),
      facebook_key: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.type === "Combo") {
        if (!values.youtube_key || values.youtube_key.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("streams.youtubeKeyRequired"),
            path: ["youtube_key"],
          });
        }
        if (!values.facebook_key || values.facebook_key.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("streams.facebookKeyRequired"),
            path: ["facebook_key"],
          });
        }
      } else {
        if (!values.key || values.key.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("streams.keyRequired"),
            path: ["key"],
          });
        }
      }
    });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      room_id: "",
      type: "Youtube",
      key: "",
      youtube_key: "",
      facebook_key: "",
    },
  });

  const selectedType = form.watch("type");

  const onSubmit = (data) => {
    if (data.type === "Combo") {
      startComboMutation.mutate({
        room_id: data.room_id,
        youtube_key: data.youtube_key,
        facebook_key: data.facebook_key,
      });
    } else {
      startStreamMutation.mutate({
        room_id: data.room_id,
        type: data.type,
        key: data.key,
      });
    }

    setOpenDialog(false);
  };

  return (
    <div className="p-4 md:p-6 lg:p-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="room_id"
            render={({ field }) => (
              <FormItem>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {t("streams.selectRoom")}
                </label>
                <FormControl>
                  <select
                    {...field}
                    disabled={roomLoading}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
                  >
                    <option value="">
                      {roomLoading
                        ? t("streams.loadingRooms")
                        : t("streams.selectRoom")}
                    </option>
                    {Array.isArray(rooms) &&
                      rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room_name ||
                            room.name ||
                            room.label ||
                            `Room ${room.id}`}
                        </option>
                      ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <label htmlFor="type" className="block font-medium">
                  {t("streams.type")}
                </label>
                <FormControl>
                  <Popover open={openPopover} onOpenChange={setOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopover}
                        className="w-full justify-between"
                      >
                        {field.value
                          ? types.find((t) => t.value === field.value)?.label
                          : t("streams.selectTypePlaceholder")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] lg:!w-[300px]">
                      <Command>
                        <CommandInput placeholder={t("streams.searchType")} />
                        <CommandList>
                          <CommandEmpty>{t("streams.noTypeFound")}</CommandEmpty>
                          <CommandGroup>
                            {types.map((type) => (
                              <CommandItem
                                key={type.value}
                                value={type.value}
                                onSelect={() => field.onChange(type.value)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === type.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
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
            )}
          />

          {selectedType === "Combo" ? (
            <>
              <FormField
                control={form.control}
                name="youtube_key"
                render={({ field }) => (
                  <FormItem>
                    <label htmlFor="youtube_key" className="block font-medium">
                      {t("streams.youtubeKey")}
                    </label>
                    <FormControl>
                      <Input
                        id="youtube_key"
                        placeholder={t("streams.youtubeKeyPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="facebook_key"
                render={({ field }) => (
                  <FormItem>
                    <label htmlFor="facebook_key" className="block font-medium">
                      {t("streams.facebookKey")}
                    </label>
                    <FormControl>
                      <Input
                        id="facebook_key"
                        placeholder={t("streams.facebookKeyPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
              <FormItem>
                <label htmlFor="key" className="block font-medium">
                  {t("streams.key")}
                </label>
                <FormControl>
                    <Input
                      id="key"
                      placeholder={t("streams.keyPlaceholder")}
                      {...field}
                    />
                </FormControl>
                <FormMessage />
              </FormItem>
              )}
            />
          )}

          <div className="flex justify-center">
            <Button
              type="submit"
              className="w-full sm:w-auto"
              size="lg"
              disabled={startStreamMutation.isPending || startComboMutation.isPending}
            >
              {t("actions.submit")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
