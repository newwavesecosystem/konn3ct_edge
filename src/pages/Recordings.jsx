import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
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

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!openDeleteDialog) setRecordIdToDelete(null);
  }, [openDeleteDialog]);

  const deleteRecordingMutation = useMutation({
    mutationFn: deleteRecording,
    onSuccess: () => {
      queryClient.invalidateQueries(["recordings"]);
      toast({ description: t("recordings.deletedSuccess") });
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
      toast({ description: t("recordings.copiedSuccess") });
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
            name={t("recordings.totalRecordings")}
            icon={roomsIcon}
          />

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-6">
            <Input
              placeholder={t("recordings.searchPlaceholder")}
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
                {t("actions.clearFilters")}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <Table className="min-w-[840px] lg:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead>{t("recordings.meetingName")}</TableHead>
              <TableHead>{t("recordings.parameters")}</TableHead>
              <TableHead>{t("recordings.date")}</TableHead>
              <TableHead>{t("recordings.options")}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecordings.map(
              ({ name, recordID, participants, startTime, endTime, size }) => (
                <TableRow key={recordID}>
                  <TableCell>{name}</TableCell>

                  <TableCell>
                    <p>
                      {t("recordings.participantsCount", { count: participants })}
                    </p>
                    <p>
                      {t("recordings.minutes", {
                        count: ((endTime - startTime) / (1000 * 60)).toFixed(2),
                      })}
                    </p>
                    <p>{byteToMB(size)} MB</p>
                  </TableCell>

                  <TableCell>{formatDate(Number(startTime))}</TableCell>

                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => handlePlay(recordID)}>
                        {t("recordings.playVideo")}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => handleCopyLink(recordID)}
                        className="flex items-center gap-1 text-white"
                      >
                        <Copy className="w-4 h-4" />
                        {t("recordings.copyLink")}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center px-4 border rounded-full text-sm font-medium">
                          {t("actions.download")}
                        </DropdownMenuTrigger>

                        <DropdownMenuContent>
                          {/* ✅ ONLY this changed */}
                          <DropdownMenuItem
                            onClick={() => downloadVideo(recordID)}
                          >
                            {t("recordings.video")}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => download(recordID, "screenshare")}
                          >
                            {t("recordings.screenshare")}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => download(recordID, "chats")}
                          >
                            {t("recordings.chats")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteClick(recordID)}
                      >
                        {t("actions.delete")}
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
            <p>{t("recordings.noResults")}</p>
          </div>
        )}

      </Card>

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] md:max-w-xl lg:w-1/2">
          <DialogTitle>{t("recordings.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("recordings.deleteDescription")}
          </DialogDescription>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setOpenDeleteDialog(false)}
            >
              {t("actions.cancel")}
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                deleteRecordingMutation.mutate(recordIdToDelete);
                setOpenDeleteDialog(false);
              }}
            >
              {t("actions.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Recordings;
