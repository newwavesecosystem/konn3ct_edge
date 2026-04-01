import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  requestForgotPassword,
  resetForgotPassword,
} from "../../api/forgetpassword.js";
import { useToast } from "../../hooks/use-toast";

export function ForgotPassword() {
  const { t } = useTranslation();
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
        description: t("auth.forgotPassword.errors.enterEmail"),
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
        description:
          err.message || t("auth.forgotPassword.errors.requestFailed"),
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
        document.getElementById(`code-${index + 1}`)?.focus();
      }
    }
  };

  const handleVerifyCode = () => {
    const enteredCode = code.join("");
    if (enteredCode.length === 4) {
      setStep(3);
    } else {
      toast({
        description: t("auth.forgotPassword.errors.invalidCode"),
        variant: "destructive",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      toast({
        description: t("auth.forgotPassword.errors.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        description: t("auth.forgotPassword.errors.passwordsDoNotMatch"),
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
        description: err.message || t("auth.forgotPassword.errors.resetFailed"),
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
            <h2 className="mb-2 text-lg font-bold">
              {t("auth.forgotPassword.title")}
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
              {t("auth.forgotPassword.description")}
            </p>
            <input
              type="email"
              placeholder={t("auth.forgotPassword.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border p-2 dark:border-input dark:bg-background dark:text-foreground"
            />
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full rounded-lg bg-[#012E89] py-2 text-white"
            >
              {loading
                ? t("auth.forgotPassword.sending")
                : t("auth.forgotPassword.resetPassword")}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-2 text-lg font-bold">
              {t("auth.forgotPassword.checkEmail")}
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
              {t("auth.forgotPassword.checkEmailDescription", { email })}
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
              {t("actions.continue")}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mb-2 text-lg font-bold">
              {t("auth.forgotPassword.newPasswordTitle")}
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
              {t("auth.forgotPassword.newPasswordDescription")}
            </p>

            <div className="mb-4 text-left">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-foreground">
                {t("auth.password")}
              </label>
              <input
                type="password"
                placeholder={t("auth.forgotPassword.newPasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border p-2 dark:border-input dark:bg-background dark:text-foreground"
              />
            </div>

            <div className="mb-4 text-left">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-foreground">
                {t("auth.forgotPassword.confirmPassword")}
              </label>
              <input
                type="password"
                placeholder={t("auth.forgotPassword.confirmPasswordPlaceholder")}
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
              {loading
                ? t("auth.forgotPassword.updating")
                : t("auth.forgotPassword.updatePassword")}
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="mb-2 text-lg font-bold text-green-600 dark:text-green-300">
              {t("auth.forgotPassword.updatedTitle")}
            </h2>
            <p className="mb-6 text-sm text-gray-500 dark:text-muted-foreground">
              {t("auth.forgotPassword.updatedDescription")}
            </p>
            <button
              onClick={handleGoToLogin}
              className="w-full rounded-lg bg-[#012E89] py-2 text-white"
            >
              {t("auth.forgotPassword.goToLogin")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
