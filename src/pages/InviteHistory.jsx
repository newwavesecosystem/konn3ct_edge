import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  CalendarIcon, 
  Check, 
  ChevronsUpDown, 
  Send, 
  History,
  MapPin,
  Mail,
  RefreshCcw,
  Clock,
  Video
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { getInvites, resendInvite, sendInvite } from "../api/invitesApi";
import HistoryIcon from "../assets/components/HistoryIcon";
import { getRooms } from "../api/roomsApi";
import { useToast } from "../hooks/use-toast";
import { capitalize, cn, formatDate } from "../lib/utils";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationNext,
} from "../components/ui/pagination";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import { useNavigate } from "react-router-dom";

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

const InviteHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const inviteQuery = useQuery({
    queryKey: ["invite", { page }],
    queryFn: () => getInvites(page),
    placeholderData: (previousData) => previousData,
  });

  const resendInviteMutation = useMutation({
    mutationFn: resendInvite,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invite"] });
      toast({ description: response.message || t("inviteHistory.toasts.resendSuccess", "Invite resent successfully") });
    },
    onError: () => {
      toast({ 
        description: t("inviteHistory.toasts.resendFailed", "Failed to resend invite"), 
        variant: "destructive" 
      });
    }
  });

  if (inviteQuery.isLoading) {
    return (
      <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {t("inviteHistory.states.loading", "Loading history...")}
        </p>
      </div>
    );
  }

  if (inviteQuery.isError) {
    return (
      <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 p-4 border border-red-200 dark:border-red-900/50 text-center">
          <p className="font-semibold text-red-600 dark:text-red-400">{t("inviteHistory.states.loadErrorTitle", "Error Loading History")}</p>
          <p className="mt-2 text-sm text-red-500/80 dark:text-red-400/80">
            {t("inviteHistory.states.loadErrorDescription", "Please try refreshing the page.")}
          </p>
        </div>
      </div>
    );
  }

  const inviteData = inviteQuery.data ?? {};
  const inviteRows = Array.isArray(inviteData.data) ? inviteData.data : [];
  const currentPage =
    Number.isFinite(Number(inviteData.current_page)) && Number(inviteData.current_page) > 0
      ? Number(inviteData.current_page)
      : 1;
  const lastPage =
    Number.isFinite(Number(inviteData.last_page)) && Number(inviteData.last_page) > 0
      ? Number(inviteData.last_page)
      : 1;

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
              <HistoryIcon className="h-5 w-5" />
            </div>
            {t("inviteHistory.title", "Invite History")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review past meeting invitations and easily resend them to your guests.
          </p>
        </div>

        <Button 
          onClick={() => navigate("/history/new")}
          className="w-full md:w-auto h-11 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)] font-semibold transition-all"
        >
          <Send className="mr-2 h-4 w-4" />
          {t("inviteHistory.actions.sendInvite", "Send New Invite")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[60px_1fr_1.5fr_2fr_1fr_100px] items-center px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 bg-black/[0.02]">
              <span>#</span>
              <span>{t("inviteHistory.table.type", "Type")}</span>
              <span>{t("inviteHistory.table.roomName", "Room Name")}</span>
              <span>{t("inviteHistory.table.guest", "Guests")}</span>
              <span>{t("inviteHistory.table.dateSent", "Date Sent")}</span>
              <span className="text-right">{t("inviteHistory.table.action", "Action")}</span>
            </div>

            <div className="divide-y divide-border/40">
              {inviteRows.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="h-16 w-16 mx-auto rounded-full bg-brand-blue/10 flex items-center justify-center mb-4">
                    <History className="h-8 w-8 text-brand-blue/50" />
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    {t("inviteHistory.states.noData", "No invites found.")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your sent meeting invitations will appear here.
                  </p>
                </div>
              ) : (
                inviteRows.map(({ type, roomname, guest, date, id }, index) => {
                  const emails = String(guest ?? "").split(",").filter(Boolean);
                  const isWebinar = String(type).toLowerCase() === "webinar";

                  return (
                    <div
                      key={`${roomname}-${date}-${id}-${index}`}
                      className="grid grid-cols-[60px_1fr_1.5fr_2fr_1fr_100px] items-center px-6 py-4 text-sm text-foreground hover:bg-black/[0.01] transition-colors"
                    >
                      <span className="font-medium text-muted-foreground">{(currentPage - 1) * 10 + index + 1}</span>
                      
                      <div>
                        <Badge variant="outline" className={`border-0 ${isWebinar ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>
                          <Video className="mr-1 h-3 w-3" />
                          {capitalize(type)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 pr-4">
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                        <span className="font-medium truncate" title={roomname}>{roomname}</span>
                      </div>

                      <div className="flex flex-col gap-1 pr-4">
                        {emails.length > 0 ? emails.map((email, i) => (
                          <div key={`${email}-${i}`} className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Mail className="h-3 w-3 shrink-0 opacity-50" />
                            <span className="truncate" title={email}>{email}</span>
                          </div>
                        )) : (
                          <span className="text-muted-foreground text-xs italic">No guests</span>
                        )}
                      </div>

                      <div className="text-muted-foreground font-medium">
                        {formatDate(date, false)}
                      </div>

                      <div className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resendInviteMutation.isPending && resendInviteMutation.variables === id}
                          onClick={() => resendInviteMutation.mutate(id)}
                          className="h-8 rounded-lg border-brand-green/30 text-brand-green hover:bg-brand-green/10"
                        >
                          {resendInviteMutation.isPending && resendInviteMutation.variables === id ? (
                            <div className="h-3 w-3 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
                          ) : (
                            <>
                              <RefreshCcw className="mr-1.5 h-3 w-3" />
                              {t("inviteHistory.actions.resend", "Resend")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {lastPage > 1 && (
          <div className="flex items-center justify-center py-4 border-t border-border/40 bg-black/[0.01]">
            <Pagination className="w-auto bg-background rounded-full border border-border/60 shadow-sm px-2 py-1">
              <PaginationContent className="flex items-center space-x-1">
                <PaginationItem>
                  <PaginationPrevious
                    className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                    disabled={inviteData.prev_page_url === null || currentPage <= 1}
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setPage((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm font-medium text-foreground px-3">
                    {currentPage} <span className="text-muted-foreground font-normal">/ {lastPage}</span>
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                    disabled={inviteData.next_page_url == null || currentPage >= lastPage}
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < lastPage) setPage((p) => Math.min(lastPage, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

    </div>
  );
};

export default InviteHistory;
