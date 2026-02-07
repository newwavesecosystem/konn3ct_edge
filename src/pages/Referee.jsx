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
import { Input } from "../components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationNext,
} from "../components/ui/pagination";
import { useQuery } from "@tanstack/react-query";
import { getReferee } from "../api/refereeApi";
import { Skeleton } from "../components/ui/skeleton";
import { capitalize, formatDate } from "../lib/utils";

const Referee = () => {
  const [page, setPage] = useState(1);

  const refereeQuery = useQuery({
    queryKey: ["referee", { page }],
    queryFn: () => getReferee(page),
    placeholderData: (prev) => prev,
  });

  if (refereeQuery.isLoading)
    return (
      <div className="page container mx-auto">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );

  return (
    <section className="page container mx-auto">
      <Card className="w-full min-h-full relative">
        <div className="p-4 pt-10 flex items-center gap-20">
          <h3 className="font-medium text-xl">Referee List</h3>
        </div>
        <Separator />
        <div className="flex items-center py-1">
          <div className="flex">
            <p className="text-sm font-medium">Show entries</p>
          </div>
          <div className="flex ml-auto items-center text-sm font-medium gap-x-5">
            Search:
            <Input className="shadow rounded-lg my-2" />
          </div>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead>Referral Link</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Date Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refereeQuery.data.data.map(
              (
                { lastname, firstname, email, plan, created_at, referral_code, referral_link, ref },
                id
              ) => {
                const link =
                  referral_link ||
                  (referral_code || ref
                    ? `${window.location.origin}/register?ref=${referral_code || ref}`
                    : "");

                return (
                <TableRow key={email + lastname}>
                  <TableCell>{id + 1}</TableCell>
                  <TableCell>
                    {lastname} {firstname}
                  </TableCell>
                  <TableCell className="">{email}</TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {link || "—"}
                  </TableCell>
                  <TableCell>{capitalize(plan.name)}</TableCell>
                  <TableCell>{formatDate(created_at)}</TableCell>
                </TableRow>
                );
              }
            )}
          </TableBody>
        </Table>
        {refereeQuery.data.data.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
            <p>No data available for this table</p>
          </div>
        )}
        <Pagination className="absolute bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={refereeQuery.data.prev_page_url === null}
                onClick={() => setPage((prev) => prev - 1)}
              />
            </PaginationItem>
            {Array.from(
              { length: refereeQuery.data?.last_page ?? 1 },
              (_, i) => 1 + i
            ).map((index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  disabled={index === refereeQuery.data.current_page}
                  onClick={() => setPage(index)}
                >
                  {index}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                disabled={refereeQuery.data.next_page_url == null}
                onClick={() => setPage((prev) => prev + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
    </section>
  );
};

export default Referee;
