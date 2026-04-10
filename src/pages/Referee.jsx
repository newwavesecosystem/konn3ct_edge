import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { getReferee } from "../api/refereeApi";
import { capitalize, formatDate } from "../lib/utils";

const Referee = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const refereeQuery = useQuery({
    queryKey: ["referee", { page }],
    queryFn: () => getReferee(page),
    placeholderData: (prev) => prev,
  });

  if (refereeQuery.isLoading) {
    return (
      <div className="page container mx-auto">
        <Skeleton className="relative min-h-full w-full" />
      </div>
    );
  }

  if (refereeQuery.isError) {
    return (
      <section className="page container mx-auto">
        <Card className="p-6">
          <p className="font-medium">{t("refereesPage.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("refereesPage.loadErrorDescription")}
          </p>
        </Card>
      </section>
    );
  }

  const refereeData = refereeQuery.data ?? {};
  const refereeRows = Array.isArray(refereeData.data) ? refereeData.data : [];
  const currentPage =
    Number.isFinite(Number(refereeData.current_page)) &&
    Number(refereeData.current_page) > 0
      ? Number(refereeData.current_page)
      : 1;
  const lastPage =
    Number.isFinite(Number(refereeData.last_page)) &&
    Number(refereeData.last_page) > 0
      ? Number(refereeData.last_page)
      : 1;

  return (
    <section className="page container mx-auto">
      <Card className="relative flex min-h-full w-full flex-col pb-6 lg:pb-0">
        <div className="flex items-center gap-20 p-4 pt-8 md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center lg:gap-20 lg:pt-10">
          <h3 className="text-xl font-medium">{t("refereesPage.title")}</h3>
        </div>
        <Separator />
        <div className="flex items-center py-1 md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center">
          <div className="flex">
            <p className="text-sm font-medium">{t("refereesPage.showEntries")}</p>
          </div>
          <div className="ml-auto flex items-center gap-x-5 text-sm font-medium md:ml-0 md:w-full lg:ml-auto lg:w-auto">
            {t("refereesPage.searchLabel")}:
            <Input
              className="my-2 rounded-lg shadow md:w-full lg:w-auto"
              placeholder={t("refereesPage.searchPlaceholder")}
            />
          </div>
        </div>
        <Separator />
        <div className="flex-1">
          <Table className="min-w-[820px] lg:min-w-0">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("refereesPage.columns.name")}</TableHead>
                <TableHead>{t("refereesPage.columns.email")}</TableHead>
                <TableHead>{t("refereesPage.columns.plan")}</TableHead>
                <TableHead>{t("refereesPage.columns.dateRegistered")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refereeRows.map(
                ({ lastname, firstname, email, plan, created_at }, id) => (
                  <TableRow key={email + lastname}>
                    <TableCell>{id + 1}</TableCell>
                    <TableCell>
                      {lastname} {firstname}
                    </TableCell>
                    <TableCell>{email}</TableCell>
                    <TableCell>
                      {capitalize(plan?.name ?? t("generic.notAvailable"))}
                    </TableCell>
                    <TableCell>{formatDate(created_at)}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
          {refereeRows.length === 0 && (
            <div className="flex min-h-[220px] items-center justify-center px-4 text-center">
              <p>{t("generic.tableEmpty")}</p>
            </div>
          )}
        </div>
        <Pagination className="mt-4 flex items-center justify-center md:pb-2 lg:absolute lg:bottom-0 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={refereeData.prev_page_url === null || currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              />
            </PaginationItem>
            {Array.from({ length: lastPage }, (_, i) => 1 + i).map((index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  disabled={index === currentPage}
                  onClick={() => setPage(index)}
                >
                  {index}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                disabled={
                  refereeData.next_page_url == null || currentPage >= lastPage
                }
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Card>
    </section>
  );
};

export default Referee;
