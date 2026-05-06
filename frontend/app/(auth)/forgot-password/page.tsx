"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";
import { Video, ArrowRight, ArrowLeft, Mail, KeyRound, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen w-full bg-surface relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-brand-blue/5 to-transparent -z-10" />
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-brand-green/5 blur-[120px] -z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-30 -z-10" />

      <div className="flex w-full flex-col justify-center items-center px-4 sm:px-12 md:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px]"
        >
          <Link href="/login" className="inline-flex items-center text-sm font-medium text-text-muted hover:text-brand-blue transition-colors mb-8 group">
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to login
          </Link>

          <div className="flex flex-col space-y-8">
            <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-105 w-fit">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-green shadow-md shadow-brand-green/20">
                <Video className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-brand-blue">konn3ct</span>
            </Link>

            <div className="flex flex-col space-y-2 text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 mb-2">
                <KeyRound className="h-6 w-6 text-brand-blue" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Reset password</h1>
              <p className="text-[15px] text-text-muted">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <div className="grid gap-6">
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <label htmlFor="email" className="text-sm font-semibold text-text-primary">
                    Email
                  </label>
                  <Input
                    id="email"
                    placeholder="name@example.com"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </div>
                <Button className="w-full h-12 rounded-xl bg-brand-green hover:bg-[#287854] shadow-[0_8px_24px_rgba(32,116,80,0.25)] hover:shadow-[0_12px_32px_rgba(32,116,80,0.35)] transition-all text-base font-semibold" size="lg">
                  Send Reset Link
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-blue/5 border border-brand-blue/10">
              <Info className="h-4 w-4 text-brand-blue mt-0.5 shrink-0" />
              <p className="text-xs text-text-muted leading-relaxed">
                If you don&apos;t receive an email within a few minutes, please check your spam folder. The reset link expires after 24 hours.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
