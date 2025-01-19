import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import React, { useState } from "react";
import StatCard from "../components/StatCard";
import { Card } from "../components/ui/card";
import activeIcon from "../assets/icons/active.svg";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { Plus } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStreams, stopStreaming } from "../api/streamApi";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { formatDate } from "../lib/utils";
import { useToast } from "../hooks/use-toast";

const Streaming = () => {
  const [page, setPage] = useState(1);

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
          <Button>
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
              ({ room, id, type, status, created_at, ended_at }, index) => (
                <TableRow key={id + created_at}>
                  <TableCell>{id}</TableCell>
                  <TableCell>{room.name}</TableCell>
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
              <PaginationItem key={index}>
                <PaginationLink
                  disabled={index === streamQuery.data.current_page}
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
    </section>
  );
};

export default Streaming;
