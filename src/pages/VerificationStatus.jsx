import { Card } from "../components/ui/card";

export default function VerificationStatus({ status, onBack, onFinish }) {
  const kyc = status?.data || {};
  const overallStatus = status?.status; // 0 = verified, 1 = pending

  const steps = [
    {
      key: "personal",
      title: "Personal Information",
      desc: "Basic personal details and contact info",
      isDone: !!(kyc.first_name && kyc.last_name && kyc.email && kyc.address),
    },
    {
      key: "identity",
      title: "Identity Verification",
      desc: "Government-issued ID verification",
      isDone: !!kyc.id_type && !!kyc.id_document,
    },
    {
      key: "bvn",
      title: "BVN Verification",
      desc: "Bank Verification Number validation",
      isDone: !!kyc.bvn,
    },
    {
      key: "bank",
      title: "Bank Account Verification",
      desc: "Bank account details for settlements",
      isDone:
        !!kyc.bank_name && !!kyc.bank_account_number && !!kyc.bank_account_name,
    },
  ];

  const completed = steps.filter((s) => s.isDone).length;
  const progress = overallStatus === 0 ? 100 : Math.round((completed / steps.length) * 100);

  return (
    <Card className="p-6 w-full max-w-2xl mx-auto rounded-2xl shadow-md space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-green-100 text-green-700 p-2 rounded-full">👤</span>
            Verification Status
          </h2>
          <p className="text-sm text-gray-500">
          Account verification progress
          </p>
        </div>
        {/* <button
          className="px-4 py-1 border rounded-md"
          onClick={onBack}
        >
          ← Back
        </button> */}
      </div>

      {/* Progress Bar */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-medium">Overall Verification Status</h3>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              overallStatus === 0
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {overallStatus === 0 ? "Verified ✓" : "In Progress"}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {completed} of {steps.length} verification levels completed
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-right text-xs text-gray-500">{progress}%</p>
      </div>

      {/* Step List */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.key}
            className="flex justify-between items-center border rounded-xl p-4"
          >
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-gray-500">{step.desc}</p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                step.isDone
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {step.isDone ? "Verified ✓" : "Pending ⏳"}
            </span>
          </div>
        ))}
      </div>

      {/* {overallStatus === 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={onFinish}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
          >
            Finish Verification
          </button>
        </div>
      )} */}
    </Card>
  );
}
