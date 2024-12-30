import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import React from "react";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Button } from "../components/ui/button";

const history = [];

const InviteHistory = () => {
  return (
    <section className="page container">
      <Card className="w-full min-h-full relative">
        <div className="p-4 pt-10 flex items-center gap-20">
          <h3 className="font-medium text-xl">Invite History</h3>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">#</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Room Name</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Date Sent</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map(({ type, name, guest, date }, id) => (
              <TableRow key={name + date}>
                <TableCell>{id + 1}</TableCell>
                <TableCell>{type}</TableCell>
                <TableCell className="">{name}</TableCell>
                <TableCell>{guest}</TableCell>
                <TableCell>{date}</TableCell>
                <TableCell>
                  <Button variant="destructive">Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {history.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
            <p>No data available for this table</p>
          </div>
        )}
      </Card>
    </section>
  );
};

export default InviteHistory;
