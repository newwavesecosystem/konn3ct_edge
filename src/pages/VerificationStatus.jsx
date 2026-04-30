import { Card } from "../components/ui/card";
import { useTranslation } from "react-i18next";

export default function VerificationStatus({ status }) {
  const { t } = useTranslation();
  const kyc = status?.data || {};
  const overallStatus = status?.status;

  const steps = [
    {
      key: "personal",
      title: t("donations.verification.steps.personal.title"),
      desc: t("donations.verification.steps.personal.description"),
      isDone: !!(kyc.first_name && kyc.last_name && kyc.email && kyc.address),
    },
    {
      key: "identity",
      title: t("donations.verification.steps.identity.title"),
      desc: t("donations.verification.steps.identity.description"),
      isDone: !!kyc.id_type && !!kyc.id_document,
    },
    {
      key: "bvn",
      title: t("donations.verification.steps.bvn.title"),
      desc: t("donations.verification.steps.bvn.description"),
      isDone: !!kyc.bvn,
    },
    {
      key: "bank",
      title: t("donations.verification.steps.bank.title"),
      desc: t("donations.verification.steps.bank.description"),
      isDone:
        !!kyc.bank_name && !!kyc.bank_account_number && !!kyc.bank_account_name,
    },
  ];

  const completed = steps.filter((step) => step.isDone).length;
  const progress =
    overallStatus === 0 ? 100 : Math.round((completed / steps.length) * 100);

  return (
    <Card className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="rounded-full bg-green-100 p-2 text-green-700 dark:bg-green-500/15 dark:text-green-300">
              {t("donations.verification.userBadge")}
            </span>
            {t("donations.verification.title")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.verification.description")}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4 dark:bg-background/40">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{t("donations.verification.overallStatus")}</h3>
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              overallStatus === 0
                ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200"
            }`}
          >
            {overallStatus === 0
              ? t("donations.status.verified")
              : t("donations.status.inProgress")}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          {t("donations.verification.progressSummary", {
            completed,
            total: steps.length,
          })}
        </p>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-muted">
          <div
            className="h-2 rounded-full bg-green-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-right text-xs text-gray-500 dark:text-muted-foreground">
          {progress}%
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.key}
            className="flex items-center justify-between rounded-xl border border-border p-4 md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center dark:bg-background/30"
          >
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-gray-500 dark:text-muted-foreground">
                {step.desc}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs ${
                step.isDone
                  ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200"
              }`}
            >
              {step.isDone
                ? t("donations.status.verified")
                : t("donations.status.pending")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
