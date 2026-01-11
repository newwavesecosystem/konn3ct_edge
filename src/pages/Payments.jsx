import { useQuery } from "@tanstack/react-query";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
} from "../components/ui/table";
import { Check } from "lucide-react";
import { getList, getPlans } from "../api/plansApi";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { TabsContent } from "@radix-ui/react-tabs";
import { capitalize } from "../lib/utils";
import { getUser } from "../api/userApi";
import { useToast } from "../hooks/use-toast";
import { PaystackButton } from "react-paystack";
import { format } from "date-fns";

/* ======================================
   RECEIPT GENERATOR
====================================== */
const generateReceipt = (payment, user) => {
  const win = window.open("", "_blank", "width=800,height=650");


  if (!win) {
    alert("Please allow popups to print receipt");
    return;
  }

  win.document.write(`
    <html>
      <head>
        <title>Payment Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #222;
          }
          h1 {
            text-align: center;
            margin-bottom: 5px;
          }
          .subtitle {
            text-align: center;
            margin-bottom: 30px;
          }
          .box {
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 6px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
          }
          .label {
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <h1>Konn3ct</h1>
        <p class="subtitle">Payment Receipt</p>

        <div class="box">
          <div class="row">
            <span class="label">Issued To:</span>
            <span>${user.lastname} ${user.firstname}</span>
          </div>
          <div class="row">
            <span class="label">Plan:</span>
            <span>${payment.plan}</span>
          </div>
          <div class="row">
            <span class="label">Payment Type:</span>
            <span>${payment.type}</span>
          </div>
          <div class="row">
            <span class="label">Payment Method:</span>
            <span>${payment.method}</span>
          </div>
          <div class="row">
            <span class="label">Reference:</span>
            <span>${payment.reference}</span>
          </div>
          <div class="row">
            <span class="label">Payment Date:</span>
            <span>${payment.date}</span>
          </div>
          <div class="row">
            <span class="label">Amount Paid:</span>
            <span>${payment.currency} ${new Intl.NumberFormat().format(
              payment.amount
            )}</span>
          </div>
        </div>

        <div class="footer">
          <p>This receipt was generated electronically.</p>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  win.document.close();
};

/* ======================================
   TRANSFORM PLANS
====================================== */
const transformPlans = (data) => {
  const monthlyPlans = data.plan.map((plan) => ({
    name: plan.name,
    price: plan.monthly_cost.split("/")[0],
    target: "For individuals",
    category: "monthly",
    features: [
      `Recording: ${plan.recording ? "Yes" : "No"}`,
      `Duration: ${plan.duration} minutes`,
      `Participants: ${plan.participant}`,
      `Rooms: ${plan.rooms}`,
      `Customize Link: ${plan.customize_link ? "Yes" : "No"}`,
      `Breakout Rooms: ${plan.breakout_rooms ? "Yes" : "No"}`,
      `Access Code: ${plan.access_code ? "Yes" : "No"}`,
      `Dial-in: ${plan.dialin ? "Yes" : "No"}`,
    ],
    cta: plan.name === "basic" ? "Free" : "Upgrade",
  }));

  const yearlyPlans = data.plan.map((plan) => ({
    name: plan.name,
    price: plan.yearly_cost.split("/")[0],
    target: "For individuals",
    category: "yearly",
    features: [
      `Recording: ${plan.recording ? "Yes" : "No"}`,
      `Duration: ${plan.duration} minutes`,
      `Participants: ${plan.participant}`,
      `Rooms: ${plan.rooms}`,
      `Customize Link: ${plan.customize_link ? "Yes" : "No"}`,
      `Breakout Rooms: ${plan.breakout_rooms ? "Yes" : "No"}`,
      `Access Code: ${plan.access_code ? "Yes" : "No"}`,
      `Dial-in: ${plan.dialin ? "Yes" : "No"}`,
    ],
    cta: plan.name === "basic" ? "Free" : "Upgrade",
  }));

  return { monthly: monthlyPlans, yearly: yearlyPlans };
};

const Payments = () => {
  const [openDialog, setOpenDialog] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    select: (data) => transformPlans(data.data),
  });

  const {
    data: userData,
    isLoading: userLoading,
    isError: userError,
  } = useQuery({
    queryKey: ["profile-dashboard"],
    queryFn: getUser,
  });

  const {
    data: paymentData,
    isLoading: paymentsLoading,
  } = useQuery({
    queryKey: ["payments"],
    queryFn: getList,
  });

  const currentPlan = capitalize(userData?.user_plan?.name || "Basic");

  if (isLoading || userLoading) return <div>Loading plans...</div>;
  if (isError || userError) return <div>Error: {error.message}</div>;

  return (
    <section className="page container mx-auto">
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <div className="flex items-end gap-x-5 mb-10">
          <Card className="w-[260px] h-[200px] bg-primary">
            <Badge className="bg-white text-primary">Current Plan</Badge>
            <div className="flex justify-center items-center h-full">
              <p className="text-4xl font-medium text-white">
                {currentPlan.toUpperCase()}
              </p>
            </div>
          </Card>

          <div className="flex flex-col gap-y-3">
            {currentPlan.toLowerCase() !== "basic" && (
              <DialogTrigger asChild>
                <Button className="bg-muted text-[#373131]">
                  Renew Subscriptions
                </Button>
              </DialogTrigger>
            )}
            <DialogTrigger asChild>
              <Button variant="outline">Change Plan</Button>
            </DialogTrigger>
          </div>
        </div>

        {/* PAYMENT LIST */}
        <Card className="mb-20">
          <div className="p-4 pt-10">
            <h3 className="font-medium text-xl">Payment List</h3>
          </div>
          <Separator />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Issued to</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paymentData?.payments?.data?.map(
                (
                  {
                    type,
                    gateway,
                    date,
                    plan_details,
                    currency,
                    amount,
                    reference,
                  },
                  id
                ) => (
                  <TableRow key={reference}>
                    <TableCell>{id + 1}</TableCell>
                    <TableCell>{type}</TableCell>
                    <TableCell>
                      {plan_details?.name?.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {userData?.user?.lastname}{" "}
                      {userData?.user?.firstname}
                    </TableCell>
                    <TableCell>{gateway}</TableCell>
                    <TableCell>{reference}</TableCell>
                    <TableCell>
                      {format(new Date(date), "PPP")}
                    </TableCell>
                    <TableCell>
                      {currency}{" "}
                      {new Intl.NumberFormat().format(amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          generateReceipt(
                            {
                              type,
                              plan: plan_details?.name?.toUpperCase(),
                              method: gateway,
                              reference,
                              date,
                              currency,
                              amount,
                            },
                            userData.user
                          )
                        }
                      >
                        Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              )}

              {!paymentsLoading &&
                !paymentData?.payments?.data?.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6">
                      No payments found
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </Card>

        <DialogContent className="max-w-[95%] py-6">
          <DialogTitle>Plans and Payments</DialogTitle>
          <PaymentsDialog plans={data} setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Payments;

/* ======================================
   PAYMENTS DIALOG + PLAN CARD
====================================== */
const PaymentsDialog = ({ plans, setOpenDialog }) => {
  const { data, isSuccess, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
  });

  const { toast } = useToast();

  // ✅ FIX: wait before destructuring
  if (isLoading || !isSuccess) {
    return <div className="py-10 text-center">Loading user...</div>;
  }

  const { email, lastName, phone } = data.user;
  const publicKey = process.env.REACT_APP_PAYSTACK_KEY;

  const componentProps = {
    email,
    metadata: {
      name: lastName,
      phone,
    },
    publicKey,
    text: "Pay Now",
    onSuccess: () => toast({ description: "Purchase successful" }),
    onClose: () => toast({ description: "Payment Cancelled" }),
  };

  return (
    <div>
      <Tabs defaultValue="monthly" className="flex flex-col">
        <TabsList className="grid grid-cols-2 mx-auto mb-6 w-[300px] shadow-md border-2 bg-slate-50 rounded-full p-0">
          <TabsTrigger className="rounded-full" value="monthly">
            Monthly
          </TabsTrigger>
          <TabsTrigger className="rounded-full" value="yearly">
            Yearly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="flex justify-evenly gap-x-6">
          {plans.monthly.map((plan, index) => (
            <PlanCard
              key={index}
              {...plan}
              setOpenDialog={setOpenDialog}
              paystackProps={{
                ...componentProps,
                amount: Number(plan.price) * 100, // ✅ FIX
              }}
            />
          ))}
        </TabsContent>

        <TabsContent value="yearly" className="flex justify-evenly gap-x-6">
          {plans.yearly.map((plan, index) => (
            <PlanCard
              key={index}
              {...plan}
              setOpenDialog={setOpenDialog}
              paystackProps={{
                ...componentProps,
                amount: Number(plan.price) * 100, // ✅ FIX
              }}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ======================================
   PLAN CARD COMPONENT
====================================== */
const PlanCard = ({
  name,
  target,
  price,
  features,
  paystackProps,
  setOpenDialog,
  cta,
}) => {
  return (
    <Card className="flex-1 max-w-[350px] rounded-2xl px-[30px] py-[20px] bg-muted">
      <h3 className="font-medium text-2xl mb-1">{capitalize(name)}</h3>
      <p className="mb-4">{target}</p>
      <p className="text-center font-bold text-2xl mb-2">
        {isNaN(price) ? price : "₦" + price}
      </p>

      <div className="flex justify-center mb-6">
        {paystackProps ? (
          <div onClick={() => setOpenDialog(false)}>
            <PaystackButton
              className="bg-primary text-primary-foreground shadow px-4 rounded-full py-1"
              {...paystackProps}
            />
          </div>
        ) : (
          <Button
            onClick={() => (window.location.href = "mailto:info@konn3ct.com")}
          >
            {cta}
          </Button>
        )}
      </div>

      <div className="mb-6">
        {features.map((feature, index) => (
          <div key={index} className="flex gap-x-2 items-center gap-y-1">
            <Check className="h-4 w-4" />
            <p>{feature}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
