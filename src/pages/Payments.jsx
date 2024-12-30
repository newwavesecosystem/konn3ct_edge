import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import React from "react";
import { Dialog, DialogContent, DialogTrigger } from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
} from "../components/ui/table";

const Payments = () => {
  const payments = [];
  return (
    <section className="page container">
      <Dialog>
        <div className="flex items-end gap-x-5 mb-10">
          <Card className="w-[260px] h-[200px] bg-primary">
            <Badge className="bg-white hover:bg-white text-primary">
              Current Plan
            </Badge>
            <div className="w-full h-[calc(100%-40px)] flex justify-center items-center">
              <p className="text-4xl font-medium text-white">BASIC</p>
            </div>
          </Card>
          <div className="flex flex-col gap-y-3">
            <Button className="text-[#373131] bg-muted">
              Renew Subsciptions
            </Button>
            <DialogTrigger asChild>
              <Button variant="outline">Change Plan</Button>
            </DialogTrigger>
          </div>
        </div>
        <Card className="mb-20">
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
              {payments.map(({ type, name, guest, date }, id) => (
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
          {payments.length === 0 && (
            <div className="flex justify-center items-center min-h-[200px]">
              <p>No data available for this table</p>
            </div>
          )}
        </Card>
        <DialogContent className="sm:max-w-md">
          <PaymentsDialog />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Payments;

const PaymentsDialog = () => {
  return <div></div>;
};
