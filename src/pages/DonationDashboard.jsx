import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchDonationStats, fetchDonations } from "../api/donationApi";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export default function DonationDashboard({ setStep }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, donationsRes] = await Promise.all([
          fetchDonationStats(),
          fetchDonations(),
        ]);
        setStats(statsRes?.data || {});
        setDonations(donationsRes?.data || []);
      } catch (err) {
        console.error("Error loading donations:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="mx-auto mt-10 w-full max-w-5xl space-y-6 px-3">
      <div className="mt-20 flex items-center justify-between md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-bold">{t("donations.dashboardTitle")}</h2>
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.dashboardSubtitle")}
          </p>
        </div>
        {setStep && (
          <Button variant="outline" size="sm" onClick={() => setStep("success")}>
            {t("actions.back")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <h4 className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.totalDonations")}
          </h4>
          <p className="text-xl font-bold">N{stats?.donation_sum || 0}</p>
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.donationsReceived", {
              count: stats?.donation_count || 0,
            })}
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.settlements")}
          </h4>
          <p className="text-xl font-bold">N{stats?.settlement_sum || 0}</p>
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.settlementsCompleted", {
              count: stats?.settlement_count || 0,
            })}
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.pending")}
          </h4>
          <p className="text-xl font-bold">N{stats?.pending_sum || 0}</p>
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.transactionsPending", {
              count: stats?.pending_count || 0,
            })}
          </p>
        </Card>
      </div>

      <div className="rounded-lg border border-border p-4 shadow-sm transition-colors duration-300 dark:bg-card">
        <div className="mb-4 flex items-center justify-between md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center">
          <div>
            <h3 className="font-semibold">{t("donations.transactionHistory")}</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              {t("donations.transactionHistoryDescription")}
            </p>
          </div>
          <Button>{t("actions.export")}</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] overflow-hidden rounded-lg border border-border text-left text-sm lg:min-w-0">
            <thead className="bg-gray-100 dark:bg-muted/70 dark:text-muted-foreground">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">{t("payments.reference")}</th>
                <th className="p-3">{t("navigation.profile")}</th>
                <th className="p-3">{t("payments.type")}</th>
                <th className="p-3">{t("donations.donorDescription")}</th>
                <th className="p-3">{t("donations.purpose")}</th>
                <th className="p-3">{t("payments.amount")}</th>
                <th className="p-3">{t("recordings.date")}</th>
                <th className="p-3">{t("streams.status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="p-6 text-center text-gray-400 dark:text-muted-foreground"
                  >
                    {t("donations.loading")}
                  </td>
                </tr>
              ) : donations.length > 0 ? (
                donations.map((donation, index) => (
                  <tr
                    key={donation.id}
                    className="border-b border-border/80 dark:bg-background/30"
                  >
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3">{donation.reference}</td>
                    <td className="p-3">{donation.payee_name}</td>
                    <td className="p-3">{t("donations.donationType")}</td>
                    <td className="p-3">{donation.description}</td>
                    <td className="p-3">{donation.provider}</td>
                    <td className="p-3">
                      N{Number(donation.amount).toLocaleString()}{" "}
                      {donation.currency}
                    </td>
                    <td className="p-3">
                      {new Date(
                        donation.paid_at || donation.created_at
                      ).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {donation.status === 1
                        ? t("donations.successful")
                        : donation.status === 0
                        ? t("donations.pending")
                        : t("donations.failed")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="9"
                    className="p-6 text-center text-gray-400 dark:text-muted-foreground"
                  >
                    {t("donations.noTransactions")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
