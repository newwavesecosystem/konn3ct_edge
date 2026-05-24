import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { User, Lock, Monitor, ChevronRight, Shield, Computer, Copy } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSessions, getUser, logoutSession } from "../../api/userApi";
import { capitalize } from "../../lib/utils";
import { useToast } from "../../hooks/use-toast";
import { Skeleton } from "../../components/ui/skeleton";
import { getReferralCodeFromRecord, getReferralLinkFromRecord } from "../../lib/referral";

// --- Profile Section ---
const ProfileSection = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const userQuery = useQuery({ queryKey: ["profile"], queryFn: getUser });

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ description: t("profile.toasts.copied") });
  };

  if (userQuery.isLoading) {
    return <Skeleton className="h-[400px] w-full rounded-2xl" />;
  }
  
  if (userQuery.isError) {
    return (
      <Card className="p-6">
        <p className="font-medium">{t("profile.states.profileLoadErrorTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("profile.states.profileLoadErrorDescription")}</p>
      </Card>
    );
  }

  const user = userQuery.data?.user ?? {};
  const userPlan = userQuery.data?.user_plan ?? {};
  const referralCode = getReferralCodeFromRecord(user);
  const referralLink = getReferralLinkFromRecord(user);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="rounded-2xl border-border/60 bg-surface overflow-hidden">
        <ProfileForm />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Plan Info */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6">
            <h3 className="text-base font-bold text-foreground mb-4">{t("profile.info.activePlan")}</h3>
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-black/[0.01]">
              <div>
                <p className="text-sm font-semibold text-foreground">{capitalize(userPlan?.name ?? "Basic")}</p>
                <p className="text-xs text-muted-foreground">Current subscription plan</p>
              </div>
              <div className="px-3 py-1 bg-brand-green/10 text-brand-green text-xs font-bold rounded-full">
                {capitalize(userPlan?.status ?? "Active")}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Info */}
        <Card className="rounded-2xl border-border/60 bg-surface">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">{t("profile.info.referralCode")}</h3>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm bg-black/[0.04] px-2 py-1 rounded-md">{referralCode || "N/A"}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(referralCode)} disabled={!referralCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("profile.info.referralLink")}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={referralLink || ""}
                  readOnly
                  placeholder="Not available"
                  className="flex-1 cursor-pointer rounded-lg border border-border/60 bg-black/[0.02] px-3 py-2 text-sm text-muted-foreground"
                  onClick={(e) => e.target.select()}
                />
                <Button variant="outline" className="shrink-0 h-auto" onClick={() => handleCopy(referralLink)} disabled={!referralLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// --- Security Section ---
const SecuritySection = () => {
  const { t } = useTranslation();
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="rounded-2xl border-border/60 bg-surface">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/10">
              <Shield className="h-5 w-5 text-brand-blue" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{t("profile.tabs.password", "Security")}</h3>
              <p className="text-xs text-muted-foreground">{t("profile.password.helper", "Manage your password")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 overflow-hidden transition-all duration-300">
              <div className="flex items-center justify-between p-4 bg-surface hover:bg-black/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Password</p>
                    <p className="text-xs text-muted-foreground">Keep your account secure</p>
                  </div>
                </div>
                {!changingPassword && (
                  <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={() => setChangingPassword(true)}>
                    Change
                  </Button>
                )}
              </div>

              {changingPassword && (
                <div className="px-4 pb-4 border-t border-border/40 pt-4 animate-in slide-in-from-top-2">
                  <PasswordForm onCancel={() => setChangingPassword(false)} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// --- Sessions Section ---
const SessionsSection = () => {
  const { t } = useTranslation();
  const sessionQuery = useQuery({ queryKey: ["sessions"], queryFn: getSessions });
  const { toast } = useToast();

  const sessionLogoutMutation = useMutation({
    mutationFn: logoutSession,
    onSuccess: (res) => toast({ description: res.message }),
  });

  if (sessionQuery.isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (sessionQuery.isError) {
    return (
      <Card className="p-6 rounded-2xl">
        <p className="font-medium">{t("profile.states.sessionsLoadErrorTitle")}</p>
      </Card>
    );
  }

  const sessionName = String(sessionQuery.data?.currentToken?.name ?? "").split("||");
  const browserInfo = sessionName[0] || t("profile.states.unknownBrowser");
  const locationInfo = sessionName[1] || t("profile.states.unknownLocation");
  const thisUser = browserInfo === navigator.userAgent;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="rounded-2xl border-border/60 bg-surface">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Computer className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{t("profile.tabs.sessions", "Active Sessions")}</h3>
              <p className="text-xs text-muted-foreground">{t("profile.sessions.helper", "Manage devices logged into your account")}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:bg-black/[0.01] transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04]">
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{browserInfo}</p>
                <p className="text-xs text-muted-foreground">
                  {locationInfo} • 
                  <span className={thisUser ? "text-brand-green ml-1" : "text-muted-foreground ml-1"}>
                    {thisUser ? t("profile.sessions.thisDevice", "This device") : t("profile.sessions.otherDevices", "Other device")}
                  </span>
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-lg h-8 text-xs text-red-500 border-red-500/30 hover:bg-red-500/5 hover:text-red-600"
              onClick={() => sessionLogoutMutation.mutate()}
            >
              {t("profile.sessions.logoutOtherSessions", "Sign Out All")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// --- Main Page ---
const Profile = () => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("profile");

  const sections = [
    { id: "profile",  icon: User,    title: t("profile.tabs.info", "Profile"), description: "Manage your personal information" },
    { id: "security", icon: Shield,  title: t("profile.tabs.password", "Security"), description: "Password and authentication" },
    { id: "sessions", icon: Monitor, title: t("profile.tabs.sessions", "Sessions"), description: "Manage active devices" },
  ];

  return (
    <div className="flex flex-col gap-8 pb-10 w-full max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and profile.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Navigation */}
        <div className="space-y-2 lg:col-span-1">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 rounded-xl p-3.5 text-left transition-all ${
                  isActive
                    ? "bg-brand-green/10 border border-brand-green/20 shadow-sm"
                    : "hover:bg-black/[0.02] border border-transparent"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    isActive ? "bg-brand-green text-white" : "bg-black/[0.04] text-muted-foreground"
                  }`}
                >
                  <section.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? "text-brand-green" : "text-foreground"}`}>
                    {section.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-green" : "text-muted-foreground/40"}`} />
              </button>
            );
          })}
        </div>

        {/* Right: Active Section Content */}
        <div className="lg:col-span-2">
          {activeSection === "profile" && <ProfileSection />}
          {activeSection === "security" && <SecuritySection />}
          {activeSection === "sessions" && <SessionsSection />}
        </div>
      </div>
    </div>
  );
};

export default Profile;
