import React, { useState } from "react";

import {
  requestForgotPassword,
  resetForgotPassword,
} from "../../api/forgetpassword.js";
import { useToast } from "../../hooks/use-toast";

export function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(Array(4).fill(""));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async () => {
    if (!email) {
      toast({
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await requestForgotPassword(email, "email");
      setStep(2);
    } catch (err) {
      console.error(err);
      toast({
        description: err.message || "Failed to request reset.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value, index) => {
    if (/^[0-9]?$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      if (value && index < code.length - 1) {
        document.getElementById(`code-${index + 1}`).focus();
      }
    }
  };

  const handleVerifyCode = () => {
    const enteredCode = code.join("");
    if (enteredCode.length === 4) {
      setStep(3);
    } else {
      toast({
        description: "Enter a valid 4-digit code.",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      toast({
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await resetForgotPassword(email, "email", code.join(""), password);
      setStep(4);
    } catch (err) {
      console.error(err);
      toast({
        description: err.message || "Failed to reset password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-background">
      <div className="w-[400px] rounded-2xl bg-white p-8 text-center shadow-md dark:border dark:border-border dark:bg-card md:w-[480px] lg:w-[400px]">
        {step === 1 && (
          <>
            <h2 className="mb-2 text-lg font-bold">Forgot password</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
              Please enter your email to reset the password
            </p>
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border p-2 dark:border-input dark:bg-background dark:text-foreground"
            />
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full rounded-lg bg-[#012E89] py-2 text-white"
            >
              {loading ? "Sending..." : "Reset Password"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-2 text-lg font-bold">Check your email</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
              We sent a reset code to {email}. Enter the 4-digit code.
            </p>
            <div className="mb-4 flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(e.target.value, index)}
                  className="h-12 w-12 rounded-lg border text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-input dark:bg-background dark:text-foreground"
                />
              ))}
            </div>
            <button
              onClick={handleVerifyCode}
              className="w-full rounded-lg bg-[#012E89] py-2 text-white"
            >
              Continue
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mb-2 text-lg font-bold">Set a new password</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
              Create a new password. Ensure it differs from previous ones.
            </p>

            <div className="mb-4 text-left">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-foreground">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border p-2 dark:border-input dark:bg-background dark:text-foreground"
              />
            </div>

            <div className="mb-4 text-left">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-foreground">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border p-2 dark:border-input dark:bg-background dark:text-foreground"
              />
            </div>

            <button
              onClick={handleUpdatePassword}
              disabled={loading}
              className="w-full rounded-lg bg-[#012E89] py-2 text-white"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="mb-2 text-lg font-bold text-green-600 dark:text-green-300">
              Password Updated!
            </h2>
            <p className="mb-6 text-sm text-gray-500 dark:text-muted-foreground">
              Your password has been successfully reset. You can now sign in
              with your new password.
            </p>
            <button
              onClick={handleGoToLogin}
              className="w-full rounded-lg bg-[#012E89] py-2 text-white"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
