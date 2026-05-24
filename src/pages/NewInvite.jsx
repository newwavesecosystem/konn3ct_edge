import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  CalendarIcon, 
  Check, 
  ChevronsUpDown, 
  Send,
  MapPin,
  Mail,
  Clock,
  ArrowLeft
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { sendInvite } from "../api/invitesApi";
import { getRooms } from "../api/roomsApi";
import { useToast } from "../hooks/use-toast";
import { cn } from "../lib/utils";

import { Button } from "../components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
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
  const emails = normalizeGuestEmails(value).split(",").filter(Boolean);
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

const NewInvite = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const roomQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const formSchema = z.object({
    room_id: z.string().trim().min(1, { message: t("inviteHistory.meetingForm.validation.roomRequired", "Room is required") }),
    hostname: z.string().trim().min(1, { message: t("inviteHistory.meetingForm.validation.hostnameRequired", "Hostname is required") }),
    title: z.string().trim().min(1, { message: t("inviteHistory.meetingForm.validation.titleRequired", "Title is required") }),
    date: z.date({ required_error: t("inviteHistory.meetingForm.validation.dateRequired", "Date is required") }).nullable().refine(
      (value) => value instanceof Date && !Number.isNaN(value.getTime()),
      { message: t("inviteHistory.meetingForm.validation.dateRequired", "Valid date is required") }
    ),
    time: z.string().trim().min(1, { message: t("inviteHistory.meetingForm.validation.timeRequired", "Time is required") }),
    timezone: z.string().trim().min(1, { message: t("inviteHistory.meetingForm.validation.timezoneRequired", "Timezone is required") }),
    additional: z.string().trim().min(1, { message: t("inviteHistory.meetingForm.validation.additionalRequired", "Details are required") }),
    guest: z.string().trim().min(1, { message: t("inviteHistory.meetingForm.validation.guestRequired", "Guest emails are required") })
      .refine((value) => hasValidGuestEmails(value), {
        message: t("inviteHistory.meetingForm.validation.guestInvalid", "Must be valid comma-separated emails"),
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
          title: t("common.status.error", "Error"),
          description: getInviteErrorMessage(response, t("inviteHistory.meetingForm.toasts.retry", "Please try again")),
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["invite"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast({ description: response?.message || t("inviteHistory.meetingForm.toasts.sent", "Invite sent successfully!") });
      form.reset();
      navigate("/history");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: t("common.status.error", "Error"),
        description: getInviteErrorMessage(error, t("inviteHistory.meetingForm.toasts.retry", "Please try again")),
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

  const rooms = roomQuery.isSuccess ? roomQuery.data?.rooms || [] : [];

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          asChild
          className="mb-4 h-8 px-2 text-muted-foreground hover:text-foreground -ml-2"
        >
          <Link to="/history">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.actions.goBack", "Back to History")}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
            <Send className="h-5 w-5" />
          </div>
          {t("inviteHistory.dialog.title", "Send Meeting Invite")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t("inviteHistory.dialog.description", "Schedule a meeting and invite participants.")}
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface shadow-sm p-6 md:p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField
              control={form.control}
              name="room_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("inviteHistory.meetingForm.labels.roomName", "Select Room")}
                  </FormLabel>
                  <FormControl>
                    <Popover open={roomOpen} onOpenChange={setRoomOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={roomOpen}
                          className="w-full h-11 justify-between rounded-xl bg-black/[0.02] border-border/60 focus:ring-brand-green/30"
                        >
                          {field.value
                            ? rooms.find((room) => room.id === Number(field.value))?.name
                            : <span className="text-muted-foreground font-normal">{t("inviteHistory.meetingForm.placeholders.selectRoom", "Choose a room")}</span>}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-border/60 z-[100]">
                        <Command>
                          <CommandInput placeholder={t("inviteHistory.meetingForm.placeholders.searchRoom", "Search room...")} className="h-10" />
                          <CommandList>
                            <CommandEmpty>{t("inviteHistory.meetingForm.placeholders.noRoomFound", "No room found.")}</CommandEmpty>
                            <CommandGroup>
                              {rooms.map((room) => (
                                <CommandItem
                                  key={room.id}
                                  value={String(room.name ?? "").toLowerCase()}
                                  onSelect={() => {
                                    const newValue = String(room.id) === field.value ? "" : String(room.id);
                                    field.onChange(newValue);
                                    setRoomOpen(false);
                                  }}
                                  className="cursor-pointer my-0.5 rounded-lg"
                                >
                                  {room.name}
                                  <Check className={cn("ml-auto h-4 w-4", field.value === String(room.id) ? "opacity-100" : "opacity-0")} />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">{t("inviteHistory.meetingForm.labels.title", "Meeting Title")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("inviteHistory.meetingForm.placeholders.title", "e.g. Weekly Sync")}
                        {...field}
                        className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hostname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">{t("inviteHistory.meetingForm.labels.hostname", "Host Name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("inviteHistory.meetingForm.placeholders.hostname", "Your name")}
                        {...field}
                        className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("inviteHistory.meetingForm.labels.date", "Date")}
                    </FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-11 justify-start text-left font-normal rounded-xl bg-black/[0.02] border-border/60 hover:bg-black/[0.04] focus:ring-brand-green/30",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? field.value.toLocaleDateString("en-US") : t("inviteHistory.meetingForm.placeholders.pickDate", "Pick a date")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-xl border-border/60 z-[100]">
                          <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={(date) => field.onChange(date ?? null)}
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("inviteHistory.meetingForm.labels.time", "Time")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <input
                          type="time"
                          {...field}
                          className="w-full h-11 rounded-xl border border-border/60 bg-black/[0.02] px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">{t("inviteHistory.meetingForm.labels.timezone", "Timezone")}</FormLabel>
                    <FormControl>
                      <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={timezoneOpen}
                            className="w-full h-11 justify-between rounded-xl bg-black/[0.02] border-border/60 hover:bg-black/[0.04] focus:ring-brand-green/30"
                          >
                            <span className="truncate">
                              {field.value
                                ? timezones.find((tz) => tz.value === field.value)?.label
                                : <span className="text-muted-foreground font-normal">{t("inviteHistory.meetingForm.placeholders.selectTimezone", "Select TZ")}</span>}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-border/60 z-[100]">
                          <Command>
                            <CommandInput placeholder={t("inviteHistory.meetingForm.placeholders.searchTimezone", "Search timezone...")} className="h-10" />
                            <CommandList>
                              <CommandEmpty>{t("inviteHistory.meetingForm.placeholders.noTimezoneFound", "No timezone found.")}</CommandEmpty>
                              <CommandGroup>
                                {timezones.map((tz) => (
                                  <CommandItem
                                    key={tz.value}
                                    value={tz.value}
                                    onSelect={(currentValue) => {
                                      field.onChange(currentValue === field.value ? "" : currentValue);
                                      setTimezoneOpen(false);
                                    }}
                                    className="cursor-pointer my-0.5 rounded-lg"
                                  >
                                    {tz.label}
                                    <Check className={cn("ml-auto h-4 w-4", field.value === tz.value ? "opacity-100" : "opacity-0")} />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="guest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("inviteHistory.meetingForm.labels.guestEmails", "Guest Emails")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("inviteHistory.meetingForm.placeholders.guestEmails", "example@domain.com, guest@domain.com")}
                      {...field}
                      className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30"
                    />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground mt-1">Separate multiple emails with commas</p>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additional"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">{t("inviteHistory.meetingForm.labels.additionalInformation", "Additional Information")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("inviteHistory.meetingForm.placeholders.additionalInformation", "Any details or agenda items...")}
                      {...field}
                      className="rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 resize-none min-h-[120px]"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="pt-6 flex items-center justify-end border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                className="mr-3 h-11 rounded-xl"
                onClick={() => navigate("/history")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sendInviteMutation.isPending}
                className="w-full sm:w-auto h-11 px-8 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)] font-semibold transition-all"
              >
                {sendInviteMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("inviteHistory.meetingForm.actions.submitting", "Sending...")}
                  </div>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t("common.actions.submit", "Send Invitations")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default NewInvite;
