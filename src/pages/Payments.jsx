import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import React, { useState } from "react";
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
import { Check, ChevronDown } from "lucide-react";

const Plans = {
  monthly: [
    {
      name: "Basic",
      price: "Free forever",
      target: "For individuals",
      features: ["Access to core features", "Limited support", "Single user"],
      cta: "Free",
    },
    {
      name: "Lite",
      price: "10000",
      target: "For individuals",
      features: ["All Basic features", "Priority support", "Up to 3 users"],
      cta: "Upgrade",
    },
    {
      name: "Pro",
      price: "20000",
      target: "For individuals",
      features: ["All Lite features", "Advanced analytics", "Up to 10 users"],
      cta: "Contact Sales",
    },
    {
      name: "Enterprise",
      price: "Custom Pricing",
      target: "For teams and businesses",
      features: [
        "All Pro features",
        "Dedicated account manager",
        "Unlimited users",
      ],
      cta: "Contact Sales",
    },
  ],
  yearly: [
    {
      name: "Basic",
      price: "50000",
      target: "For individuals",
      features: ["Access to core features", "Limited support", "Single user"],
      cta: "Free",
    },
    {
      name: "Lite",
      price: "100000",
      target: "For individuals",
      features: ["All Basic features", "Priority support", "Up to 3 users"],
      cta: "Upgrade",
    },
    {
      name: "Pro",
      price: "200000",
      target: "For individuals",
      features: ["All Lite features", "Advanced analytics", "Up to 10 users"],
      cta: "Contact Sales",
    },
    {
      name: "Enterprise",
      price: "Custom Pricing",
      target: "For teams and businesses",
      features: [
        "All Pro features",
        "Dedicated account manager",
        "Unlimited users",
      ],
      cta: "Contact Sales",
    },
  ],
};

const Payments = () => {
  const payments = [];
  const [plans, setPlans] = useState(Plans.monthly);
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
                <TableHead>Expiry Date</TableHead>
                <TableHead>Issued to</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
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
        <DialogContent className="max-w-[95%] py-14">
          <PaymentsDialog plans={plans} />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Payments;

const PaymentsDialog = ({ plans }) => {
  return (
    <div className="flex justify-evenly gap-x-6">
      {plans.map((plan) => (
        <PlanCard
          name={plan.name}
          cta={plan.cta}
          target={plan.target}
          price={plan.price}
          features={plan.features}
        />
      ))}
    </div>
  );
};

const PlanCard = ({ name, target, cta, price, features }) => (
  <Card className="flex-1 max-w-[290px] h-[400px] rounded-2xl px-[30px] py-[20px] bg-muted">
    <h3 className="font-medium text-2xl mb-1">{name}</h3>
    <p className="mb-8">{target}</p>
    <p className="text-center font-bold text-2xl mb-2">
      {isNaN(price) ? price : "₦" + price}
    </p>
    <div className="flex justify-center mb-6">
      <Button size="lg" className="font-normal">
        {cta}
      </Button>
    </div>
    <div className="mb-10">
      {features.map((feature) => (
        <div className="flex gap-x-2 items-center gap-y-1">
          <Check className="h-4 w-4" />
          <p key={feature}>{feature}</p>
        </div>
      ))}
    </div>
    <div className="flex justify-center">
      <Button className="border-none bg-transparent shadow-none text-black font-normal">
        <ChevronDown />
        View More
      </Button>
    </div>
  </Card>
);
