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
import { Badge } from "../components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getAddons } from "../api/addonsApi";
import { Skeleton } from "../components/ui/skeleton";
import { PaystackButton } from "react-paystack";
import { getUser } from "../api/userApi";
import { useToast } from "../hooks/use-toast";

const Addon = () => {
  const { data, isSuccess, isError } = useQuery({
    queryFn: getAddons,
    queryKey: ["addons"],
  });
  const { data: userData, isSuccess: userIsSuccess, isError: userIsError } = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
  });
  const { toast } = useToast();

  const publicKey = process.env.REACT_APP_PAYSTACK_KEY;

  if (isError || userIsError) {
    return (
      <section className="page container mx-auto">
        <Card className="p-6">
          <p className="font-medium">Unable to load addons right now.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please retry in a moment.
          </p>
        </Card>
      </section>
    );
  }

  if (!isSuccess || !userIsSuccess) {
    return (
      <div className="page container mx-auto">
        <Skeleton className="w-full min-h-full relative" />
      </div>
    );
  }

  const addons = Array.isArray(data?.data) ? data.data : [];
  const addonStatus = data?.current_status ?? {};
  const user = userData?.user ?? {};
  const email = user.email ?? "";
  const lastName = user.lastName ?? user.lastname ?? "";
  const phone = user.phone ?? "";

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
            {addons.map(({ name, description, price, id }) => {
              const componentProps = {
                email,
                amount: price * 100,
                metadata: {
                  name: lastName,
                  phone,
                  custom_fields: [
                    {
                      display_name: 'paymenttype',
                      variable_name: 'paymenttype',
                      value: 'addons'
                    },
                    {
                      display_name: 'addonid',
                      variable_name: 'addonid',
                      value: id
                    },
                    {
                      display_name: 'addonname',
                      variable_name: 'addonname',
                      value: name
                    },
                    {
                      display_name: 'addonprice',
                      variable_name: 'addonprice',
                      value: price
                    },
                  ]
                },
                publicKey,
                text: "Pay Now",
                onSuccess: () =>
                  toast({ description: "Addon purchase successful" }),
                onClose: () => toast({ description: "Payment Cancelled" }),
              };
              return (
                <TableRow key={name}>
                  <TableCell>{id}</TableCell>
                  <TableCell>{name}</TableCell>
                  <TableCell className="text-left">{description}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        addonStatus["addon" + id] === "active"
                          ? ""
                          : "destructive"
                      }
                    >
                      {addonStatus["addon" + id] ?? "..."}
                    </Badge>
                  </TableCell>
                  <TableCell>{price}</TableCell>
                  <TableCell>
                    <PaystackButton
                      className="bg-primary text-primary-foreground shadow px-3 rounded-full py-1 text-xs whitespace-nowrap"
                      {...componentProps}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {addons.length === 0 && <p>No data available for this table</p>}
      </Card>
    </section>
  );
};

export default Addon;
