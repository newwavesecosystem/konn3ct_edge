import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  Plus, 
  Calendar, 
  Users, 
  Copy, 
  MapPin, 
  Clock, 
  Globe, 
  MoreVertical,
  CalendarDays
} from "lucide-react";

import { getPreRegList, getPreRegSummary } from "../api/eventsApi";
import EventIcon from "../assets/components/EventIcon";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "../components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const EventList = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({
    totalEvents: 0,
    totalParticipants: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const PAGE_SIZE = 8;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [listResponse, summaryResponse] = await Promise.all([
        getPreRegList(),
        getPreRegSummary(),
      ]);

      const eventList = Array.isArray(listResponse)
        ? listResponse
        : listResponse?.data?.data || [];

      setEvents(eventList);
      setSummary({
        totalEvents: summaryResponse?.events || 0,
        totalParticipants: summaryResponse?.participants || 0,
      });
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedEvents = events.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const copyEventUrl = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ description: t("events.list.toasts.linkCopied", "Event link copied to clipboard!") });
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {t("events.list.states.loading", "Loading events...")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
              <EventIcon className="h-5 w-5" />
            </div>
            {t("events.list.title", "Events Overview")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your pre-registered events, track participants, and share links.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex w-full sm:w-auto items-center gap-2 rounded-xl bg-surface border border-border/60 p-2 shadow-sm">
            <div className="px-3 py-1 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {t("events.list.summary.totalEvents", "Total Events")}
                </p>
                <p className="text-sm font-bold text-foreground leading-none mt-0.5">{summary.totalEvents}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-border/60 mx-1" />
            <div className="px-3 py-1 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {t("events.list.summary.totalParticipants", "Total Participants")}
                </p>
                <p className="text-sm font-bold text-foreground leading-none mt-0.5">{summary.totalParticipants}</p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate("/events/create")}
            className="w-full sm:w-auto h-12 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)] font-semibold transition-all"
          >
            <Plus className="mr-2 h-5 w-5" />
            {t("common.actions.create", "Create Event")}
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <Card className="w-full rounded-2xl border-border/60 bg-surface shadow-sm mt-8">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <div className="h-20 w-20 rounded-full bg-brand-green/10 flex items-center justify-center mb-6">
              <Calendar className="h-10 w-10 text-brand-green/50" />
            </div>
            <p className="text-xl font-bold text-foreground">
              {t("events.list.states.empty", "No events scheduled yet")}
            </p>
            <p className="text-sm text-muted-foreground mt-2 text-center max-w-sm mb-8">
              Create your first event to start accepting registrations and managing participants.
            </p>
            <Button
              onClick={() => navigate("/events/create")}
              className="h-11 rounded-xl bg-brand-green hover:bg-[#287854] text-white font-semibold px-8"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("common.actions.create", "Create Event")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
            {paginatedEvents.map((event, index) => (
              <Card 
                key={event.id || index} 
                className="group relative overflow-hidden rounded-2xl border-border/60 bg-surface shadow-sm hover:shadow-md hover:border-brand-green/30 transition-all duration-300 flex flex-col"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-green/50 to-brand-blue/50" />
                <CardContent className="p-5 flex flex-col flex-1 pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2 pr-2">
                      {event.title || t("events.list.states.untitled", "Untitled Event")}
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground hover:bg-black/5 rounded-full shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60">
                        <DropdownMenuItem 
                          onClick={() => copyEventUrl(event.event_url)}
                          className="flex items-center cursor-pointer rounded-lg m-1 font-medium"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {t("events.list.actions.copyLink", "Copy Link")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-3 mb-6 flex-1 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 shrink-0 mt-0.5 text-foreground/40" />
                      <span className="font-medium text-foreground line-clamp-1" title={event.host_name || `${event.owner?.firstname || ""} ${event.owner?.lastname || ""}`.trim()}>
                        {event.host_name || `${event.owner?.firstname || ""} ${event.owner?.lastname || ""}`.trim() || t("events.list.states.notAvailable", "N/A")}
                      </span>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-foreground/40" />
                      <span className="truncate" title={event.room?.name}>
                        {event.room?.name || t("events.list.states.noRoom", "No Room")}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-foreground/40" />
                      <span>{event.date || t("events.list.states.emptyValue", "-")}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-foreground/40" />
                      <span>{event.time || t("events.list.states.emptyValue", "-")}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 text-foreground/40" />
                      <span className="truncate">{event.timezone || t("events.list.states.emptyValue", "-")}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40 flex flex-col gap-2">
                    <Button
                      onClick={() => navigate(`/events/participants/${event.reference}`)}
                      className="w-full h-10 rounded-xl bg-brand-green/10 text-brand-green hover:bg-brand-green hover:text-white transition-all font-semibold"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {t("events.list.actions.participants", "View Participants")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center">
              <Pagination className="bg-surface rounded-full border border-border/60 shadow-sm w-auto px-2 py-1">
                <PaginationContent className="flex items-center space-x-1">
                  <PaginationItem>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      aria-label={t("components.pagination.previousAriaLabel", "Previous")}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="text-lg leading-none mb-1">‹</span>
                    </button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm font-medium text-foreground px-3">
                      {currentPage} <span className="text-muted-foreground font-normal">/ {totalPages}</span>
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      aria-label={t("components.pagination.nextAriaLabel", "Next")}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="text-lg leading-none mb-1">›</span>
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventList;
