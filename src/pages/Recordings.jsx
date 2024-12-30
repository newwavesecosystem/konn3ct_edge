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
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";

const recordings = [
  {
    name: "Sharon Room",
    parameters: { participants: 10, duration: 60, size: 50 },
    date: "2024-11-15 14:25:30",
  },
  {
    name: "Sean Room",
    parameters: { participants: 8, duration: 30, size: 35 },
    date: "2024-10-05 11:10:45",
  },
  {
    name: "Julia Room",
    parameters: { participants: 15, duration: 90, size: 80 },
    date: "2024-09-18 16:42:10",
  },
  {
    name: "Traci Room",
    parameters: { participants: 20, duration: 120, size: 120 },
    date: "2024-12-01 18:15:20",
  },
  {
    name: "Jeff Room",
    parameters: { participants: 5, duration: 25, size: 20 },
    date: "2024-10-21 09:45:50",
  },
  {
    name: "Shannon Room",
    parameters: { participants: 18, duration: 75, size: 65 },
    date: "2024-11-10 13:22:05",
  },
  {
    name: "Michael Room",
    parameters: { participants: 22, duration: 110, size: 100 },
    date: "2024-12-08 15:30:45",
  },
  {
    name: "Amy Room",
    parameters: { participants: 6, duration: 35, size: 25 },
    date: "2024-09-25 12:10:30",
  },
  {
    name: "Ryan Room",
    parameters: { participants: 12, duration: 60, size: 55 },
    date: "2024-11-20 17:50:40",
  },
  {
    name: "Thomas Room",
    parameters: { participants: 14, duration: 80, size: 70 },
    date: "2024-10-30 14:05:55",
  },
];

const Recordings = () => {
  return (
    <section className="page container">
      <Card className="w-full min-h-full">
        <div className="p-4 pt-10">
          <StatCard value={2} name="Total recordings" icon={roomsIcon} />
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">Meeting Name</TableHead>
              <TableHead>Parameters</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="">Options</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordings.map(({ name, parameters, date }) => (
              <TableRow key={name + date}>
                <TableCell className="">{name}</TableCell>
                <TableCell>
                  <div className="text-left">
                    <p>{parameters.participants} participants</p>
                    <p>{parameters.duration} Minutes</p>
                    <p>{parameters.size} MB</p>
                  </div>
                </TableCell>
                <TableCell>{date}</TableCell>
                <TableCell>
                  <div className="flex gap-x-2">
                    <Button>Play video</Button>
                    <Button variant="outline">Download</Button>
                    <Button variant="outline">Manage</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {recordings.length === 0 && <p>No data available for this table</p>}
      </Card>
    </section>
  );
};

export default Recordings;
