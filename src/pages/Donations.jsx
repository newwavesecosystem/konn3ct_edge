import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchKyc, getBankList } from "../api/donationApi";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
    <div className="mt-14 flex flex-1 items-center justify-center py-10">
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
        <Card className="w-[360px] space-y-4 rounded-2xl border border-gray-200 p-8 text-center shadow-md dark:border-border md:w-[420px] lg:w-[360px]">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-300" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
            {t("donations.success.title")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            {t("donations.success.description")}
          </p>
          <Button
            className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700"
            onClick={() => setStep("dashboard")}
          >
            {t("common.actions.goToDashboard")}
          </Button>
        </Card>
      )}
    </div>
  );
}
