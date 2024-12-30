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
import inactiveIcon from "../assets/icons/inactive.svg";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { Plus } from "lucide-react";

const rooms = [
  { name: "Joseph Room", url: "https://example.com/joseph" },
  { name: "Mary Room", url: "https://example.com/mary" },
  { name: "Debby Room", url: "https://example.com/debby" },
  { name: "Conference Room", url: "https://example.com/conference" },
  { name: "Training Room", url: "https://example.com/training" },
];

const Rooms = () => {
  return (
    <section className="page container">
      <Card className="w-full min-h-full">
        <div className="p-4 pt-10 flex items-center justify-between gap-x-4">
          <Button>
            <Plus /> Create Room
          </Button>
          <StatCard value={1} name="Total room" icon={roomsIcon} />
          <Separator orientation="vertical" className="h-[50px]" />
          <StatCard value={2} name="Active room" icon={activeIcon} />
          <Separator orientation="vertical" className="h-[50px]" />
          <StatCard value={1} name="Inactive room" icon={inactiveIcon} />
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">NAME</TableHead>
              <TableHead>ROOM URL</TableHead>
              <TableHead>
                <div className="flex justify-between">
                  <p>ACTIONS</p>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map(({ name, url }) => (
              <TableRow key={url}>
                <TableCell className="">{name}</TableCell>
                <TableCell className="">{url}</TableCell>
                <TableCell>
                  <div className="flex gap-x-2">
                    <Button variant="outline">Copy Link</Button>
                    <Button variant="outline">Schedule</Button>
                    <Button variant="outline">Manage</Button>
                    <Button>Start Meeting</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rooms.length === 0 && <p>No data available for this table</p>}
      </Card>
    </section>
  );
};

export default Rooms;
