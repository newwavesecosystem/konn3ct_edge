import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import React, { useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Button } from "../components/ui/button";
import { getInvites, resendInvite, sendInvite } from "../api/invitesApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationNext,
} from "../components/ui/pagination";
import { capitalize, cn, formatDate } from "../lib/utils";
import { useToast } from "../hooks/use-toast";
import { CalendarIcon, Check, ChevronsUpDown, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import { Skeleton } from "../components/ui/skeleton";
import { getRooms } from "../api/roomsApi";

const INVITE_HISTORY_TEXT = {
  loadErrorTitle: "Unable to load invite history.",
  loadErrorDescription: "Check your connection and try again.",
  sendInvite: "Send Invite",
  title: "Invite History",
  resendInvite: "Resend Invite",
  dialogTitle: "Send a new Invite",
  dialogDescription: "Send an invite for a scheduled meeting",
  table: {
    number: "#",
    type: "Type",
    roomName: "Room Name",
    guest: "Guest",
    dateSent: "Date Sent",
    action: "Action",
  },
  form: {
    roomName: "Room Name",
    hostname: "Hostname",
    title: "Title",
    date: "Date",
    time: "Time",
    timezone: "Timezone",
    additionalInformation: "Additional Information",
    guestEmails: "Guest Emails",
    selectRoom: "Select a room...",
    searchRoom: "Search room...",
    noRoomFound: "No room found.",
    pickDate: "Pick a date",
    selectTimezone: "Select a timezone...",
    searchTimezone: "Search timezone...",
    noTimezoneFound: "No timezone found.",
    additionalInformationPlaceholder: "Enter additional information",
    guestEmailsPlaceholder: "Enter guest emails separated by commas",
    submitting: "Submitting...",
  },
  validation: {
    roomRequired: "Room is required.",
    hostnameRequired: "Hostname is required.",
    titleRequired: "Title is required.",
    dateRequired: "Date is required.",
    timeRequired: "Time is required.",
    timezoneRequired: "Timezone is required.",
    additionalRequired: "Additional message is required",
    guestEmailsRequired: "Guest emails are required.",
    guestEmailsInvalid: "All guest emails must be valid.",
  },
  tableEmpty: "No data available for this table",
  errorTitle: "Error",
  submit: "Submit",
};

const formatInviteDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeGuestEmails = (value = "") =>
  value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",");

const hasValidGuestEmails = (value = "") => {
  const emails = normalizeGuestEmails(value)
    .split(",")
    .filter(Boolean);

  return (
    emails.length > 0 &&
    emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  );
};

const getInviteErrorMessage = (source, fallbackMessage) =>
  source?.response?.data?.message || source?.message || fallbackMessage;

const buildTimezoneOptions = () =>
  Intl.supportedValuesOf("timeZone").map((timezone) => {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(date);
    const timezoneOffset =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "";

    return {
      label: timezoneOffset ? `${timezone} (${timezoneOffset})` : timezone,
      value: timezone,
    };
  });

