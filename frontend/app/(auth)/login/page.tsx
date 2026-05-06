"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";
import { Video, ArrowRight, CheckCircle2, Mail, Lock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left side: Form */}
      <div className="flex w-full flex-col h-screen overflow-y-auto py-8 justify-center lg:w-1/2 px-4 sm:px-12 md:px-24 bg-surface relative">
        {/* Subtle pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-30 -z-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto flex w-full max-w-[420px] flex-col justify-center space-y-8"
        >
          <Link href="/" className="flex items-center gap-2.5 mt-4 mb-4 transition-transform hover:scale-105 w-fit">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-green shadow-md shadow-brand-green/20">
              <Video className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-brand-blue">konn3ct</span>
          </Link>

          <div className="flex flex-col space-y-2 text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Welcome back</h1>
            <p className="text-[15px] text-text-muted">
              Enter your credentials to access your account
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
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-text-primary">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-sm font-medium text-brand-green hover:text-brand-blue transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                />
              </div>
              <Button className="w-full mt-1 h-12 rounded-xl bg-brand-green hover:bg-[#287854] shadow-[0_8px_24px_rgba(32,116,80,0.25)] hover:shadow-[0_12px_32px_rgba(32,116,80,0.35)] transition-all text-base font-semibold" size="lg">
                Log In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-3 text-text-muted font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" className="w-full h-12 rounded-xl border-border/60 hover:bg-black/[0.02] hover:border-border transition-all">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Google
              </Button>
              <Button variant="outline" type="button" className="w-full h-12 rounded-xl border-border/60 hover:bg-black/[0.02] hover:border-border transition-all">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#00A4EF" d="M11.4 24H0V12.6h11.4V24z" /><path fill="#FFB900" d="M11.4 11.4H0V0h11.4v11.4z" /><path fill="#F25022" d="M24 11.4H12.6V0H24v11.4z" /><path fill="#7FBA00" d="M24 24H12.6V12.6H24V24z" /></svg>
                Microsoft
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-brand-green hover:text-brand-blue transition-colors">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right side: Visuals */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue via-[#0038A8] to-brand-green z-0" />

        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[80px] z-0" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-green/20 blur-[100px] z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] z-0" />

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-1.5 text-sm font-medium text-white mb-6"
          >
            <Sparkles className="mr-2 h-4 w-4 text-[#FFD400]" />
            <span>Secure & Reliable</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 space-y-6 max-w-lg"
        >
          <h2 className="text-4xl font-extrabold leading-tight">
            Connect with your team from anywhere in the world.
          </h2>
          <p className="text-lg text-white/70 leading-relaxed">
            Experience premium video quality, seamless collaboration tools, and bank-grade security—all in one platform.
          </p>

          {/* Testimonial card */}
          <div className="mt-8 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
            <p className="text-sm text-white/90 italic leading-relaxed">&ldquo;konn3ct transformed how our team collaborates across 3 continents. Crystal clear audio, zero lag.&rdquo;</p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold">AK</div>
              <div>
                <p className="text-sm font-semibold text-white">Amara Kone</p>
                <p className="text-xs text-white/60">CTO, TechCorp Africa</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
