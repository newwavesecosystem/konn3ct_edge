import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getMeetings } from "../api/attendanceApi";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "../components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const ATTENDANCE_TEXT = {
  loadError: "Unable to load meeting attendance data.",
  loadingMeetings: "Loading meetings...",
  title: "Meeting Attendance",
  noMeetings: "No meeting attendance found.",
  serialNumber: "S/N",
  meetingHost: "Meeting Host",
  dateTime: "Date & Time",
  action: "Action",
  notAvailable: "N/A",
  noDate: "No Date",
  viewParticipants: "View Participant(s)",
};

const AttendanceList = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();
  const PAGE_SIZE = 8;

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        const data = await getMeetings();
        setMeetings(data || []);
      } catch (err) {
        console.error("Failed to fetch meetings:", err);
        setError(ATTENDANCE_TEXT.loadError);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

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
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {ATTENDANCE_TEXT.loadingMeetings}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <Card className="mt-16 flex w-full max-w-3xl flex-col rounded-xl border border-gray-200 shadow dark:border-border">
      <CardHeader className="px-4 pb-2">
        <CardTitle className="text-base font-medium text-gray-800 dark:text-foreground">
          {ATTENDANCE_TEXT.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="max-h-[400px] flex-1 overflow-y-auto px-4">
        <div className="overflow-x-auto">
          {meetings.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-muted-foreground">
              {ATTENDANCE_TEXT.noMeetings}
            </p>
          ) : (
            <Table className="min-w-[640px] text-sm lg:min-w-0">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[40px] py-1.5 font-medium text-gray-700 dark:text-muted-foreground">
                    {ATTENDANCE_TEXT.serialNumber}
                  </TableHead>
                  <TableHead className="py-1.5 font-medium text-gray-700 dark:text-muted-foreground">
                    {ATTENDANCE_TEXT.meetingHost}
                  </TableHead>
                  <TableHead className="py-1.5 font-medium text-gray-700 dark:text-muted-foreground">
                    {ATTENDANCE_TEXT.dateTime}
                  </TableHead>
                  <TableHead className="py-1.5 text-center font-medium text-gray-700 dark:text-muted-foreground">
                    {ATTENDANCE_TEXT.action}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedMeetings.map((meeting, index) => (
                  <TableRow
                    key={meeting.id || index}
                    className="transition hover:bg-gray-50 dark:hover:bg-muted/60"
                  >
                    <TableCell className="px-2 py-1.5 text-sm">
                      {pageStart + index + 1}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-sm">
                      {meeting.host || ATTENDANCE_TEXT.notAvailable}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-sm">
                      {meeting.date
                        ? `${meeting.date} | ${meeting.time || ""}`
                        : ATTENDANCE_TEXT.noDate}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-center">
                      <Button
                        onClick={() =>
                          handleViewParticipants(
                            meeting.meeting_id,
                            meeting.identifier
                          )
                        }
                        className="rounded-full bg-emerald-600 px-3 py-0.5 text-xs text-white hover:bg-emerald-700 md:h-auto md:whitespace-normal md:leading-snug lg:whitespace-nowrap"
                      >
                        {ATTENDANCE_TEXT.viewParticipants}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

      <div className="flex items-center justify-center border-t py-3 dark:border-border">
        <Pagination>
          <PaginationContent className="flex items-center space-x-4">
            <PaginationItem>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-gray-300 p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
              >
                <ChevronLeft size={14} />
              </button>
            </PaginationItem>
            <PaginationItem>
              <span className="text-xs text-gray-700 dark:text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage === totalPages}
                className="rounded-md border border-gray-300 p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
              >
                <ChevronRight size={14} />
              </button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </Card>
  );
};

export default AttendanceList;
