import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarDays,
  UserCircle,
  FileBarChart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getMeetings } from "../api/attendanceApi";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "../components/ui/pagination";

const AttendanceList = () => {
  const { t } = useTranslation();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();
  const PAGE_SIZE = 12;

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        const data = await getMeetings();
        setMeetings(data || []);
      } catch (err) {
        console.error("Failed to fetch meetings:", err);
        setError(t("attendance.list.states.loadError", "Failed to load attendance list."));
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, [t]);

  const handleViewParticipants = (meetingId, identifier) => {
    navigate(`/attendance-details/${meetingId}/${identifier}`);
  };

  const totalPages = Math.max(1, Math.ceil(meetings.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedMeetings = meetings.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {t("attendance.list.states.loading", "Loading attendance records...")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 p-4 border border-red-200 dark:border-red-900/50">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
              <FileBarChart className="h-5 w-5" />
            </div>
            {t("attendance.list.title", "Meeting Attendance")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View detailed participant logs and AI summaries for your past meetings.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-surface border border-border/60 p-2 shadow-sm">
          <div className="px-3 py-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Meetings</p>
            <p className="text-lg font-bold text-foreground leading-none mt-1">{meetings.length}</p>
          </div>
        </div>
      </div>

      {meetings.length === 0 ? (
        <Card className="w-full rounded-2xl border-border/60 bg-surface shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
              <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-base font-semibold text-foreground">
              {t("attendance.list.states.empty", "No attendance records found.")}
            </p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
              When you host a meeting, the participant logs will automatically appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
            {paginatedMeetings.map((meeting, index) => (
              <Card 
                key={meeting.id || index} 
                className="group relative overflow-hidden rounded-2xl border-border/60 bg-surface shadow-sm hover:shadow-md hover:border-brand-green/30 transition-all duration-300 flex flex-col"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-green/40 to-brand-blue/40" />
                <CardContent className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md w-fit">
                      <UserCircle className="h-4 w-4 text-brand-blue" />
                      <span className="truncate max-w-[120px]">{meeting.host || t("attendance.common.notAvailable", "N/A")}</span>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground bg-black/5 px-2 py-1 rounded-md">
                      #{pageStart + index + 1}
                    </span>
                  </div>

                  <div className="mb-6 flex-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">
                        {meeting.date
                          ? `${meeting.date} ${meeting.time ? `• ${meeting.time}` : ""}`
                          : t("attendance.list.states.noDate", "No Date")}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleViewParticipants(meeting.meeting_id, meeting.identifier)}
                    className="w-full h-10 rounded-xl bg-brand-green/10 text-brand-green hover:bg-brand-green hover:text-white transition-all font-semibold"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {t("attendance.list.actions.viewParticipants", "View Participants")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center">
              <Pagination className="bg-surface rounded-full border border-border/60 shadow-sm w-auto px-2 py-1">
                <PaginationContent className="flex items-center space-x-1">
                  <PaginationItem>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      aria-label={t("components.pagination.previousAriaLabel", "Previous")}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm font-medium text-foreground px-3">
                      {currentPage} <span className="text-muted-foreground font-normal">/ {totalPages}</span>
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      aria-label={t("components.pagination.nextAriaLabel", "Next")}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AttendanceList;
