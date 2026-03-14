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

const Streaming = () => {
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const streamQuery = useQuery({
    queryKey: ["streams", { page }],
    queryFn: () => getStreams(page),
    placeholderData: (prev) => prev,

    // ✅ Auto-refresh (near real-time)
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const stopStreamMutation = useMutation({
    mutationFn: stopStreaming,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] });
      toast({ description: "Streaming successfully ended" });
    },
  });

  if (streamQuery.isLoading)
    return (
      <div className="page container mx-auto !px-4 sm:!px-6 md:!px-[33px]">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  return (
    <section className="page container mx-auto !px-4 sm:!px-6 md:!px-[33px]">
      <Card className="w-full min-h-full relative pb-6 md:pb-16">
        <div className="p-4 pt-6 flex flex-col gap-4 md:pt-10 md:flex-row md:items-center md:gap-20">
          <Button className="w-full sm:w-auto" onClick={() => setOpenDialog(true)}>
            <Plus /> Stream
          </Button>

          <StatCard
            value={streamQuery.data?.total ?? 0}
            name="Total Streams"
            icon={roomsIcon}
          />

          <Separator orientation="vertical" className="hidden h-[50px] md:block" />

          <StatCard
            value={
              Array.isArray(streamQuery.data?.data)
                ? streamQuery.data.data.filter((s) => s.status === 1).length
                : 0
            }
            name="Active Streams"
            icon={activeIcon}
          />
        </div>

        <Separator />

        <Table className="min-w-[780px] md:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="">No</TableHead>
              <TableHead>Room Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Started At</TableHead>
              <TableHead>Ended At</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {streamQuery.data.data.map(
              ({ room, id, type, status, created_at, ended_at }) => (
                <TableRow key={id + created_at}>
                  <TableCell>{id}</TableCell>
                  <TableCell>{room?.name ?? "Temporary room"}</TableCell>
                  <TableCell>{type}</TableCell>

                  <TableCell className="text-center">
                    <Badge variant={status === 1 ? "" : "destructive"}>
                      {status === 1 ? "Running" : "Ended"}
                    </Badge>
                  </TableCell>

                  <TableCell>{formatDate(created_at)}</TableCell>

                  <TableCell>
                    {ended_at === null ? (
                      <Badge>Running</Badge>
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
                        Stop Streaming
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>

        {streamQuery.data.data.length === 0 && (
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center px-4 text-center">
            <p>No data available for this table</p>
          </div>
        )}

        <Pagination className="mt-4 mb-2 flex items-center justify-center md:absolute md:bottom-0 md:left-1/2 md:mb-0 md:-translate-x-1/2 md:-translate-y-1/2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={streamQuery.data.prev_page_url === null}
                onClick={() => setPage((prev) => prev - 1)}
              />
            </PaginationItem>

            <PaginationItem className="px-2 text-sm sm:hidden">
              {streamQuery.data.current_page} / {streamQuery.data.last_page}
            </PaginationItem>

            {Array.from(
              { length: streamQuery.data.last_page },
              (_, i) => 1 + i
            ).map((index) => (
              <PaginationItem key={`page-${index}`} className="hidden sm:block">
                <PaginationLink
                  disabled={index === streamQuery.data.current_page}
                  onClick={() => setPage(index)}
                >
                  {index}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                disabled={streamQuery.data.next_page_url == null}
                onClick={() => setPage((prev) => prev + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-1/2">
          <DialogTitle>Create a new stream</DialogTitle>
          <DialogDescription>
            Start streaming your meeting on various platforms
          </DialogDescription>
          <StreamForm setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Streaming;

const StreamForm = ({ setOpenDialog }) => {
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
      toast({ description: res.message || "Stream started" });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });

  const startComboMutation = useMutation({
    mutationFn: startComboStreaming,
    onSuccess: (res) => {
      toast({ description: res.message || "Combo streaming started" });
      queryClient.invalidateQueries({ queryKey: ["streams"] });
    },
  });

  const formSchema = z
    .object({
      room_id: z.string().nonempty({ message: "Room is required." }),
      type: z.enum(["Youtube", "Facebook", "Combo"], {
        message: "Select a valid type.",
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
            message: "YouTube key is required for Combo.",
            path: ["youtube_key"],
          });
        }
        if (!values.facebook_key || values.facebook_key.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Facebook key is required for Combo.",
            path: ["facebook_key"],
          });
        }
      } else {
        if (!values.key || values.key.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Key is required.",
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
    <div className="p-4 md:p-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="room_id"
            render={({ field }) => (
              <FormItem>
                <label className="block text-gray-700 text-sm mb-1">
                  Select Room
                </label>
                <FormControl>
                  <select
                    {...field}
                    disabled={roomLoading}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  >
                    <option value="">
                      {roomLoading ? "Loading rooms..." : "Select Room"}
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
                  Type
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
                          : "Select type..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] md:!w-[300px]">
                      <Command>
                        <CommandInput placeholder="Search type..." />
                        <CommandList>
                          <CommandEmpty>No type found.</CommandEmpty>
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
                      YouTube Key
                    </label>
                    <FormControl>
                      <Input
                        id="youtube_key"
                        placeholder="Enter YouTube Key"
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
                      Facebook Key
                    </label>
                    <FormControl>
                      <Input
                        id="facebook_key"
                        placeholder="Enter Facebook Key"
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
                    Key
                  </label>
                  <FormControl>
                    <Input id="key" placeholder="Enter Key" {...field} />
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
              Submit
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
