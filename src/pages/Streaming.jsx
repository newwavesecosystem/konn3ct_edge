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
import activeIcon from "../assets/icons/active.svg";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { Plus } from "lucide-react";
import { Badge } from "../components/ui/badge";

const streams = [
  {
    name: "Sharon Room",
    type: "YouTube",
    status: "Ended",
    start: "2024-05-20 07:29:40",
    end: "2024-05-20 09:29:40",
  },
  {
    name: "Sean Room",
    type: "Instagram",
    status: "Running",
    start: "2024-11-23 08:14:19",
    end: "2024-11-23 09:14:19",
  },
  {
    name: "Julia Room",
    type: "YouTube",
    status: "Ended",
    start: "2024-02-14 14:33:18",
    end: "2024-02-14 15:33:18",
  },
  {
    name: "Traci Room",
    type: "Facebook",
    status: "Ended",
    start: "2024-12-09 11:21:09",
    end: "2024-12-09 16:21:09",
  },
  {
    name: "Jeff Room",
    type: "Twitch",
    status: "Ended",
    start: "2024-11-21 14:31:33",
    end: "2024-11-21 19:31:33",
  },
  {
    name: "Shannon Room",
    type: "Twitch",
    status: "Running",
    start: "2024-10-04 13:07:21",
    end: "2024-10-04 17:07:21",
  },
  {
    name: "Michael Room",
    type: "YouTube",
    status: "Ended",
    start: "2024-11-29 18:07:03",
    end: "2024-11-29 19:07:03",
  },
  {
    name: "Amy Room",
    type: "Instagram",
    status: "Ended",
    start: "2024-01-07 14:55:58",
    end: "2024-01-07 18:55:58",
  },
  {
    name: "Ryan Room",
    type: "YouTube",
    status: "Ended",
    start: "2024-10-13 03:06:49",
    end: "2024-10-13 05:06:49",
  },
  {
    name: "Thomas Room",
    type: "Facebook",
    status: "Running",
    start: "2024-05-15 04:57:01",
    end: "2024-05-15 05:57:01",
  },
];
const Streaming = () => {
  return (
    <section className="page container mx-auto">
      <Card className="w-full min-h-full">
        <div className="p-4 pt-10 flex items-center gap-20">
          <Button>
            <Plus /> Sream
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
            {streams.map(({ name, type, status, start, end }, id) => (
              <TableRow key={name + start}>
                <TableCell>{id + 1}</TableCell>
                <TableCell>{name}</TableCell>
                <TableCell>{type}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={status === "Running" ? "" : "destructive"}>
                    {status}
                  </Badge>
                </TableCell>
                <TableCell>{start}</TableCell>
                <TableCell>{end}</TableCell>
                {status === "Running" && (
                  <TableCell>
                    <Button variant="destructive">Stop Streaming</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {streams.length === 0 && <p>No data available for this table</p>}
      </Card>
    </section>
  );
};

export default Streaming;
