import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import React from "react";
import { Dialog, DialogContent, DialogTrigger } from "../components/ui/dialog";

const Payments = () => {
  return (
    <section className="page container">
      <Dialog>
        <DialogContent className="sm:max-w-md">
          <PaymentsDialog />
        </DialogContent>
        <div className="flex">
          <Card className="w-[260px] h-[200px] flex relative">
            <Badge>Current Plan</Badge>
            <p>BASIC</p>
          </Card>
          <div>
            <Button>Renew Subsciptions</Button>
            <DialogTrigger asChild>
              <Button variant="outline">Change Plan</Button>
            </DialogTrigger>
          </div>
        </div>
        <Card></Card>
      </Dialog>
    </section>
  );
};

export default Payments;

const PaymentsDialog = () => {
  return <div></div>;
};
