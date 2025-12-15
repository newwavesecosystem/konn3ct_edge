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
import { format, compareAsc, formatDistance, formatRelative, subDays } from 'date-fns'

// Transform the fetched plans
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

  // Fetch subscription plans
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    select: (data) => transformPlans(data.data),
  });

  // Fetch user data (for current plan)
  const {
    data: userData,
    isLoading: userLoading,
    isError: userError,
  } = useQuery({
    queryKey: ["profile-dashboard"],
    queryFn: getUser,
  });

  // Fetch user payment (for current plan)
  const {
    data: paymentData,
  } = useQuery({
    queryKey: ["payments"],
    queryFn: getList,
  });

  // ✅ Extract current plan safely
  const currentPlan = capitalize(userData?.user_plan?.name || "Basic");


  if (isLoading || userLoading) {
    return <div>Loading plans...</div>;
  }

  if (isError || userError) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <section className="page container mx-auto">
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <div className="flex items-end gap-x-5 mb-10">
          {/* CURRENT PLAN CARD */}
          <Card className="w-[260px] h-[200px] bg-primary">
            <Badge className="bg-white hover:bg-white text-primary">
              Current Plan
            </Badge>
            <div className="w-full h-[calc(100%-40px)] flex justify-center items-center">
              <p className="text-4xl font-medium text-white">{currentPlan.toUpperCase()}</p>
            </div>
          </Card>

          {/* BUTTONS SECTION */}
          <div className="flex flex-col gap-y-3">
            {currentPlan.toLowerCase() !== "basic" && (
              <DialogTrigger asChild>
                <Button className="text-[#373131] bg-muted">
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
          <div className="p-4 pt-10 flex items-center gap-20">
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
                {/*<TableHead>Expiry Date</TableHead>*/}
                <TableHead>Amount</TableHead>
                {/*<TableHead>Action</TableHead>*/}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentData.payments.data.map(({ type, name, gateway, date, plan_details, currency, amount, reference }, id) => (
                <TableRow key={name + date}>
                  <TableCell>{id + 1}</TableCell>
                  <TableCell>{type}</TableCell>
                  <TableCell>{plan_details?.name.toString().toUpperCase()}</TableCell>
                  <TableCell>{userData?.user?.lastname} {userData?.user?.firstname}</TableCell>
                  <TableCell>{gateway}</TableCell>
                  <TableCell>{reference}</TableCell>
                  <TableCell>{date}</TableCell>
                  {/*<TableCell>{date}</TableCell>*/}
                  <TableCell>{currency} {new Intl.NumberFormat().format(amount.toString())}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {paymentData.payments.data.length === 0 && (
            <div className="flex justify-center items-center min-h-[200px]">
              <p>No data available for this table</p>
            </div>
          )}
        </Card>

        {/* PLANS MODAL */}
        <DialogContent className="max-w-[95%] py-6">
          <DialogTitle>Plans and Payments</DialogTitle>
          <PaymentsDialog plans={data} setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Payments;

// ======================================
// PAYMENTS DIALOG (PLANS + PAYSTACK)
// ======================================
const PaymentsDialog = ({ plans, setOpenDialog }) => {
  const { data, isSuccess } = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
  });
  const { toast } = useToast();

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

  if (isSuccess)
    return (
      <div className="">
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
                name={plan.name}
                cta={plan.cta}
                target={plan.target}
                price={plan.price}
                features={plan.features}
                setOpenDialog={setOpenDialog}
                paystackProps={{
                  text: plan.cta,
                  amount: plan.price * 100,
                  ...componentProps,
                  metadata: {
                    custom_fields: [
                      {
                        display_name: 'paymenttype',
                        variable_name: 'paymenttype',
                        value: 'subscription'
                      },
                      {
                        display_name: 'plantype',
                        variable_name: 'plantype',
                        value: plan.category
                      },
                      {
                        display_name: 'planname',
                        variable_name: 'planname',
                        value: plan.name
                      },
                      {
                        display_name: 'planprice',
                        variable_name: 'planprice',
                        value: plan.price
                      }
                    ]
                  }
                }}
              />
            ))}
            <PlanCard
              name="Enterprise"
              cta="Contact Sales"
              target="For Enterprise"
              price="Custom"
              features={["Custom Features"]}
              setOpenDialog={setOpenDialog}
            />
          </TabsContent>
          <TabsContent value="yearly" className="flex justify-evenly gap-x-6">
            {plans.yearly.map((plan, index) => (
              <PlanCard
                key={index}
                name={plan.name}
                cta={plan.cta}
                target={plan.target}
                price={plan.price}
                features={plan.features}
                setOpenDialog={setOpenDialog}
                paystackProps={{
                  text: plan.cta,
                  amount: plan.price * 100,
                  ...componentProps,
                }}
              />
            ))}
            <PlanCard
              name="Enterprise"
              cta="Contact Sales"
              target="For Enterprise"
              price="Custom"
              features={["Custom Features"]}
              setOpenDialog={setOpenDialog}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
};

// ======================================
// PLAN CARD COMPONENT
// ======================================
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
