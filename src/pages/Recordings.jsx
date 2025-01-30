import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import React from "react";
import StatCard from "../components/StatCard";
import { Card } from "../components/ui/card";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRecording, getRecordings } from "../api/recordingApi";
import { byteToMB, formatDate } from "../lib/utils";
import { useToast } from "../hooks/use-toast";
import { Skeleton } from "../components/ui/skeleton";

const Recordings = () => {
  const recordingQuery = useQuery({
    queryKey: ["recordings"],
    queryFn: getRecordings,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteRecordingMutation = useMutation({
    mutationFn: deleteRecording,
    onSuccess: () => {
      queryClient.invalidateQueries(["recordings"]);
      toast({ description: "Recording successfully deleted" });
    },
  });

  const handlePlay = (url) => {
    window.open(url, "_blank");
  };

  if (recordingQuery.isLoading)
    return (
      <div className="page container mx-auto">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  return (
    <section className="page container mx-auto">
      <Card className="w-full min-h-full relative">
        <div className="p-4 pt-10">
          <StatCard
            value={recordingQuery.data.data.length}
            name="Total recordings"
            icon={roomsIcon}
          />
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">Meeting Name</TableHead>
              <TableHead>Parameters</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="">Options</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordingQuery.data.data.map(
              ({
                name,
                recordID,
                participants,
                startTime,
                endTime,
                size,
                playback,
              }) => (
                <TableRow key={name + startTime}>
                  <TableCell className="">{name}</TableCell>
                  <TableCell>
                    <div className="text-left">
                      <p>{participants} participants</p>
                      <p>
                        {((endTime - startTime) / (1000 * 60)).toFixed(2)}{" "}
                        Minutes
                      </p>
                      <p>{byteToMB(size)} MB</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(Number(startTime))}</TableCell>
                  <TableCell>
                    <div className="flex gap-x-2">
                      <Button
                        onClick={() => {
                          handlePlay(playback.format.url);
                        }}
                      >
                        Play video
                      </Button>
                      <Button variant="outline">Download</Button>
                      <Button
                        variant="destructive"
                        onClick={() => deleteRecordingMutation.mutate(recordID)}
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
        {recordingQuery.data.data.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
            <p>No data available for this table</p>
          </div>
        )}
      </Card>
    </section>
  );
};

export default Recordings;
