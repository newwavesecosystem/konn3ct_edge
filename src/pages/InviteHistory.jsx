import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import React, { useState } from "react";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Button } from "../components/ui/button";
import { getInvites, resendInvite } from "../api/invitesApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationNext,
} from "../components/ui/pagination";
import { capitalize } from "../lib/utils";
import { useToast } from "../hooks/use-toast";

const InviteHistory = () => {
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const inviteQuery = useQuery({
    queryKey: ["invite", { page }],
    queryFn: () => getInvites(page),
    placeholderData: (prev) => prev,
  });

  const resendInviteMutation = useMutation({
    mutationFn: resendInvite,
    onSuccess: (res) => {
      queryClient.invalidateQueries(["invite"]);
      toast({ description: res.message });
    },
  });

  if (inviteQuery.isLoading)
    return <div className="container mx-auto page">Loading...</div>;

  return (
    <section className="page container mx-auto">
      <Card className="w-full min-h-full relative pb-16">
        <div className="p-4 pt-10 flex items-center gap-20">
          <h3 className="font-medium text-xl">Invite History</h3>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">#</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Room Name</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Date Sent</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inviteQuery.data.data.map(
              ({ type, roomname, guest, date, id }) => (
                <TableRow key={roomname + date + id}>
                  <TableCell>{id + 1}</TableCell>
                  <TableCell>{capitalize(type)}</TableCell>
                  <TableCell className="">{roomname}</TableCell>
                  <TableCell className="flex flex-col gap-y-1">
                    {guest.split(",").map((email, id) => (
                      <p key={email + id}>{email}</p>
                    ))}
                  </TableCell>
                  <TableCell>{date}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => resendInviteMutation.mutate(id)}
                    >
                      Resend Invite
                    </Button>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
        {inviteQuery.data.data.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
            <p>No data available for this table</p>
          </div>
        )}
        <Pagination className="absolute bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={inviteQuery.data.prev_page_url === null}
                onClick={() => setPage((prev) => prev - 1)}
              />
            </PaginationItem>
            {Array.from(
              { length: inviteQuery.data?.last_page ?? 1 },
              (_, i) => 1 + i
            ).map((index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  disabled={index === inviteQuery.data.current_page}
                >
                  {index}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                disabled={inviteQuery.data.next_page_url == null}
                onClick={() => {
                  setPage((prev) => prev + 1);
                  console.log(page);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
    </section>
  );
};

export default InviteHistory;
