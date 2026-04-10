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
import { useTranslation } from "react-i18next";
import { contactSalesUrl } from "../lib/externalLinks";

const generateReceipt = (payment, user, toast, t, language) => {
  const userLastName = user?.lastname ?? user?.lastName ?? "";
  const userFirstName = user?.firstname ?? user?.firstName ?? "";
  const win = window.open("", "_blank", "width=800,height=650");

  if (!win) {
    toast({
      description: t("payments.popupBlocked"),
      variant: "destructive",
    });
    return;
  }

  win.document.write(`
    <html>
      <head>
        <title>${t("payments.receipt.title")}</title>
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
        <p class="subtitle">${t("payments.receipt.title")}</p>

        <div class="box">
          <div class="row">
            <span class="label">${t("payments.receipt.issuedTo")}</span>
            <span>${userLastName} ${userFirstName}</span>
          </div>
          <div class="row">
            <span class="label">${t("payments.receipt.plan")}</span>
            <span>${payment.plan}</span>
          </div>
          <div class="row">
            <span class="label">${t("payments.receipt.paymentType")}</span>
            <span>${payment.type}</span>
          </div>
          <div class="row">
            <span class="label">${t("payments.receipt.paymentMethod")}</span>
            <span>${payment.method}</span>
          </div>
          <div class="row">
            <span class="label">${t("payments.receipt.reference")}</span>
            <span>${payment.reference}</span>
          </div>
          <div class="row">
            <span class="label">${t("payments.receipt.paymentDate")}</span>
            <span>${payment.date}</span>
          </div>
          <div class="row">
            <span class="label">${t("payments.receipt.amountPaid")}</span>
            <span>${payment.currency} ${new Intl.NumberFormat(language).format(
    payment.amount
  )}</span>
          </div>
        </div>

        <div class="footer">
          <p>${t("payments.receipt.footer")}</p>
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

const transformPlans = (data, t) => {
  const planList = Array.isArray(data?.plan) ? data.plan : [];
  const yes = t("generic.yes");
  const no = t("generic.no");

  const buildFeatures = (plan) => [
    t("payments.features.recording", {
      value: plan.recording ? yes : no,
    }),
    t("payments.features.duration", { value: plan.duration }),
    t("payments.features.participants", { value: plan.participant }),
    t("payments.features.rooms", { value: plan.rooms }),
    t("payments.features.customizeLink", {
      value: plan.customize_link ? yes : no,
    }),
    t("payments.features.breakoutRooms", {
      value: plan.breakout_rooms ? yes : no,
    }),
    t("payments.features.accessCode", {
      value: plan.access_code ? yes : no,
    }),
    t("payments.features.dialIn", {
      value: plan.dialin ? yes : no,
    }),
  ];

  const monthlyPlans = planList.map((plan) => ({
    name: plan.name,
    price: String(plan?.monthly_cost ?? "0").split("/")[0],
    target: t("payments.forIndividuals"),
    category: "monthly",
    features: buildFeatures(plan),
    cta: plan.name === "basic" ? t("payments.free") : t("payments.upgrade"),
  }));

  const yearlyPlans = planList.map((plan) => ({
    name: plan.name,
    price: String(plan?.yearly_cost ?? "0").split("/")[0],
    target: t("payments.forIndividuals"),
    category: "yearly",
    features: buildFeatures(plan),
    cta: plan.name === "basic" ? t("payments.free") : t("payments.upgrade"),
  }));

  const hasEnterprise = (arr) =>
    arr.some((p) => String(p.name).toLowerCase() === "enterprise");

  const enterprisePlan = {
    name: "enterprise",
    price: t("payments.custom"),
    target: t("payments.forEnterprise"),
    features: [t("payments.customFeatures")],
    cta: t("payments.contactSales"),
  };

  if (!hasEnterprise(monthlyPlans)) {
    monthlyPlans.push({ ...enterprisePlan, category: "monthly" });
  }
  if (!hasEnterprise(yearlyPlans)) {
    yearlyPlans.push({ ...enterprisePlan, category: "yearly" });
  }

  return { monthly: monthlyPlans, yearly: yearlyPlans };
};

const formatPaymentDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : format(parsed, "PPP");
};

const Payments = () => {
  const { t, i18n } = useTranslation();
  const [openDialog, setOpenDialog] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    select: (response) => transformPlans(response.data, t),
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
  const paymentRows = Array.isArray(paymentData?.payments?.data)
    ? paymentData.payments.data
    : [];

  if (isLoading || userLoading) return <div>{t("payments.loadingPlans")}</div>;

  if (isError || userError) {
    return (
      <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Card className="p-6">
          <p className="font-medium">{t("payments.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("payments.loadErrorDescription")}
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-x-5">
          <Card className="h-[200px] w-full max-w-[260px] border-slate-200 bg-white text-slate-900 dark:border-border dark:bg-card dark:text-foreground lg:w-[260px]">
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100 dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted"
            >
              {t("payments.currentPlan")}
            </Badge>
            <div className="flex h-full items-center justify-center">
              <p className="text-4xl font-medium text-slate-900 dark:text-foreground">
                {currentPlan.toUpperCase()}
              </p>
            </div>
          </Card>

          <div className="flex w-full flex-col gap-y-3 lg:w-auto">
            {currentPlan.toLowerCase() !== "basic" && (
              <DialogTrigger asChild>
                <Button className="w-full bg-muted text-foreground hover:bg-muted/80 lg:w-auto">
                  {t("payments.renewSubscriptions")}
                </Button>
              </DialogTrigger>
            )}
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full lg:w-auto">
                {t("payments.changePlan")}
              </Button>
            </DialogTrigger>
          </div>
        </div>

        <Card className="mb-20">
          <div className="p-4 pt-10">
            <h3 className="font-medium text-xl">{t("payments.paymentList")}</h3>
          </div>
          <Separator />

          <div className="w-full overflow-x-auto">
            <Table className="min-w-[760px] lg:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("payments.type")}</TableHead>
                  <TableHead>{t("payments.plan")}</TableHead>
                  <TableHead>{t("payments.issuedTo")}</TableHead>
                  <TableHead>{t("payments.paymentMethod")}</TableHead>
                  <TableHead>{t("payments.reference")}</TableHead>
                  <TableHead>{t("payments.paymentDate")}</TableHead>
                  <TableHead>{t("payments.amount")}</TableHead>
                  <TableHead>{t("payments.action")}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paymentRows.map(
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
                      <TableCell>{plan_details?.name?.toUpperCase()}</TableCell>
                      <TableCell>
                        {userData?.user?.lastname} {userData?.user?.firstname}
                      </TableCell>
                      <TableCell>{gateway}</TableCell>
                      <TableCell>{reference}</TableCell>
                      <TableCell>{formatPaymentDate(date)}</TableCell>
                      <TableCell>
                        {currency} {new Intl.NumberFormat(i18n.language).format(amount)}
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
                              userData?.user ?? {},
                              toast,
                              t,
                              i18n.language
                            )
                          }
                        >
                          {t("payments.receiptButton")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                )}

                {!paymentsLoading && !paymentRows.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center">
                      {t("payments.noPayments")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <DialogContent className="w-[calc(100%-2rem)] py-6 md:w-[calc(100%-4rem)] md:max-w-5xl lg:max-w-[95%]">
          <DialogTitle>{t("payments.dialogTitle")}</DialogTitle>
          <PaymentsDialog plans={data} setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Payments;

const PaymentsDialog = ({ plans, setOpenDialog }) => {
  const { t } = useTranslation();
  const { data, isSuccess, isLoading, isError } = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
  });

  const { toast } = useToast();

  if (isError) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {t("payments.unableToLoadCheckout")}
      </div>
    );
  }

  if (isLoading || !isSuccess) {
    return <div className="py-10 text-center">{t("generic.loadingUser")}</div>;
  }

  const profileUser = data?.user ?? {};
  const email = profileUser.email ?? "";
  const lastName = profileUser.lastName ?? profileUser.lastname ?? "";
  const phone = profileUser.phone ?? "";
  const publicKey = process.env.REACT_APP_PAYSTACK_KEY;
  const monthlyPlans = Array.isArray(plans?.monthly) ? plans.monthly : [];
  const yearlyPlans = Array.isArray(plans?.yearly) ? plans.yearly : [];

  const componentProps = {
    email,
    metadata: {
      name: lastName,
      phone,
    },
    publicKey,
    text: t("payments.payNow"),
    onSuccess: () => toast({ description: t("payments.purchaseSuccessful") }),
    onClose: () => toast({ description: t("payments.paymentCancelled") }),
  };

  return (
    <div>
      <Tabs defaultValue="monthly" className="flex flex-col">
        <TabsList className="mx-auto mb-6 grid w-[300px] grid-cols-2 rounded-full border-2 bg-muted p-0 shadow-md">
          <TabsTrigger className="rounded-full" value="monthly">
            {t("payments.monthly")}
          </TabsTrigger>
          <TabsTrigger className="rounded-full" value="yearly">
            {t("payments.yearly")}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="monthly"
          className="flex flex-col items-center gap-4 md:grid md:w-full md:grid-cols-2 md:items-stretch lg:flex lg:flex-row lg:justify-evenly lg:gap-x-6"
        >
          {monthlyPlans.map((plan, index) => (
            <PlanCard
              key={index}
              {...plan}
              setOpenDialog={setOpenDialog}
              paystackProps={
                isNaN(Number(plan.price))
                  ? undefined
                  : {
                      ...componentProps,
                      amount: Number(plan.price) * 100,
                    }
              }
            />
          ))}
        </TabsContent>

        <TabsContent
          value="yearly"
          className="flex flex-col items-center gap-4 md:grid md:w-full md:grid-cols-2 md:items-stretch lg:flex lg:flex-row lg:justify-evenly lg:gap-x-6"
        >
          {yearlyPlans.map((plan, index) => (
            <PlanCard
              key={index}
              {...plan}
              setOpenDialog={setOpenDialog}
              paystackProps={
                isNaN(Number(plan.price))
                  ? undefined
                  : {
                      ...componentProps,
                      amount: Number(plan.price) * 100,
                    }
              }
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const PlanCard = ({
  name,
  target,
  price,
  features = [],
  paystackProps,
  setOpenDialog,
  cta,
}) => {
  const planFeatures = Array.isArray(features) ? features : [];

  return (
    <Card className="mx-auto w-full max-w-[350px] flex-1 rounded-2xl bg-muted px-[30px] py-[20px] md:max-w-none lg:mx-0 lg:max-w-[350px]">
      <h3 className="mb-1 text-2xl font-medium">{capitalize(name)}</h3>
      <p className="mb-4">{target}</p>
      <p className="mb-2 text-center text-2xl font-bold">
        {isNaN(price) ? price : "₦" + price}
      </p>

      <div className="mb-6 flex justify-center">
        {paystackProps ? (
          <div onClick={() => setOpenDialog(false)}>
            <PaystackButton
              className="rounded-full bg-primary px-4 py-1 text-primary-foreground shadow"
              {...paystackProps}
            />
          </div>
        ) : (
          <Button
            onClick={() =>
              contactSalesUrl &&
              window.open(contactSalesUrl, "_blank", "noopener,noreferrer")
            }
          >
            {cta}
          </Button>
        )}
      </div>

      <div className="mb-6">
        {planFeatures.map((feature, index) => (
          <div key={index} className="flex items-center gap-x-2 gap-y-1">
            <Check className="h-4 w-4" />
            <p>{feature}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
