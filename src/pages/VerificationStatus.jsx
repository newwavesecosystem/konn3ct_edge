import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";

export default function VerificationStatus({ status }) {
  const { t } = useTranslation();
  const kyc = status?.data || {};
  const overallStatus = status?.status;

  const steps = [
    {
      key: "personal",
      title: t("donations.verification.steps.personal.title", "Personal Information"),
      desc: t("donations.verification.steps.personal.description", "Basic profile details"),
      isDone: !!(kyc.first_name && kyc.last_name && kyc.email && kyc.address),
    },
    {
      key: "identity",
      title: t("donations.verification.steps.identity.title", "Identity Verification"),
      desc: t("donations.verification.steps.identity.description", "Government issued ID"),
      isDone: !!kyc.id_type && !!kyc.id_document,
    },
    {
      key: "bvn",
      title: t("donations.verification.steps.bvn.title", "BVN Verification"),
      desc: t("donations.verification.steps.bvn.description", "Bank Verification Number"),
      isDone: !!kyc.bvn,
    },
    {
      key: "bank",
      title: t("donations.verification.steps.bank.title", "Bank Details"),
      desc: t("donations.verification.steps.bank.description", "Account for settlements"),
      isDone: !!kyc.bank_name && !!kyc.bank_account_number && !!kyc.bank_account_name,
    },
  ];

  const completed = steps.filter((step) => step.isDone).length;
  const progress = overallStatus === 0 ? 100 : Math.round((completed / steps.length) * 100);

  return (
    <Card className="w-full max-w-2xl rounded-2xl border-border/60 bg-surface shadow-md overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green shrink-0">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {t("donations.verification.title", "Verification Status")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("donations.verification.description", "Track the progress of your KYC verification.")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-black/[0.02] p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">
              {t("donations.verification.overallStatus", "Overall Status")}
            </h3>
            <Badge 
              variant="outline" 
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-bold uppercase tracking-wider text-xs border-0 ${
                overallStatus === 0
                  ? "bg-brand-green/10 text-brand-green"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {overallStatus === 0 ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {overallStatus === 0
                ? t("donations.status.verified", "Verified")
                : t("donations.status.inProgress", "In Progress")}
            </Badge>
          </div>
          
          <div className="flex justify-between items-end mb-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t("donations.verification.progressSummary", {
                completed,
                total: steps.length,
              })} {completed} of {steps.length} steps completed
            </p>
            <p className="text-sm font-bold text-foreground">
              {progress}%
            </p>
          </div>
          <div className="h-2.5 w-full rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-green transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground px-1">{t("donations.verification.checklist", "Verification Checklist")}</h3>
          {steps.map((step) => (
            <div
              key={step.key}
              className="flex items-start sm:items-center justify-between rounded-xl border border-border/40 bg-surface p-4 hover:bg-black/[0.01] transition-colors"
            >
              <div className="pr-4">
                <p className="font-bold text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.desc}
                </p>
              </div>
              <Badge 
                variant="outline" 
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-semibold text-xs border-0 ${
                  step.isDone
                    ? "bg-brand-green/10 text-brand-green"
                    : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {step.isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {step.isDone
                  ? t("donations.status.verified", "Verified")
                  : t("donations.status.pending", "Pending")}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
