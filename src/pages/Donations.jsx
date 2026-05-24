import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchKyc, getBankList } from "../api/donationApi";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import BusinessVerificationFlow from "./BusinessVerificationFlow";
import DonationDashboard from "./DonationDashboard";
import IndividualDonation from "./IndividualDonation";
import VerificationStatus from "./VerificationStatus";

export default function Donations() {
  const { t } = useTranslation();
  const [step, setStep] = useState("card");
  const [banks, setBanks] = useState([]);
  const [kycStatus, setKycStatus] = useState(null);

  useEffect(() => {
    getBankList().then(setBanks).catch(console.error);

    fetchKyc()
      .then((res) => {
        setKycStatus(res);

        if (res?.success) {
          if (res.status === 1) {
            setStep("dashboard");
          } else if (res.status === 0) {
            setStep("status");
          }
        }
      })
      .catch(console.error);
  }, []);

  if (step === "dashboard") {
    return <DonationDashboard setStep={setStep} />;
  }

  return (
    <div className="flex flex-1 items-center justify-center py-20 px-4 animate-in fade-in duration-500 min-h-[calc(100vh-100px)]">
      {step === "card" &&
        !kycStatus?.success &&
        (kycStatus?.type === "business" ? (
          <BusinessVerificationFlow
            banks={banks}
            onComplete={() => setStep("status")}
          />
        ) : (
          <IndividualDonation
            banks={banks}
            onComplete={() => setStep("status")}
          />
        ))}

      {step === "status" && (
        <VerificationStatus
          status={kycStatus}
          onBack={() => setStep("card")}
          onFinish={() => setStep("success")}
        />
      )}

      {step === "success" && (
        <Card className="w-full max-w-[420px] rounded-2xl border-border/60 bg-surface shadow-lg text-center overflow-hidden">
          <CardContent className="p-10">
            <div className="flex justify-center mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-green/10">
                <CheckCircle className="h-10 w-10 text-brand-green" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {t("donations.success.title", "Verification Submitted!")}
            </h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              {t("donations.success.description", "Your KYC details have been successfully submitted and are currently under review. We will notify you once verified.")}
            </p>
            <Button
              className="w-full h-12 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)] font-semibold text-base transition-all"
              onClick={() => setStep("dashboard")}
            >
              {t("common.actions.goToDashboard", "Go to Dashboard")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
