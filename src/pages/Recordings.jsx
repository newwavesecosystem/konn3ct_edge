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

const Recordings = () => {
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
      toast({ description: "Recording successfully deleted" });
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
      toast({ description: "Recording link copied to clipboard" });
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
            name="Total recordings"
            icon={roomsIcon}
          />

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-6">
            <Input
              placeholder="Search by meeting name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />

            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-xs"
            />

            {(searchTerm || selectedDate) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDate("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meeting Name</TableHead>
              <TableHead>Parameters</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Options</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecordings.map(
              ({ name, recordID, participants, startTime, endTime, size }) => (
                <TableRow key={recordID}>
                  <TableCell>{name}</TableCell>

                  <TableCell>
                    <p>{participants} participants</p>
                    <p>
                      {((endTime - startTime) / (1000 * 60)).toFixed(2)} Minutes
                    </p>
                    <p>{byteToMB(size)} MB</p>
                  </TableCell>

                  <TableCell>{formatDate(Number(startTime))}</TableCell>

                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => handlePlay(recordID)}>
                        Play video
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => handleCopyLink(recordID)}
                        className="flex items-center gap-1 text-white"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center px-4 border rounded-full text-sm font-medium">
                          Download
                        </DropdownMenuTrigger>

                        <DropdownMenuContent>
                          {/* ✅ ONLY this changed */}
                          <DropdownMenuItem
                            onClick={() => downloadVideo(recordID)}
                          >
                            Video
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => download(recordID, "screenshare")}
                          >
                            Screenshare
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => download(recordID, "chats")}
                          >
                            Chats
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteClick(recordID)}
                      >
                        Delete
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
            <p>No recordings match your filter</p>
          </div>
        )}

      </Card>

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="w-1/2">
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this recording? This action cannot be
            undone.
          </DialogDescription>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setOpenDeleteDialog(false)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                deleteRecordingMutation.mutate(recordIdToDelete);
                setOpenDeleteDialog(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Recordings;