const InviteHistory = () => {
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);

  const inviteQuery = useQuery({
    queryKey: ["invite", { page }],
    queryFn: () => getInvites(page),
    placeholderData: (previousData) => previousData,
  });

  const resendInviteMutation = useMutation({
    mutationFn: resendInvite,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invite"] });
      toast({ description: response.message });
    },
  });

  if (inviteQuery.isLoading) {
    return (
      <div className="page container mx-auto">
        <Skeleton className="relative min-h-full w-full" />
      </div>
    );
  }

  if (inviteQuery.isError) {
    return (
      <section className="page container mx-auto">
        <Card className="p-6">
          <p className="font-medium">{INVITE_HISTORY_TEXT.loadErrorTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {INVITE_HISTORY_TEXT.loadErrorDescription}
          </p>
        </Card>
      </section>
    );
  }

  const inviteData = inviteQuery.data ?? {};
  const inviteRows = Array.isArray(inviteData.data) ? inviteData.data : [];
  const currentPage =
    Number.isFinite(Number(inviteData.current_page)) &&
    Number(inviteData.current_page) > 0
      ? Number(inviteData.current_page)
      : 1;
  const lastPage =
    Number.isFinite(Number(inviteData.last_page)) &&
    Number(inviteData.last_page) > 0
      ? Number(inviteData.last_page)
      : 1;

  return (
    <section className="page container mx-auto">
      <Card className="relative min-h-full w-full pb-6 lg:pb-16">
        <div className="flex items-center gap-5 p-4 pt-8 md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center lg:gap-5 lg:pt-10">
          <Button onClick={() => setOpenDialog(true)}>
            <Send /> {INVITE_HISTORY_TEXT.sendInvite}
          </Button>
          <h3 className="text-xl font-medium">{INVITE_HISTORY_TEXT.title}</h3>
        </div>
        <Separator />
        <Table className="min-w-[760px] lg:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead>{INVITE_HISTORY_TEXT.table.number}</TableHead>
              <TableHead>{INVITE_HISTORY_TEXT.table.type}</TableHead>
              <TableHead>{INVITE_HISTORY_TEXT.table.roomName}</TableHead>
              <TableHead>{INVITE_HISTORY_TEXT.table.guest}</TableHead>
              <TableHead>{INVITE_HISTORY_TEXT.table.dateSent}</TableHead>
              <TableHead>{INVITE_HISTORY_TEXT.table.action}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inviteRows.map(({ type, roomname, guest, date, id }) => (
              <TableRow key={roomname + date + id}>
                <TableCell>{id + 1}</TableCell>
                <TableCell>{capitalize(type)}</TableCell>
                <TableCell>{roomname}</TableCell>
                <TableCell className="flex flex-col gap-y-1">
                  {String(guest ?? "")
                    .split(",")
                    .filter(Boolean)
                    .map((email, index) => (
                      <p key={email + index}>{email}</p>
                    ))}
                </TableCell>
                <TableCell>{formatDate(date, false)}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    onClick={() => resendInviteMutation.mutate(id)}
                  >
                    {INVITE_HISTORY_TEXT.resendInvite}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {inviteRows.length === 0 && (
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <p>{INVITE_HISTORY_TEXT.tableEmpty}</p>
          </div>
        )}
        <Pagination className="mt-4 flex items-center justify-center lg:absolute lg:bottom-0 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={inviteData.prev_page_url === null || currentPage <= 1}
                onClick={() => setPage((previousPage) => Math.max(1, previousPage - 1))}
              />
            </PaginationItem>
            {Array.from({ length: lastPage }, (_, index) => index + 1).map(
              (index) => (
                <PaginationItem key={index}>
                  <PaginationLink
                    disabled={index === currentPage}
                    onClick={() => setPage(index)}
                  >
                    {index}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                disabled={inviteData.next_page_url == null || currentPage >= lastPage}
                onClick={() =>
                  setPage((previousPage) => Math.min(lastPage, previousPage + 1))
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="top-[50%] h-[90%] w-[calc(100%-2rem)] overflow-y-scroll md:w-[calc(100%-4rem)] md:max-w-2xl lg:w-[50%]">
          <DialogTitle>{INVITE_HISTORY_TEXT.dialogTitle}</DialogTitle>
          <DialogDescription>
            {INVITE_HISTORY_TEXT.dialogDescription}
          </DialogDescription>
          <MeetingForm setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default InviteHistory;

export const MeetingForm = ({ setOpenDialog }) => {
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const roomQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const formSchema = z.object({
    room_id: z
      .string()
      .trim()
      .min(1, { message: INVITE_HISTORY_TEXT.validation.roomRequired }),
    hostname: z
      .string()
      .trim()
      .min(1, { message: INVITE_HISTORY_TEXT.validation.hostnameRequired }),
    title: z
      .string()
      .trim()
      .min(1, { message: INVITE_HISTORY_TEXT.validation.titleRequired }),
    date: z
      .date({ required_error: INVITE_HISTORY_TEXT.validation.dateRequired })
      .nullable()
      .refine(
        (value) => value instanceof Date && !Number.isNaN(value.getTime()),
        {
          message: INVITE_HISTORY_TEXT.validation.dateRequired,
        }
      ),
    time: z
      .string()
      .trim()
      .min(1, { message: INVITE_HISTORY_TEXT.validation.timeRequired }),
    timezone: z
      .string()
      .trim()
      .min(1, { message: INVITE_HISTORY_TEXT.validation.timezoneRequired }),
    additional: z
      .string()
      .trim()
      .min(1, { message: INVITE_HISTORY_TEXT.validation.additionalRequired }),
    guest: z
      .string()
      .trim()
      .min(1, { message: INVITE_HISTORY_TEXT.validation.guestEmailsRequired })
      .refine((value) => hasValidGuestEmails(value), {
        message: INVITE_HISTORY_TEXT.validation.guestEmailsInvalid,
      }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      room_id: "",
      hostname: "",
      title: "",
      date: null,
      time: "",
      timezone: "",
      additional: "",
      guest: "",
    },
  });

  const timezones = useMemo(() => buildTimezoneOptions(), []);

  const sendInviteMutation = useMutation({
    mutationFn: sendInvite,
    onSuccess: (response) => {
      if (response?.success === false) {
        toast({
          variant: "destructive",
          title: INVITE_HISTORY_TEXT.errorTitle,
          description: getInviteErrorMessage(
            response,
            INVITE_HISTORY_TEXT.loadErrorDescription
          ),
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["invite"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast({
        description: response?.message || INVITE_HISTORY_TEXT.sendInvite,
      });
      form.reset();
      setOpenDialog(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: INVITE_HISTORY_TEXT.errorTitle,
        description: getInviteErrorMessage(
          error,
          INVITE_HISTORY_TEXT.loadErrorDescription
        ),
      });
    },
  });

  const onSubmit = (data) => {
    sendInviteMutation.mutate({
      room_id: data.room_id.trim(),
      hostname: data.hostname.trim(),
      title: data.title.trim(),
      date: formatInviteDate(data.date),
      time: data.time.trim(),
      timezone: data.timezone.trim(),
      additional: data.additional.trim(),
      guest: normalizeGuestEmails(data.guest),
    });
  };

  if (!roomQuery.isSuccess) {
    return <></>;
  }

  const rooms = roomQuery.data?.rooms || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="room_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mt-5 block">
                  {INVITE_HISTORY_TEXT.form.roomName}
                </FormLabel>
                <FormControl>
                  <Popover open={roomOpen} onOpenChange={setRoomOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={roomOpen}
                        className="w-[300px] justify-between md:w-[320px] lg:w-[300px]"
                      >
                        {field.value
                          ? rooms.find((room) => room.id === Number(field.value))
                              ?.name
                          : INVITE_HISTORY_TEXT.form.selectRoom}
                        <ChevronsUpDown className="ml-2 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
                      <Command>
                        <CommandInput
                          placeholder={INVITE_HISTORY_TEXT.form.searchRoom}
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>
                            {INVITE_HISTORY_TEXT.form.noRoomFound}
                          </CommandEmpty>
                          <CommandGroup>
                            {rooms.map((room) => (
                              <CommandItem
                                key={room.id}
                                value={String(room.name ?? "").toLowerCase()}
                                onSelect={() => {
                                  const newValue =
                                    String(room.id) === field.value
                                      ? ""
                                      : String(room.id);
                                  field.onChange(newValue);
                                  setRoomOpen(false);
                                }}
                              >
                                {room.name}
                                <Check
                                  className={cn(
                                    "ml-auto",
                                    field.value === String(room.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
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
            name="hostname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{INVITE_HISTORY_TEXT.form.hostname}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={INVITE_HISTORY_TEXT.form.hostname}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{INVITE_HISTORY_TEXT.form.title}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={INVITE_HISTORY_TEXT.form.title}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{INVITE_HISTORY_TEXT.form.date}</FormLabel>
                <FormControl>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value
                          ? field.value.toLocaleDateString("en-US")
                          : INVITE_HISTORY_TEXT.form.pickDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(date) => field.onChange(date ?? null)}
                      />
                    </PopoverContent>
                  </Popover>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{INVITE_HISTORY_TEXT.form.time}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mt-5 block">
                  {INVITE_HISTORY_TEXT.form.timezone}
                </FormLabel>
                <FormControl>
                  <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={timezoneOpen}
                        className="w-[300px] justify-between md:w-[320px] lg:w-[300px]"
                      >
                        {field.value
                          ? timezones.find(
                              (timezone) => timezone.value === field.value
                            )?.label
                          : INVITE_HISTORY_TEXT.form.selectTimezone}
                        <ChevronsUpDown className="ml-2 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(40rem,calc(100vw-2rem))] p-0"
                      side="left"
                      align="start"
                    >
                      <Command>
                        <CommandInput
                          placeholder={INVITE_HISTORY_TEXT.form.searchTimezone}
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>
                            {INVITE_HISTORY_TEXT.form.noTimezoneFound}
                          </CommandEmpty>
                          <CommandGroup>
                            {timezones.map((timezone) => (
                              <CommandItem
                                key={timezone.value}
                                value={timezone.value}
                                onSelect={(currentValue) => {
                                  field.onChange(
                                    currentValue === field.value
                                      ? ""
                                      : currentValue
                                  );
                                  setTimezoneOpen(false);
                                }}
                              >
                                {timezone.label}
                                <Check
                                  className={cn(
                                    "ml-auto",
                                    field.value === timezone.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
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
            name="additional"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {INVITE_HISTORY_TEXT.form.additionalInformation}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={
                      INVITE_HISTORY_TEXT.form.additionalInformationPlaceholder
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="guest"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{INVITE_HISTORY_TEXT.form.guestEmails}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={INVITE_HISTORY_TEXT.form.guestEmailsPlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-center">
            <Button
              size="lg"
              type="submit"
              disabled={sendInviteMutation.isPending}
            >
              {sendInviteMutation.isPending
                ? INVITE_HISTORY_TEXT.form.submitting
                : INVITE_HISTORY_TEXT.submit}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};
