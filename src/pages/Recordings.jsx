import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { Button } from "../components/ui/button";
import React, { useEffect, useMemo, useState } from "react";
import StatCard from "../components/StatCard";
import { Card } from "../components/ui/card";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRecording, getRecordings } from "../api/recordingApi";
import { byteToMB, formatDate } from "../lib/utils";
import { useToast } from "../hooks/use-toast";
import { Skeleton } from "../components/ui/skeleton";
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
import { Copy } from "lucide-react";
import { Input } from "../components/ui/input";
import { useTranslation } from "react-i18next";

const Recordings = () => {
  const { t } = useTranslation();
  const recordingQuery = useQuery({
    queryKey: ["recordings"],
    queryFn: getRecordings,
  });

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [recordIdToDelete, setRecordIdToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const PAGE_SIZE = 10;

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

        const matchesDate = selectedDate
          ? new Date(Number(item.startTime)).toISOString().split("T")[0] ===
          selectedDate
          : true;

        return matchesSearch && matchesDate;
      }) || []
    );
  }, [recordingQuery.data, searchTerm, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRecordings.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedRecordings = filteredRecordings.slice(
    pageStart,
    pageStart + PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDate]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  /* =========================
     Handlers
  ========================= */

  const handleDeleteClick = (id) => {
    setRecordIdToDelete(id);
    setOpenDeleteDialog(true);
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

  // 🔽 ORIGINAL download logic (screenshare & chats stay the same)
  const download = (id, param) => {
    const RECORDING_DOWNLOAD_BASE = process.env.REACT_APP_RECORDING_DOWNLOAD_BASE;
    const url = `${RECORDING_DOWNLOAD_BASE}/${id}/${param}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ✅ NEW logic ONLY for video
  const downloadVideo = (recordId) => {
    if (!recordId) return;
    const VIDEO_DOWNLOAD_BASE = process.env.REACT_APP_VIDEO_DOWNLOAD_BASE;
    const url = `${VIDEO_DOWNLOAD_BASE}/${recordId}/video/webcams.mp4`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* =========================
     Loading
  ========================= */
  if (recordingQuery.isLoading) {
    return (
      <div className="page container mx-auto">
        <Skeleton className="w-full min-h-full" />
      </div>
    );
  }

  /* =========================
     Render
  ========================= */
  return (
    <section className="page container mx-auto">
      <Card className="w-full min-h-full relative">
        <div className="p-4 pt-10">
          <StatCard
            value={filteredRecordings.length}
            name={t("recordings.stats.totalRecordings")}
            icon={roomsIcon}
          />

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-6">
            <Input
              placeholder={t("recordings.filters.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:max-w-none lg:max-w-sm"
            />

            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="md:max-w-[220px] lg:max-w-xs"
            />

            {(searchTerm || selectedDate) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDate("");
                }}
              >
                {t("recordings.filters.clear")}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <Table className="min-w-[840px] lg:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead>{t("recordings.table.meetingName")}</TableHead>
              <TableHead>{t("recordings.table.parameters")}</TableHead>
              <TableHead>{t("recordings.table.date")}</TableHead>
              <TableHead>{t("recordings.table.options")}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedRecordings.map(
              ({ name, recordID, participants, startTime, endTime, size }) => (
                <TableRow key={recordID}>
                  <TableCell>{name}</TableCell>

                  <TableCell>
                    <p>{t("recordings.table.participants", { count: participants })}</p>
                    <p>
                      {t("recordings.table.minutes", {
                        count: ((endTime - startTime) / (1000 * 60)).toFixed(2),
                      })}
                    </p>
                    <p>{t("recordings.table.megabytes", { count: byteToMB(size) })}</p>
                  </TableCell>

                  <TableCell>{formatDate(Number(startTime))}</TableCell>

                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => handlePlay(recordID)}>
                        {t("recordings.actions.playVideo")}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => handleCopyLink(recordID)}
                        className="flex items-center gap-1 text-white"
                      >
                        <Copy className="w-4 h-4" />
                        {t("recordings.actions.copyLink")}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center px-4 border rounded-full text-sm font-medium">
                          {t("recordings.actions.download")}
                        </DropdownMenuTrigger>

                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => downloadVideo(recordID)}
                          >
                            {t("recordings.actions.video")}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => download(recordID, "screenshare")}
                          >
                            {t("recordings.actions.screenshare")}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => download(recordID, "chats")}
                          >
                            {t("recordings.actions.chats")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteClick(recordID)}
                      >
                        {t("recordings.actions.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>

        {filteredRecordings.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p>{t("recordings.filters.noMatch")}</p>
          </div>
        )}

        {filteredRecordings.length > 0 && totalPages > 1 && (
          <div className="border-t px-4 py-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                  />
                </PaginationItem>
                <PaginationItem className="px-2 text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

      </Card>

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-xl lg:w-1/2">
          <DialogTitle>{t("recordings.dialog.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("recordings.dialog.deleteDescription")}
          </DialogDescription>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setOpenDeleteDialog(false)}
            >
              {t("recordings.actions.cancel")}
            </Button>

            <Button
              variant="destructive"
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
    </section>
  );
};

export default Recordings;
