import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DollarSign, CreditCard, Clock, Download, AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";

import { fetchDonationStats, fetchDonations } from "../api/donationApi";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

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
    <div className="flex flex-col gap-8 pb-10 px-4 sm:px-6 lg:px-[33px] animate-in fade-in duration-500 w-full">
      {/* Header */}
      <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("donations.dashboard.title", "Donations Dashboard")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("donations.dashboard.subtitle", "Track and manage your incoming donations and settlements.")}
          </p>
        </div>
        {setStep && (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setStep("success")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t("common.actions.goBack", "Go Back")}
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Donations Card */}
        <Card className="rounded-2xl border-border/60 bg-surface shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  {t("donations.dashboard.cards.totalDonations", "Total Donations")}
                </h4>
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-foreground">
                N{Number(stats?.donation_sum || 0).toLocaleString()}
              </span>
              <p className="text-sm font-medium text-brand-green mt-1">
                {t("donations.dashboard.cards.donationsReceived", { count: stats?.donation_count || 0 })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Settlements Card */}
        <Card className="rounded-2xl border-border/60 bg-surface shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  {t("donations.dashboard.cards.settlements", "Settlements")}
                </h4>
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-foreground">
                N{Number(stats?.settlement_sum || 0).toLocaleString()}
              </span>
              <p className="text-sm font-medium text-brand-blue mt-1">
                {t("donations.dashboard.cards.settlementsCompleted", { count: stats?.settlement_count || 0 })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pending Card */}
        <Card className="rounded-2xl border-border/60 bg-surface shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  {t("donations.status.pending", "Pending")}
                </h4>
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-foreground">
                N{Number(stats?.pending_sum || 0).toLocaleString()}
              </span>
              <p className="text-sm font-medium text-amber-500 mt-1">
                {t("donations.dashboard.cards.transactionsPending", { count: stats?.pending_count || 0 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Grid List */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {t("donations.dashboard.history.title", "Donation History")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("donations.dashboard.history.description", "A detailed log of all your recent donation activity.")}
            </p>
          </div>
          <Button variant="outline" className="h-10 rounded-xl">
            <Download className="mr-2 h-4 w-4" />
            {t("donations.dashboard.history.export", "Export")}
          </Button>
        </div>

        <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
          <CardContent className="p-0">
            {/* Table Header Row */}
            <div className="hidden xl:grid grid-cols-[80px_1fr_1.5fr_1fr_1fr_1fr_150px] gap-4 px-6 py-4 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div>Ref</div>
              <div>{t("donations.dashboard.history.table.date")}</div>
              <div>{t("donations.dashboard.history.table.profile")}</div>
              <div>{t("donations.dashboard.history.table.donorDescription")}</div>
              <div>{t("donations.dashboard.history.table.purpose")}</div>
              <div>{t("donations.dashboard.history.table.amount")}</div>
              <div className="text-right">{t("donations.dashboard.history.table.status")}</div>
            </div>

            {/* List Body */}
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">
                {t("donations.dashboard.history.loading", "Loading donations...")}
              </div>
            ) : donations.length > 0 ? (
              donations.map((donation) => {
                const isSuccessful = donation.status === 1;
                const isPending = donation.status === 0;
                
                return (
                  <div 
                    key={donation.id} 
                    className="grid grid-cols-2 xl:grid-cols-[80px_1fr_1.5fr_1fr_1fr_1fr_150px] gap-3 sm:gap-4 items-center px-6 py-4 border-b border-border/30 last:border-b-0 hover:bg-black/[0.015] transition-colors"
                  >
                    <span className="text-xs font-mono text-muted-foreground" title={donation.reference}>
                      {donation.reference?.slice(0, 8)}...
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(donation.paid_at || donation.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate" title={donation.payee_name}>
                      {donation.payee_name || "Anonymous"}
                    </span>
                    <span className="text-sm text-muted-foreground truncate" title={donation.description}>
                      {donation.description || "-"}
                    </span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {donation.provider}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {donation.currency} {Number(donation.amount).toLocaleString()}
                    </span>
                    <span className="text-right flex justify-end">
                      <Badge 
                        variant="outline" 
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-semibold border-0 ${
                          isSuccessful ? "bg-brand-green/10 text-brand-green" : 
                          isPending ? "bg-amber-500/10 text-amber-600" : 
                          "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {isSuccessful ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                         isPending ? <Clock className="w-3.5 h-3.5" /> : 
                         <AlertCircle className="w-3.5 h-3.5" />}
                        {isSuccessful
                          ? t("donations.status.successful", "Successful")
                          : isPending
                          ? t("donations.status.pending", "Pending")
                          : t("donations.status.failed", "Failed")}
                      </Badge>
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-10 text-center text-muted-foreground">
                {t("donations.dashboard.history.empty", "No donations found.")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
