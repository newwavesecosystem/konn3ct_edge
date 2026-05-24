import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PaystackButton } from "react-paystack";
import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";

import { getAddons } from "../api/addonsApi";
import { getUser } from "../api/userApi";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../hooks/use-toast";
import { cn } from "../lib/utils";

const getStatusLabel = (status, t) => {
  switch (status) {
    case "active":
      return t("addons.status.active");
    case "inactive":
      return t("addons.status.inactive");
    case "running":
      return t("addons.status.running");
    case "ended":
      return t("addons.status.ended");
    case "verified":
      return t("addons.status.verified");
    case "pending":
      return t("addons.status.pending");
    case "success":
      return t("addons.status.success");
    case "failed":
      return t("addons.status.failed");
    case "inprogress":
      return t("addons.status.inProgress");
    case "loading":
      return t("addons.status.loading");
    default:
      return status;
  }
};

const Addon = () => {
  const { t } = useTranslation();
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
      <section className="page container mx-auto !px-4 sm:!px-6 lg:!px-[33px]">
        <Card className="p-6 rounded-2xl">
          <p className="font-medium">{t("addons.states.loadErrorTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("addons.states.loadErrorDescription")}
          </p>
        </Card>
      </section>
    );
  }

  if (!isSuccess || !userIsSuccess) {
    return (
      <div className="p-6">
        <Skeleton className="w-full h-32 rounded-2xl mb-8" />
        <div className="grid gap-5 md:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
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
    <div className="flex flex-col gap-8 pb-10 px-4 sm:px-6 lg:px-[33px] animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("addons.title", "Addons & Services")}</h1>
        <p className="text-muted-foreground mt-1">{t("addons.subtitle", "Enhance your plan with additional features and resources.")}</p>
      </div>

      {/* Addons Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {addons.map(({ name, description, price, id }, index) => {
          const statusValue = addonStatus["addon" + id];
          const normalizedStatus = typeof statusValue === "string" ? statusValue.trim().toLowerCase() : "";
          const isActive = normalizedStatus === "active";

          const componentProps = {
            email,
            amount: price * 100,
            metadata: {
              name: lastName,
              phone,
              custom_fields: [
                { display_name: "paymenttype", variable_name: "paymenttype", value: "addons" },
                { display_name: "addonid", variable_name: "addonid", value: id },
                { display_name: "addonname", variable_name: "addonname", value: name },
                { display_name: "addonprice", variable_name: "addonprice", value: price },
              ],
            },
            publicKey,
            text: t("addons.actions.payNow"),
            onSuccess: () => toast({ description: t("addons.toasts.purchaseSuccessful") }),
            onClose: () => toast({ description: t("addons.toasts.paymentCancelled") }),
          };

          const colorTheme = isActive ? "brand-green" : "brand-blue";

          return (
            <Card key={id} className="rounded-2xl border-border/60 bg-surface overflow-hidden hover:shadow-lg hover:shadow-brand-blue/5 transition-all duration-300 flex flex-col h-full relative">
              <CardContent className="p-6 flex flex-col flex-1">
                {/* Header Area */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${colorTheme}/10 text-${colorTheme} shrink-0`}>
                    <Layers className="h-6 w-6" />
                  </div>
                  <Badge 
                    variant={isActive ? "default" : "secondary"} 
                    className={cn("px-2.5 py-0.5 text-xs font-bold rounded-md uppercase tracking-wider", isActive ? "bg-brand-green/10 text-brand-green hover:bg-brand-green/20" : "")}
                  >
                    {statusValue ? getStatusLabel(normalizedStatus, t) : t("addons.status.unknown")}
                  </Badge>
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-2">{name}</h3>
                <p className="text-sm text-muted-foreground flex-1 mb-6 leading-relaxed">
                  {description}
                </p>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-foreground">
                    NGN {new Intl.NumberFormat('en-NG').format(price)}
                  </span>
                </div>

                <div className="mt-auto">
                  <div className="w-full">
                    <PaystackButton
                      className={`w-full h-11 rounded-xl font-semibold transition-all inline-flex items-center justify-center text-sm ${isActive ? "bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)]" : "bg-primary hover:bg-primary/90 text-primary-foreground"}`}
                      {...componentProps}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {addons.length === 0 && (
        <div className="flex justify-center items-center h-40">
          <p className="text-muted-foreground">{t("addons.states.noData")}</p>
        </div>
      )}
    </div>
  );
};

export default Addon;
