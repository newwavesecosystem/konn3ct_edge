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
import { getStreams, startStream, stopStreaming } from "../api/streamApi";
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

const Streaming = () => {
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);

  const streamQuery = useQuery({
    queryKey: ["streams", { page }],
    queryFn: () => getStreams(page),
    placeholderData: (prev) => prev,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const stopStreamMutation = useMutation({
    mutationFn: stopStreaming,
    onSuccess: () => {
      queryClient.invalidateQueries(["streams"]);
      toast({ description: "Streaming successfully ended" });
    },
  });

  if (streamQuery.isLoading)
    return <div className="container mx-auto page">Loading...</div>;

  return (
    <section className="page container mx-auto">
      <Card className="w-full min-h-full relative pb-16">
        <div className="p-4 pt-10 flex items-center gap-20">
          <Button onClick={() => setOpenDialog(true)}>
            <Plus /> Stream
          </Button>
          <StatCard value={1} name="Total Streams" icon={roomsIcon} />
          <Separator orientation="vertical" className="h-[50px]" />
          <StatCard value={2} name="Active streams" icon={activeIcon} />
        </div>
        <Separator />
        <Table>
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
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
            <p>No data available for this table</p>
          </div>
        )}
        <Pagination className="absolute bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={streamQuery.data.prev_page_url === null}
                onClick={() => setPage((prev) => prev - 1)}
              />
            </PaginationItem>
            {Array.from(
              { length: streamQuery.data.last_page },
              (_, i) => 1 + i
            ).map((index) => (
              <PaginationItem key={`page-${index}`}>
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
        <DialogContent className="w-1/2">
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

  const types = [
    { value: "Youtube", label: "Youtube" },
    { value: "Facebook", label: "Facebook" },
  ];

  const startStreamMutation = useMutation({
    mutationFn: startStream,
    onSuccess: (res) => {
      toast({ description: res.message });
    },
  });

  const formSchema = z.object({
    room_id: z.string().nonempty({ message: "Room ID is required." }),
    type: z.enum(["Youtube", "Facebook"], {
      message: "Type must be Youtube or Facebook.",
    }),
    key: z.string().default("123"),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      room_id: "",
      type: "Youtube",
      key: "123",
    },
  });

  const onSubmit = (data) => {
    startStreamMutation.mutate(data);
    setOpenDialog(false);
  };

  return (
    <div className="p-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="room_id"
            render={({ field }) => (
              <FormItem>
                <label htmlFor="room_id" className="block font-medium">
                  Room ID
                </label>
                <FormControl>
                  <Input id="room_id" placeholder="Enter Room ID" {...field} />
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
                  <Popover
                    open={openPopover}
                    onOpenChange={setOpenPopover}
                    className=""
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopover}
                        className="w-full justify-between"
                      >
                        {field.value
                          ? types.find((type) => type.value === field.value)
                              ?.label
                          : "Select type..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="!w-[300px]">
                      <Command>
                        <CommandInput placeholder="Search type..." />
                        <CommandList>
                          <CommandEmpty>No type found.</CommandEmpty>
                          <CommandGroup>
                            {types.map((type) => (
                              <CommandItem
                                key={type.value}
                                value={type.value}
                                onSelect={() => {
                                  field.onChange(type.value);
                                }}
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
          <div className="flex justify-center">
            <Button type="submit" size="lg" className="">
              Submit
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
