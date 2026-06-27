"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { Check, Shield, ArrowRight, Lock, User } from "lucide-react";
import { motion } from "framer-motion";

export default function TeamInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // In a real app, you would fetch invite details using the token from the URL params.
  // We mock the invite details here.
  const inviteDetails = {
    inviterName: "Alex Doe",
    inviterRole: "Owner",
    organization: "Konn3ct Inc",
    invitedEmail: "new.member@example.com",
    assignedRole: "Admin",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !password) {
      toast.error("Please fill in all fields to complete your profile.");
      return;
    }

    setIsSubmitting(true);

    // Simulate API call for account activation
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      toast.success("Account activated successfully!");
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-green/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-blue/10 rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="rounded-3xl border-border/60 bg-surface shadow-2xl overflow-hidden">
          <CardContent className="p-0">
            {/* Header Area */}
            <div className="bg-gradient-to-br from-brand-blue/10 to-brand-green/10 p-8 text-center border-b border-border/40 relative">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-green text-white shadow-lg shadow-brand-green/20 mb-4">
                <span className="text-2xl font-extrabold tracking-tight">K.</span>
              </div>
              <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Join {inviteDetails.organization}</h1>
              <p className="text-sm text-text-muted mt-2">
                <span className="font-semibold text-text-primary">{inviteDetails.inviterName}</span> has invited you to collaborate as an {inviteDetails.assignedRole}.
              </p>
            </div>

            {/* Form Area */}
            <div className="p-8">
              {!isSuccess ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email Address</p>
                    <p className="font-medium text-text-primary">{inviteDetails.invitedEmail}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-primary">First Name</label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Sarah"
                        className="h-11 bg-black/[0.02]"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-primary">Last Name</label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Kim"
                        className="h-11 bg-black/[0.02]"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-primary">Create Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      leftIcon={<Lock className="w-4 h-4" />}
                      className="h-11 bg-black/[0.02]"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      className="w-full h-12 rounded-xl bg-brand-green hover:bg-[#287854] text-white font-bold shadow-[0_6px_20px_rgba(32,116,80,0.2)] transition-all"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Activating Account...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Join Team <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-center text-text-muted pt-2">
                    By joining, you agree to the Terms of Service and Privacy Policy.
                  </p>
                </form>
              ) : (
                <div className="py-8 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center">
                    <Check className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-primary">Account Activated!</h3>
                    <p className="text-sm text-text-muted mt-2">Redirecting you to the dashboard...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
