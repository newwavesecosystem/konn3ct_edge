import { useEffect, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { fetchDonations, fetchDonationStats } from "../api/donationApi";

export default function DonationDashboard({ setStep }) {
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
        console.log(donationsRes?.data);
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

    <div className="w-full max-w-5xl space-y-6 mx-auto mt-10 px-3">
      {/* Header */}
      <div className="flex mt-20 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Donations Dashboard</h2>
          <p className="text-gray-500 text-sm">Individual Account • Verified</p>
        </div>
        {setStep && (
          <Button variant="outline" size="sm" onClick={() => setStep("success")}>
            ← Back
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h4 className="text-gray-500 text-sm">Total Donations</h4>
          <p className="text-xl font-bold">
            ₦{stats?.donation_sum || 0}
          </p>
          <p className="text-sm text-gray-500">
            {stats?.donation_count || 0} donations received
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="text-gray-500 text-sm">Settlements</h4>
          <p className="text-xl font-bold">
            ₦{stats?.settlement_sum || 0}
          </p>
          <p className="text-sm text-gray-500">
            {stats?.settlement_count || 0} settlements completed
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="text-gray-500 text-sm">Pending</h4>
          <p className="text-xl font-bold">
            ₦{stats?.pending_sum || 0}
          </p>
          <p className="text-sm text-gray-500">
            {stats?.pending_count || 0} transaction(s) pending
          </p>
        </Card>
      </div>

      {/* Transaction History */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold">Transaction History</h3>
            <p className="text-sm text-gray-500">
              View all your donation and settlement transactions
            </p>
          </div>
          <Button>Export</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Donor/Description</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center p-6 text-gray-400">Loading...</td>
                </tr>
              ) : donations.length > 0 ? (
                donations.map((d, i) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3">{d.reference}</td>
                    <td className="p-3">{d.payee_name}</td>
                    <td className="p-3">Donation</td>
                    <td className="p-3">{d.description}</td>
                    <td className="p-3">{d.provider}</td>
                    <td className="p-3">₦{Number(d.amount).toLocaleString()} {d.currency}</td>
                    <td className="p-3">{new Date(d.paid_at || d.created_at).toLocaleString()}</td>
                    <td className="p-3">{d.status === 1 ? "Successful" : d.status === 0 ? "Pending" : "Failed"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center p-6 text-gray-400">No transactions yet</td>
                </tr>
              )}
            </tbody>


          </table>
        </div>
      </div>
    </div>
  );
}
