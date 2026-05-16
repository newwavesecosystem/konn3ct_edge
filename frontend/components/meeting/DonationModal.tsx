"use client";

import React, { useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { X, Gift } from "lucide-react";
import { PaystackButton } from "react-paystack";
import { toast } from "sonner";

interface DonationModalProps {
  onClose: () => void;
}

export function DonationModal({ onClose }: DonationModalProps) {
  const { currentUser, isDonationActive, sendDonationSuccess, meetingInfo } = useMeeting();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");

  if (!isDonationActive) return null;

  const config = {
    reference: `donate_${new Date().getTime()}_${currentUser.id}`,
    email: (currentUser as any).email || `participant_${currentUser.id}@konn3ct.net`,
    amount: parseInt(amount) * 100, // Amount is in the country's lowest currency. E.g Kobo
    currency: currency,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder_key",
  };

  const handlePaystackSuccessAction = (reference: any) => {
    // Notify others via WebRTC
    sendDonationSuccess(parseInt(amount), currency);

    const backendDomain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN || "localhost:3000";
    const protocol = backendDomain.includes("localhost") ? "http" : "https";

    // Call Backend API to verify and record in DB
    fetch(`${protocol}://${backendDomain}/api/payments/donate/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: reference.reference,
        amountKobo: config.amount,
        currency,
        roomId: meetingInfo.roomSlug // We use slug as roomId in context for now
      })
    }).catch(e => console.error("Failed to record donation", e));

    toast.success("Thank you for your generous donation!", { duration: 5000 });
    onClose();
  };

  const handlePaystackCloseAction = () => {
    console.log("Paystack closed");
  };

  const componentProps = {
    ...config,
    text: `Donate ${currency} ${amount || 0}`,
    onSuccess: (reference: any) => handlePaystackSuccessAction(reference),
    onClose: handlePaystackCloseAction,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ backgroundColor: "var(--mt-bg-elevated)", border: "1px solid var(--mt-border-strong)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-[var(--mt-text-muted)] hover:bg-[var(--mt-bg-hover)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green mb-3">
              <Gift className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[var(--mt-text)] text-center">Support & Offering</h2>
            <p className="text-sm text-[var(--mt-text-muted)] text-center mt-1">
              Your generous donation supports the host.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--mt-text-muted)] mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[var(--mt-bg)] text-[var(--mt-text)] border border-[var(--mt-border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-green"
              >
                <option value="NGN">🇳🇬 NGN (Naira)</option>
                <option value="USD">🇺🇸 USD (Dollars)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--mt-text-muted)] mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--mt-text-muted)] font-semibold">
                  {currency === "NGN" ? "₦" : "$"}
                </span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[var(--mt-bg)] text-[var(--mt-text)] border border-[var(--mt-border)] rounded-xl pl-8 pr-4 py-3 text-lg font-semibold focus:outline-none focus:border-brand-green"
                />
              </div>
            </div>

            <div className="pt-2">
              {parseInt(amount) > 0 ? (
                <PaystackButton
                  {...componentProps}
                  className="w-full bg-brand-green hover:bg-brand-green/90 text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-brand-green/20"
                />
              ) : (
                <button
                  disabled
                  className="w-full bg-[var(--mt-bg-hover)] text-[var(--mt-text-muted)] font-semibold py-3 px-4 rounded-xl cursor-not-allowed"
                >
                  Enter an amount
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
