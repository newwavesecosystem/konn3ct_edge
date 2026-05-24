import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationLink,
} from "../components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Play, Download, Share2, MoreVertical, Clock,
  Film, Eye, Calendar, Search, Trash2, Users, Monitor, MessageSquare, Video, CalendarIcon
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRecording, getRecordings } from "../api/recordingApi";
import { byteToMB, formatDate } from "../lib/utils";
import { useToast } from "../hooks/use-toast";
import { Skeleton } from "../components/ui/skeleton";

const Recordings = () => {
  const { t } = useTranslation();
  const recordingQuery = useQuery({
    queryKey: ["recordings"],
    queryFn: getRecordings,
  });

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [recordIdToDelete, setRecordIdToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const PAGE_SIZE = 12;

  useEffect(() => {
    if (!openDeleteDialog) setRecordIdToDelete(null);
  }, [openDeleteDialog]);

  const deleteRecordingMutation = useMutation({
    mutationFn: deleteRecording,
    onSuccess: () => {
      queryClient.invalidateQueries(["recordings"]);
      toast({ description: t("recordings.toasts.deleted") });
    },
  });

  const filteredRecordings = useMemo(() => {
    return (
      recordingQuery.data?.data?.filter((item) => {
        const matchesSearch = item.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

        let matchesDate = true;
        if (selectedDate) {
          const itemDate = new Date(Number(item.startTime));
          matchesDate = itemDate.toDateString() === selectedDate.toDateString();
        }

        return matchesSearch && matchesDate;
      }) || []
    );
  }, [recordingQuery.data, searchTerm, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRecordings.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedRecordings = filteredRecordings.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDate]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  /* =========================
     Calculations for Stats
  ========================= */
  const allRecordings = recordingQuery.data?.data || [];
  const totalRecordingsCount = allRecordings.length;
  
  const totalDurationMinutes = allRecordings.reduce((acc, curr) => {
    return acc + ((curr.endTime - curr.startTime) / (1000 * 60));
  }, 0);
  const totalDurationStr = totalDurationMinutes > 60 
    ? `${Math.floor(totalDurationMinutes / 60)}h ${Math.round(totalDurationMinutes % 60)}m` 
    : `${Math.round(totalDurationMinutes)}m`;

  const totalParticipants = allRecordings.reduce((acc, curr) => acc + (curr.participants || 0), 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthCount = allRecordings.filter(r => {
    const d = new Date(Number(r.startTime));
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  /* =========================
     Handlers
  ========================= */
  const handleDeleteClick = (id) => {
    setRecordIdToDelete(id);
    setOpenDeleteDialog(true);
    setOpenDropdownId(null);
  };

  const handlePlay = (id) => {
    const playbackBaseUrl = process.env.REACT_APP_PLAYBACK_URL;
    window.open(`${playbackBaseUrl}/${id}`, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = (id) => {
    const playbackBaseUrl = process.env.REACT_APP_PLAYBACK_URL;
    const link = `${playbackBaseUrl}/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ description: t("recordings.toasts.linkCopied") });
    });
  };

  const download = (id, param) => {
    const RECORDING_DOWNLOAD_BASE = process.env.REACT_APP_RECORDING_DOWNLOAD_BASE;
    const url = `${RECORDING_DOWNLOAD_BASE}/${id}/${param}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadVideo = (recordId) => {
    if (!recordId) return;
    const VIDEO_DOWNLOAD_BASE = process.env.REACT_APP_VIDEO_DOWNLOAD_BASE;
    const url = `${VIDEO_DOWNLOAD_BASE}/${recordId}/video/webcams.mp4`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const formatDurationBadge = (start, end) => {
    const mins = ((end - start) / (1000 * 60));
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
    return `${Math.round(mins)}m`;
  };

  const colors = [
    "from-brand-blue to-blue-400",
    "from-brand-green to-emerald-400",
    "from-purple-500 to-pink-400",
    "from-amber-500 to-orange-400",
    "from-cyan-500 to-blue-400",
    "from-rose-500 to-red-400"
  ];

  /* =========================
     Render
  ========================= */
  if (recordingQuery.isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="w-full h-[500px] rounded-2xl" />
      </div>
    );
  }

  if (recordingQuery.isError) {
    return (
      <section className="p-6">
        <Card className="p-6 rounded-2xl">
          <p className="font-medium">{t("common.states.error", "Error loading data")}</p>
        </Card>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10 px-4 sm:px-6 lg:px-[33px] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Recordings</h1>
          <p className="text-muted-foreground mt-1">View, share, and manage your recorded sessions.</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Recordings", value: totalRecordingsCount, icon: Film, bg: "bg-brand-blue/10", color: "text-brand-blue" },
          { label: "Total Duration", value: totalDurationStr, icon: Clock, bg: "bg-brand-green/10", color: "text-brand-green" },
          { label: "Participants", value: totalParticipants, icon: Users, bg: "bg-purple-500/10", color: "text-purple-500" },
          { label: "This Month", value: thisMonthCount, icon: Calendar, bg: "bg-amber-500/10", color: "text-amber-500" },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("recordings.filters.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11 bg-black/[0.02] border-border/60 rounded-xl focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`w-full sm:w-[240px] h-11 justify-start text-left font-normal rounded-xl bg-black/[0.02] border-border/60 hover:bg-black/[0.04] transition-colors ${!selectedDate && "text-muted-foreground"}`}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? formatDate(selectedDate.getTime()) : t("recordings.filters.selectDate", "Pick a date")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-2xl border-border/60 shadow-lg" align="start">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              className="rounded-2xl"
            />
          </PopoverContent>
        </Popover>

        {(searchTerm || selectedDate) && (
          <Button
            variant="outline"
            onClick={() => { setSearchTerm(""); setSelectedDate(undefined); }}
            className="h-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/[0.04]"
          >
            {t("recordings.filters.clear")}
          </Button>
        )}
      </div>

      {/* Recording Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paginatedRecordings.map((rec, index) => {
          const thumbColor = colors[index % colors.length];
          const durationStr = formatDurationBadge(rec.startTime, rec.endTime);
          const sizeStr = byteToMB(rec.size);

          return (
            <Card key={rec.recordID} className="rounded-2xl border-border/60 bg-surface hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300 overflow-hidden group">
              {/* Thumbnail */}
              <div 
                className={`relative h-40 bg-gradient-to-br ${thumbColor} flex items-center justify-center cursor-pointer`}
                onClick={() => handlePlay(rec.recordID)}
              >
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-brand-blue shadow-xl scale-75 group-hover:scale-100 transition-transform">
                    <Play className="h-6 w-6 ml-0.5 fill-brand-blue" />
                  </button>
                </div>
                <Play className="h-10 w-10 text-white/40 fill-white/40" />
                <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm shadow-sm">
                  {durationStr}
                </div>
              </div>

              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground truncate" title={rec.name}>{rec.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(Number(rec.startTime))}</p>
                  </div>
                  
                  {/* MoreVertical Menu */}
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === rec.recordID ? null : rec.recordID);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/[0.04] text-muted-foreground transition-all shrink-0 ml-2 ${openDropdownId === rec.recordID ? 'bg-black/[0.04] opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openDropdownId === rec.recordID && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }} />
                        <div className="absolute right-0 top-8 w-40 rounded-xl border border-border/60 bg-surface shadow-lg z-50 overflow-hidden animate-in zoom-in-95 duration-150">
                          <div className="p-1.5">
                            <button 
                              onClick={() => handleDeleteClick(rec.recordID)} 
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" /> {t("recordings.actions.delete")}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-1" title={`${rec.participants} Participants`}><Users className="h-3.5 w-3.5" /> {rec.participants}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{sizeStr} MB</span>
                  </div>
                  <div className="flex gap-1.5">
                    {/* Share Button */}
                    <button 
                      onClick={() => handleCopyLink(rec.recordID)} 
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.02] hover:bg-brand-blue/10 text-muted-foreground hover:text-brand-blue transition-colors" 
                      title={t("recordings.actions.copyLink")}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    
                    {/* Download Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.02] hover:bg-brand-green/10 text-muted-foreground hover:text-brand-green transition-colors" title={t("recordings.actions.download")}>
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60 shadow-lg p-1.5">
                        <DropdownMenuItem onClick={() => downloadVideo(rec.recordID)} className="rounded-lg cursor-pointer flex items-center gap-2">
                          <Video className="w-4 h-4 text-muted-foreground" />
                          {t("recordings.actions.video")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => download(rec.recordID, "screenshare")} className="rounded-lg cursor-pointer flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-muted-foreground" />
                          {t("recordings.actions.screenshare")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => download(rec.recordID, "chats")} className="rounded-lg cursor-pointer flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          {t("recordings.actions.chats")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredRecordings.length === 0 && (
        <div className="flex justify-center items-center h-40">
          <p className="text-muted-foreground">{t("recordings.filters.noMatch")}</p>
        </div>
      )}

      {/* Pagination */}
      {filteredRecordings.length > 0 && totalPages > 1 && (
        <Pagination className="mt-6 flex justify-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="cursor-pointer"
              />
            </PaginationItem>
            <PaginationItem className="px-2 text-sm sm:hidden">
              {currentPage} / {totalPages}
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => 1 + i).map((index) => (
              <PaginationItem key={`page-${index}`} className="hidden sm:block">
                <PaginationLink
                  isActive={index === currentPage}
                  onClick={() => setCurrentPage(index)}
                  className="cursor-pointer"
                >
                  {index}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="cursor-pointer"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-md rounded-2xl">
          <DialogTitle>{t("recordings.dialog.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("recordings.dialog.deleteDescription")}
          </DialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setOpenDeleteDialog(false)} className="rounded-xl">
              {t("recordings.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteRecordingMutation.isPending}
              onClick={() => {
                deleteRecordingMutation.mutate(recordIdToDelete);
                setOpenDeleteDialog(false);
              }}
            >
              {t("recordings.actions.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recordings;
