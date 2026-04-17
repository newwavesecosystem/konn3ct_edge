import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PaystackButton } from "react-paystack";

import { getAddons } from "../api/addonsApi";
import { getUser } from "../api/userApi";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useToast } from "../hooks/use-toast";

const getStatusLabel = (status) => {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "running":
      return "Running";
    case "ended":
      return "Ended";
    case "verified":
      return "Verified";
    case "pending":
      return "Pending";
    case "success":
      return "Successful";
    case "failed":
      return "Failed";
    case "inprogress":
      return "In Progress";
    case "loading":
      return "Loading...";
    default:
      return status;
  }
};

const Addon = () => {
  const { toast } = useToast();
  const { data, isSuccess, isError } = useQuery({
    queryFn: getAddons,
    queryKey: ["addons"],
  });
  const {
    data: userData,
    isSuccess: userIsSuccess,
    isError: userIsError,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
  });

  const publicKey = process.env.REACT_APP_PAYSTACK_KEY;

  if (isError || userIsError) {
    return (
      <section className="page container mx-auto">
        <Card className="p-6">
          <p className="font-medium">Unable to load addons right now.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please retry in a moment.
          </p>
        </Card>
      </section>
    );
  }

  if (!isSuccess || !userIsSuccess) {
    return (
      <div className="page container mx-auto">
        <Skeleton className="relative min-h-full w-full" />
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
      <Card className="min-h-full w-full">
        <div className="flex items-center gap-20 p-4 pt-8 md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center lg:gap-20 lg:pt-10">
          <h3 className="text-xl font-medium">Addon List</h3>
        </div>
        <Separator />
        <Table className="min-w-[760px] lg:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Service Description</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addons.map(({ name, description, price, id }) => {
              const statusValue = addonStatus["addon" + id];
              const normalizedStatus =
                typeof statusValue === "string"
                  ? statusValue.trim().toLowerCase()
                  : "";

              const componentProps = {
                email,
                amount: price * 100,
                metadata: {
                  name: lastName,
                  phone,
                  custom_fields: [
                    {
                      display_name: "paymenttype",
                      variable_name: "paymenttype",
                      value: "addons",
                    },
                    {
                      display_name: "addonid",
                      variable_name: "addonid",
                      value: id,
                    },
                    {
                      display_name: "addonname",
                      variable_name: "addonname",
                      value: name,
                    },
                    {
                      display_name: "addonprice",
                      variable_name: "addonprice",
                      value: price,
                    },
                  ],
                },
                publicKey,
                text: "Pay Now",
                onSuccess: () =>
                  toast({ description: "Addon purchase successful" }),
                onClose: () =>
                  toast({ description: "Payment Cancelled" }),
              };

              return (
                <TableRow key={name}>
                  <TableCell>{id}</TableCell>
                  <TableCell>{name}</TableCell>
                  <TableCell className="text-left">{description}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={statusValue === "active" ? "" : "destructive"}
                    >
                      {statusValue
                        ? getStatusLabel(normalizedStatus)
                        : "..."}
                    </Badge>
                  </TableCell>
                  <TableCell>{price}</TableCell>
                  <TableCell>
                    <PaystackButton
                      className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground shadow"
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
