import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "../components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "../components/ui/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMeetings } from "../api/attendanceApi";
import { useNavigate } from "react-router-dom";

const AttendanceList = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        const data = await getMeetings();
        setMeetings(data || []);
      } catch (err) {
        console.error("Failed to fetch meetings:", err);
        setError("Unable to load meeting attendance data.");
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  // 🔥 Correct: id + identifier in URL
const handleViewParticipants = (meeting_id, identifier) => {
    navigate(`/attendance-details/${meeting_id}/${identifier}`);
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600 text-sm">Loading meetings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-3xl rounded-xl shadow border border-gray-200 flex flex-col mt-16">
      <CardHeader className="pb-2 px-4">
        <CardTitle className="text-base font-medium text-gray-800">
          Meeting Attendance
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 flex-1 overflow-y-auto max-h-[400px]">
        <div className="overflow-x-auto">
          {meetings.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-6">
              No meeting attendance found.
            </p>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[40px] text-gray-700 font-medium py-1.5">
                    S/N
                  </TableHead>
                  <TableHead className="text-gray-700 font-medium py-1.5">
                    Meeting Host
                  </TableHead>
                  <TableHead className="text-gray-700 font-medium py-1.5">
                    Date & Time
                  </TableHead>
                  <TableHead className="text-gray-700 font-medium text-center py-1.5">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {meetings.map((meeting, index) => (
                  <TableRow
                    key={meeting.id || index}
                    className="hover:bg-gray-50 transition"
                  >
                    <TableCell className="py-1.5 px-2 text-sm">
                      {index + 1}
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-sm">
                      {meeting.host || "N/A"}
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-sm">
                      {meeting.date
                        ? `${meeting.date} | ${meeting.time || ""}`
                        : "No Date"}
                    </TableCell>

                    <TableCell className="text-center py-1.5 px-2">
                     <Button
                        onClick={() =>
                          handleViewParticipants( meeting.meeting_id , meeting.identifier)
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-0.5 rounded-full"
                      >
                        View Participant(s)
                      </Button>

                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

      <div className="flex justify-center items-center py-3 border-t">
        <Pagination>
          <PaginationContent className="flex items-center space-x-4">
            <PaginationItem>
              <button className="p-1.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100">
                <ChevronLeft size={14} />
              </button>
            </PaginationItem>
            <PaginationItem>
              <span className="text-gray-700 text-xs">1 / 1</span>
            </PaginationItem>
            <PaginationItem>
              <button className="p-1.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100">
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
