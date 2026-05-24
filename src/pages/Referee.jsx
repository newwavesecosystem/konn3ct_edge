import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { Skeleton } from "../components/ui/skeleton";
import { getReferee } from "../api/refereeApi";
import { capitalize, formatDate, cn } from "../lib/utils";
import { useTranslation } from "react-i18next";
import { Search, CalendarDays, Mail, User2 } from "lucide-react";
import { Badge } from "../components/ui/badge";

const Referee = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const refereeQuery = useQuery({
    queryKey: ["referee", { page }],
    queryFn: () => getReferee(page),
    placeholderData: (prev) => prev,
  });

  if (refereeQuery.isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="w-full h-32 rounded-2xl mb-8" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (refereeQuery.isError) {
    return (
      <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Card className="p-6 rounded-2xl">
          <p className="font-medium">{t("referees.states.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("referees.states.loadErrorDescription")}
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

  // Local filtering based on searchTerm
  const filteredReferees = refereeRows.filter(ref => {
    const fullName = `${ref.firstname || ""} ${ref.lastname || ""}`.toLowerCase();
    const email = (ref.email || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || email.includes(term);
  });

  const getInitials = (first, last) => {
    return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "U";
  };

  const getAvatarColor = (index) => {
    const colors = [
      "bg-blue-100 text-blue-600",
      "bg-green-100 text-green-600",
      "bg-purple-100 text-purple-600",
      "bg-amber-100 text-amber-600",
      "bg-rose-100 text-rose-600",
      "bg-cyan-100 text-cyan-600"
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="flex flex-col gap-8 pb-10 px-4 sm:px-6 lg:px-[33px] animate-in fade-in duration-500 min-h-[calc(100vh-80px)] relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("referees.title", "Referees")}</h1>
          <p className="text-muted-foreground mt-1">Manage and view users who registered using your referral link.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{refereeData.total || 0}</span>
          <span className="text-sm text-muted-foreground">{t("referees.controls.showEntries", "Total Entries")}</span>
        </div>
        <div className="relative w-full sm:w-auto max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11 bg-black/[0.02] border-border/60 rounded-xl focus-visible:ring-brand-green/30 focus-visible:border-brand-green/50 w-full sm:w-[300px]"
            placeholder={t("referees.controls.searchPlaceholder", "Search referees...")}
          />
        </div>
      </div>

      {/* Referees Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 flex-1 content-start pb-20">
        {filteredReferees.map((ref, index) => {
          const { lastname, firstname, email, plan, created_at } = ref;
          const fullName = `${lastname || ""} ${firstname || ""}`.trim();
          const avatarColor = getAvatarColor(index);
          const planName = capitalize(plan?.name ?? "Basic");

          return (
            <Card key={email + lastname} className="rounded-2xl border-border/60 bg-surface overflow-hidden hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-full font-bold text-lg", avatarColor)}>
                    {getInitials(firstname, lastname)}
                  </div>
                  <Badge variant="outline" className="bg-black/[0.02] border-border/60 text-muted-foreground font-semibold px-2.5 py-0.5 rounded-md">
                    {planName}
                  </Badge>
                </div>

                <div className="space-y-1 mb-5">
                  <h3 className="text-lg font-bold text-foreground truncate" title={fullName}>{fullName || "Unknown User"}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground truncate" title={email}>
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground pt-4 border-t border-border/40">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Joined {formatDate(created_at)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredReferees.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/[0.02] mb-4">
              <User2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">{t("referees.states.empty", "No referees found")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              When users sign up using your referral link, they will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full">
          <Pagination className="flex items-center justify-center">
            <PaginationContent className="bg-surface border border-border/60 rounded-xl shadow-sm p-1">
              <PaginationItem>
                <PaginationPrevious
                  disabled={refereeData.prev_page_url === null || currentPage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer rounded-lg hover:bg-black/[0.04]"}
                />
              </PaginationItem>
              
              <div className="hidden sm:flex">
                {Array.from({ length: lastPage }, (_, i) => 1 + i).map((index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      isActive={index === currentPage}
                      onClick={() => setPage(index)}
                      className={cn("cursor-pointer rounded-lg", index === currentPage ? "bg-brand-green/10 text-brand-green font-bold border-0" : "hover:bg-black/[0.04]")}
                    >
                      {index}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              </div>

              <PaginationItem className="px-3 text-sm font-medium sm:hidden flex items-center">
                Page {currentPage} of {lastPage}
              </PaginationItem>

              <PaginationItem>
                <PaginationNext
                  disabled={refereeData.next_page_url == null || currentPage >= lastPage}
                  onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                  className={currentPage >= lastPage ? "pointer-events-none opacity-50" : "cursor-pointer rounded-lg hover:bg-black/[0.04]"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default Referee;
