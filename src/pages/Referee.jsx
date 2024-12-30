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
import { Input } from "../components/ui/input";

const referees = [];

const Referee = () => {
  return (
    <section className="page container">
      <Card className="w-full min-h-full relative">
        <div className="p-4 pt-10 flex items-center gap-20">
          <h3 className="font-medium text-xl">Referee List</h3>
        </div>
        <Separator />
        <div className="flex items-center py-1">
          <div className="flex">
            <p className="text-sm font-medium">Show entries</p>
          </div>
          <div className="flex ml-auto items-center text-sm font-medium gap-x-5">
            Search:
            <Input className="shadow rounded-lg my-2" />
          </div>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Date Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referees.map(({ name, email, plan, date }, id) => (
              <TableRow key={name + date}>
                <TableCell>{id + 1}</TableCell>
                <TableCell>{name}</TableCell>
                <TableCell className="">{email}</TableCell>
                <TableCell>{plan}</TableCell>
                <TableCell>{date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {referees.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
            <p>No data available for this table</p>
          </div>
        )}
      </Card>
    </section>
  );
};

export default Referee;
