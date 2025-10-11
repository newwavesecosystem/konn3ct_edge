import React from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
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

const AttendanceList = () => {
    const meetings = [
        { id: 1, host: "Odejimi Samuel", date: "2025-07-26", time: "2:29:30" },
        { id: 2, host: "Odejimi Samuel", date: "2025-07-25", time: "2:29:30" },
        { id: 3, host: "Odejimi Samuel", date: "2025-07-24", time: "2:29:30" },
        { id: 4, host: "Odejimi Samuel", date: "2025-07-23", time: "2:29:30" },
        { id: 5, host: "Odejimi Samuel", date: "2025-07-22", time: "2:29:30" },
        { id: 6, host: "Odejimi Samuel", date: "2025-07-21", time: "2:29:30" },
        { id: 7, host: "Odejimi Samuel", date: "2025-07-20", time: "2:29:30" },
        { id: 8, host: "Odejimi Samuel", date: "2025-07-19", time: "2:29:30" },
        { id: 9, host: "Odejimi Samuel", date: "2025-07-18", time: "2:29:30" },
        { id: 10, host: "Odejimi Samuel", date: "2025-07-17", time: "2:29:30" },
    ];

    return (
        <Card className="w-full max-w-3xl rounded-xl shadow border border-gray-200 flex flex-col mt-16">
            {/* Header */}
            <CardHeader className="pb-2 px-4">
                <CardTitle className="text-base font-medium text-gray-800">
                    Meeting Attendance
                </CardTitle>
            </CardHeader>

            {/* Scrollable Table */}
            <CardContent className="px-4 flex-1 overflow-y-auto max-h-[400px]">
                <div className="overflow-x-auto">
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
                            {meetings.map((meeting) => (
                                <TableRow key={meeting.id} className="hover:bg-gray-50">
                                    <TableCell className="py-1.5 px-2 text-sm">
                                        {meeting.id}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 text-sm">
                                        {meeting.host}
                                    </TableCell>
                                    <TableCell className="py-1.5 px-2 text-sm">
                                        {meeting.date} | {meeting.time}
                                    </TableCell>
                                    <TableCell className="text-center py-1.5 px-2">
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-0.5 rounded-full shadow-sm">
                                            View Participant(s)
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Pagination */}
            <div className="flex justify-center items-center py-3 border-t">
                <Pagination>
                    <PaginationContent className="flex items-center space-x-4">
                        <PaginationItem>
                            <button className="p-1.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100">
                                <ChevronLeft size={14} />
                            </button>
                        </PaginationItem>
                        <PaginationItem>
                            <span className="text-gray-700 text-xs">1 / 5</span>
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