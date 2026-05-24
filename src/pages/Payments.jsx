import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import React from "react";
import { Check, Crown, Zap, Shield, ArrowRight, FileText } from "lucide-react";
import { getList, getPlans } from "../api/plansApi";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { TabsContent } from "@radix-ui/react-tabs";
import { capitalize } from "../lib/utils";
import { getUser } from "../api/userApi";
import { useToast } from "../hooks/use-toast";
import { PaystackButton } from "react-paystack";
import { format } from "date-fns";
import { contactSalesUrl } from "../lib/externalLinks";
import { useTranslation } from "react-i18next";
import { Skeleton } from "../components/ui/skeleton";

const ENGLISH_LOCALE = "en-NG";

const generateReceipt = (payment, user, toast, t) => {
  const userLastName = user?.lastname ?? user?.lastName ?? "";
  const userFirstName = user?.firstname ?? user?.firstName ?? "";
  const win = window.open("", "_blank", "width=800,height=650");

  if (!win) {
    toast({
      description: t("payments.toasts.allowPopups"),
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
            <span>${payment.currency} ${new Intl.NumberFormat(
    ENGLISH_LOCALE
  ).format(payment.amount)}</span>
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
  const yes = t("payments.features.yes");
  const no = t("payments.features.no");

  const buildFeatures = (plan) => [
    t("payments.features.recording", { value: plan.recording ? yes : no }),
    t("payments.features.duration", { value: plan.duration }),
    t("payments.features.participants", { value: plan.participant }),
    t("payments.features.rooms", { value: plan.rooms }),
    t("payments.features.customizeLink", { value: plan.customize_link ? yes : no }),
    t("payments.features.breakoutRooms", { value: plan.breakout_rooms ? yes : no }),
    t("payments.features.accessCode", { value: plan.access_code ? yes : no }),
    t("payments.features.dialIn", { value: plan.dialin ? yes : no }),
  ];

  const monthlyPlans = planList.map((plan) => ({
    name: plan.name,
    price: String(plan?.monthly_cost ?? "0").split("/")[0],
    target: t("payments.planCard.targetIndividuals"),
    category: "monthly",
    features: buildFeatures(plan),
    cta: plan.name === "basic" ? t("payments.planCard.free") : t("payments.planCard.upgrade"),
  }));

  const yearlyPlans = planList.map((plan) => ({
    name: plan.name,
    price: String(plan?.yearly_cost ?? "0").split("/")[0],
    target: t("payments.planCard.targetIndividuals"),
    category: "yearly",
    features: buildFeatures(plan),
    cta: plan.name === "basic" ? t("payments.planCard.free") : t("payments.planCard.upgrade"),
  }));

  const hasEnterprise = (arr) => arr.some((p) => String(p.name).toLowerCase() === "enterprise");

  const enterprisePlan = {
    name: "enterprise",
    price: t("payments.planCard.customPrice"),
    target: t("payments.planCard.targetEnterprise"),
    features: [t("payments.planCard.customFeatures")],
    cta: t("payments.actions.contactSales"),
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
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, "PPP");
};

const getPlanStyles = (planName) => {
  const lower = planName?.toLowerCase() || "";
  if (lower.includes("basic") || lower.includes("free")) {
    return { color: "border-border", icon: Zap };
  } else if (lower.includes("enterprise") || lower.includes("custom")) {
    return { color: "border-brand-blue", icon: Shield };
  } else {
    // Default / Pro styles
    return { color: "border-brand-green", icon: Crown, popular: true };
  }
};

const Payments = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: plansData, isLoading: plansLoading, isError: plansError } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    select: (response) => transformPlans(response.data, t),
  });

  const { data: userData, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ["profile-dashboard"],
    queryFn: getUser,
  });

  const { data: paymentData, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: getList,
  });

  if (plansLoading || userLoading || paymentsLoading) {
    return (
      <div className="p-6">
        <Skeleton className="w-full h-32 rounded-2xl mb-8" />
        <div className="grid gap-5 md:grid-cols-3 mb-8">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (plansError || userError) {
    return (
      <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Card className="p-6 rounded-2xl">
          <p className="font-medium">{t("payments.states.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("payments.states.loadErrorDescription")}</p>
        </Card>
      </section>
    );
  }

  const currentPlanName = userData?.user_plan?.name || "Basic";
  const { icon: PlanIcon } = getPlanStyles(currentPlanName);
  
  const paymentRows = Array.isArray(paymentData?.payments?.data) ? paymentData.payments.data : [];
  const profileUser = userData?.user ?? {};
  const email = profileUser.email ?? "";
  const lastName = profileUser.lastName ?? profileUser.lastname ?? "";
  const phone = profileUser.phone ?? "";
  const publicKey = process.env.REACT_APP_PAYSTACK_KEY;

  const paystackBaseProps = {
    email,
    metadata: { name: lastName, phone },
    publicKey,
    text: t("payments.actions.payNow"),
    onSuccess: () => toast({ description: t("payments.toasts.purchaseSuccessful") }),
    onClose: () => toast({ description: t("payments.toasts.paymentCancelled") }),
  };

  return (
    <div className="flex flex-col gap-8 pb-10 px-4 sm:px-6 lg:px-[33px] animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("payments.listTitle", "Billing")}</h1>
        <p className="text-muted-foreground mt-1">{t("payments.listSubtitle", "Manage your subscription and billing details.")}</p>
      </div>

      {/* Current Plan Banner */}
      <Card className="rounded-2xl border-brand-green/30 bg-brand-green/5 overflow-hidden">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green text-white shadow-md">
              <PlanIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{capitalize(currentPlanName)} Plan</h2>
                <span className="px-2 py-0.5 rounded-md bg-brand-green/10 text-brand-green text-[11px] font-bold uppercase">{t("payments.currentPlan", "Active")}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{profileUser.email}</p>
            </div>
          </div>
          <Button variant="outline" className="h-11 rounded-xl px-4 border-brand-green/30 text-brand-green hover:bg-brand-green hover:text-white transition-all">
            {t("payments.actions.manageSubscription", "Manage Subscription")}
          </Button>
        </CardContent>
      </Card>

      {/* Plans Section */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-5">{t("payments.actions.changePlan", "Choose a Plan")}</h2>
        
        <Tabs defaultValue="monthly" className="flex flex-col">
          <TabsList className="mb-6 self-start grid w-[300px] grid-cols-2 rounded-xl bg-black/[0.04] p-1 h-12">
            <TabsTrigger className="rounded-lg h-full data-[state=active]:bg-surface data-[state=active]:shadow-sm transition-all" value="monthly">
              {t("payments.billingCycle.monthly")}
            </TabsTrigger>
            <TabsTrigger className="rounded-lg h-full data-[state=active]:bg-surface data-[state=active]:shadow-sm transition-all" value="yearly">
              {t("payments.billingCycle.yearly")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="grid gap-5 md:grid-cols-3">
            {plansData?.monthly.map((plan, i) => (
              <PlanCard 
                key={i} 
                plan={plan} 
                currentPlanName={currentPlanName}
                paystackBaseProps={paystackBaseProps}
              />
            ))}
          </TabsContent>

          <TabsContent value="yearly" className="grid gap-5 md:grid-cols-3">
            {plansData?.yearly.map((plan, i) => (
              <PlanCard 
                key={i} 
                plan={plan} 
                currentPlanName={currentPlanName}
                paystackBaseProps={paystackBaseProps}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invoice History */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-5">{t("payments.listTitle", "Invoice History")}</h2>
        <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
          <CardContent className="p-0">
            <div className="hidden sm:grid grid-cols-5 gap-4 px-6 py-4 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div>{t("payments.table.paymentDate")}</div>
              <div>{t("payments.table.plan")}</div>
              <div>{t("payments.table.reference")}</div>
              <div>{t("payments.table.amount")}</div>
              <div className="text-right">{t("payments.table.action")}</div>
            </div>
            
            {paymentRows.map((row, i) => (
              <div key={row.reference} className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 items-center px-6 py-4 border-b border-border/30 last:border-b-0 hover:bg-black/[0.015] transition-colors">
                <span className="text-sm font-medium text-foreground">{formatPaymentDate(row.date) || t("payments.states.notAvailable")}</span>
                <span className="text-sm text-muted-foreground">{row.plan_details?.name?.toUpperCase()}</span>
                <span className="text-sm text-muted-foreground truncate">{row.reference}</span>
                <span className="text-sm font-semibold text-foreground">{row.currency} {new Intl.NumberFormat(ENGLISH_LOCALE).format(row.amount)}</span>
                <span className="text-right flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold rounded-lg hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"
                    onClick={() => generateReceipt({
                        type: row.type,
                        plan: row.plan_details?.name?.toUpperCase(),
                        method: row.gateway,
                        reference: row.reference,
                        date: row.date,
                        currency: row.currency,
                        amount: row.amount,
                      }, profileUser, toast, t)}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    {t("payments.actions.receipt", "Receipt")}
                  </Button>
                </span>
              </div>
            ))}

            {!paymentRows.length && (
              <div className="py-10 text-center text-muted-foreground text-sm">
                {t("payments.empty")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payments;

const PlanCard = ({ plan, currentPlanName, paystackBaseProps }) => {
  const { color, icon: Icon, popular } = getPlanStyles(plan.name);
  const isCurrent = currentPlanName.toLowerCase() === plan.name.toLowerCase();
  
  const isCustomPrice = isNaN(Number(plan.price));
  const fullPaystackProps = isCustomPrice ? undefined : {
    ...paystackBaseProps,
    amount: Number(plan.price) * 100,
    metadata: {
      ...paystackBaseProps.metadata,
      custom_fields: [
        { display_name: "paymenttype", variable_name: "paymenttype", value: "subscription" },
        { display_name: "plantype", variable_name: "plantype", value: plan.category },
        { display_name: "planname", variable_name: "planname", value: plan.name },
        { display_name: "planprice", variable_name: "planprice", value: plan.price },
      ],
    },
  };

  return (
    <Card className={`rounded-2xl ${color} bg-surface overflow-hidden relative h-full flex flex-col ${popular ? "shadow-lg shadow-brand-green/10" : ""}`}>
      {popular && (
        <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl bg-brand-green text-white text-[11px] font-bold uppercase">
          Popular
        </div>
      )}
      <CardContent className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isCurrent ? "bg-black/[0.04] text-muted-foreground" : popular ? "bg-brand-green text-white" : "bg-brand-blue/10 text-brand-blue"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{capitalize(plan.name)}</h3>
            <p className="text-xs text-muted-foreground">{plan.target}</p>
          </div>
        </div>

        <div className="mb-6">
          <span className="text-4xl font-extrabold text-foreground">{isCustomPrice ? plan.price : `NGN ${plan.price}`}</span>
          {!isCustomPrice && <span className="text-muted-foreground text-sm"> / {plan.category === "monthly" ? "mo" : "yr"}</span>}
        </div>

        <ul className="space-y-3 flex-1 mb-6">
          {plan.features.map((feature, j) => (
            <li key={j} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                popular ? "bg-brand-green/10 text-brand-green" : "bg-black/[0.04] text-muted-foreground"
              }`}>
                <Check className="h-3 w-3" />
              </div>
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-auto">
          {isCurrent ? (
            <Button disabled className="w-full h-11 rounded-xl font-semibold opacity-60">
              Current Plan
            </Button>
          ) : fullPaystackProps ? (
            <div className="w-full">
              <PaystackButton
                className={`w-full h-11 rounded-xl font-semibold transition-all inline-flex items-center justify-center text-sm ${
                  popular ? "bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)]" : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
                {...fullPaystackProps}
              />
            </div>
          ) : (
            <Button
              className="w-full h-11 rounded-xl font-semibold bg-brand-blue hover:bg-[#0047E1] text-white"
              onClick={() => contactSalesUrl && window.open(contactSalesUrl, "_blank", "noopener,noreferrer")}
            >
              {plan.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
