import { useState, useEffect } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { CheckCircle } from "lucide-react";

import IndividualDonation from "./IndividualDonation";
import BusinessVerificationFlow from "./BusinessVerificationFlow";
import DonationDashboard from "./DonationDashboard";
import VerificationStatus from "./VerificationStatus";

import { getBankList, fetchKyc } from "../api/donationApi";

export default function Donations() {
  const [step, setStep] = useState("card"); // "card" | "status" | "success" | "dashboard"
  const [banks, setBanks] = useState([]);
  const [kycStatus, setKycStatus] = useState(null);

  // 🏦 Fetch bank list + KYC
  useEffect(() => {
    getBankList().then(setBanks).catch(console.error);

    fetchKyc()
      .then((res) => {
        setKycStatus(res);

        if (res?.success) {
          if (res.status === 1) {
            // ✅ Verified → Dashboard
            setStep("dashboard");
          } else if (res.status === 0) {
            // ⏳ Pending → Status page
            setStep("status");
          }
        }
      })
      .catch(console.error);
  }, []);

  // 🚀 Auto show Dashboard if verified
  if (step === "dashboard") {
    return <DonationDashboard setStep={setStep} />;
  }

  return (
    <div className="flex-1 flex justify-center py-10 mt-14 items-center">
      {/* Step 1: Start KYC (only if no KYC yet) */}
      {step === "card" && !kycStatus?.success && (
        kycStatus?.type === "business" ? (
          <BusinessVerificationFlow banks={banks} onComplete={() => setStep("status")} />
        ) : (
          <IndividualDonation banks={banks} onComplete={() => setStep("status")} />
        )
      )}

      {/* Step 2: Verification Status */}
      {step === "status" && (
        <VerificationStatus
          status={kycStatus}
          onBack={() => setStep("card")}
          onFinish={() => setStep("success")}
        />
      )}

      {/* Step 3: Success → then Dashboard */}
      {step === "success" && (
        <Card className="w-[360px] rounded-2xl border border-gray-200 p-8 text-center shadow-md space-y-4 md:w-[420px] lg:w-[360px]">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Verification Complete!</h2>
          <p className="text-sm text-gray-500">
            Your account has been successfully verified. You can now start accepting donations.
          </p>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
            onClick={() => setStep("dashboard")}
          >
            Go to Dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}
