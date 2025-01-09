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
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";

const addons = [
  {
    id: 1,
    service: "Whatsapp Invite",
    description: "A medium where you can invite your attendees using Whatsapp",
    status: "Not yet activated",
    price: 3000,
    action: "Make Payment Now",
  },
  {
    id: 2,
    service: "Streaming Service",
    description: "To stream meetings to Facebook, Youtube",
    status: "Expires in 4 days",
    price: 20000,
    action: "Make Payment Now",
  },
  {
    id: 3,
    service: "Custom Branding",
    description: "Add your company’s branding to meeting interfaces",
    status: "Active",
    price: 10000,
    action: "Renew Subscription",
  },
  {
    id: 4,
    service: "Cloud Recording",
    description: "Store and access recorded meetings in the cloud",
    status: "Not yet activated",
    price: 15000,
    action: "Make Payment Now",
  },
  {
    id: 5,
    service: "Email Notifications",
    description: "Automate email reminders for scheduled meetings",
    status: "Active",
    price: 5000,
    action: "Renew Subscription",
  },
  {
    id: 6,
    service: "Meeting Analytics",
    description: "Get detailed insights and reports on meeting performance",
    status: "Expires in 10 days",
    price: 12000,
    action: "Make Payment Now",
  },
];

const Addon = () => {
  return (
    <section className="page container mx-auto">
      <Card className="w-full min-h-full">
        <div className="p-4 pt-10 flex items-center gap-20">
          <h3 className="font-medium text-xl">Addon List</h3>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">#</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Service Description</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addons.map(({ service, description, status, price }, id) => (
              <TableRow key={service}>
                <TableCell>{id + 1}</TableCell>
                <TableCell>{service}</TableCell>
                <TableCell className="text-left">{description}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={status === "Active" ? "" : "destructive"}>
                    {status}
                  </Badge>
                </TableCell>
                <TableCell>{price}</TableCell>
                <TableCell>
                  <Button>Make Payment Now</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {addons.length === 0 && <p>No data available for this table</p>}
      </Card>
    </section>
  );
};

export default Addon;
