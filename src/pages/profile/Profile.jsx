import React from "react";
import { useTranslation } from "react-i18next";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import { Card, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { Separator } from "../../components/ui/separator";
import { Computer, Copy } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSessions, getUser, logoutSession } from "../../api/userApi";
import { capitalize } from "../../lib/utils";
import { useToast } from "../../hooks/use-toast";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getReferralCodeFromRecord,
  getReferralLinkFromRecord,
} from "../../lib/referral";

const Profile = () => {
  const { t } = useTranslation();

  return (
    <section className="page">
      <Tabs defaultValue="info" className="w-full h-full">
        <TabsList className="mb-20 w-full flex flex-wrap gap-2 md:grid md:grid-cols-2 lg:flex lg:flex-wrap">
          <TabsTrigger value="info" className="text-base lg:text-lg">
            {t("profile.tabs.info")}
          </TabsTrigger>
          <Separator orientation="vertical" className="hidden lg:block" />
          <TabsTrigger value="password" className="text-base lg:text-lg">
            {t("profile.tabs.password")}
          </TabsTrigger>
          <Separator orientation="vertical" className="hidden lg:block" />
          <TabsTrigger value="sessions" className="text-base lg:text-lg">
            {t("profile.tabs.sessions")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <ProfileInformation />
        </TabsContent>

        <TabsContent value="password">
          <UpdatePassword />
        </TabsContent>

        <TabsContent value="sessions">
          <BrowserSessions />
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default Profile;

const ProfileInformation = () => {
  const { t } = useTranslation();
  const userQuery = useQuery({ queryKey: ["profile"], queryFn: getUser });
  const { toast } = useToast();

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ description: t("profile.toasts.copied") });
  };

  if (userQuery.isLoading) return null;
  if (userQuery.isError) {
    return (
      <Card className="p-4">
        <p className="font-medium">{t("profile.states.profileLoadErrorTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("profile.states.profileLoadErrorDescription")}
        </p>
      </Card>
    );
  }

  const user = userQuery.data?.user ?? {};
  const userPlan = userQuery.data?.user_plan ?? {};
  const referralCode = getReferralCodeFromRecord(user);
  const referralLink = getReferralLinkFromRecord(user);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card className="p-4">
        <CardTitle className="mb-4 text-lg lg:text-xl">
          {t("profile.info.photo")}
        </CardTitle>
        <ProfileForm />
      </Card>

      <div className="col-span-2 flex flex-col gap-6">
        <Card className="flex flex-col items-start p-4 lg:flex-row lg:items-center">
          <CardHeader className="p-0">
            <CardTitle className="text-base lg:text-lg">
              {t("profile.info.activePlan")}
            </CardTitle>
            <p className="text-sm lg:text-base">
              {capitalize(userPlan?.name ?? "basic")}
            </p>
          </CardHeader>

          <Button className="mt-3 lg:ml-auto lg:mt-0">
            {capitalize(userPlan?.status ?? "active")}
          </Button>
        </Card>

        <Card className="flex flex-col items-start p-4 lg:flex-row lg:items-center">
          <CardHeader className="p-0">
            <CardTitle className="text-base lg:text-lg">
              {t("profile.info.referralCode")}
            </CardTitle>
            <p className="font-mono text-sm lg:text-base">
              {referralCode || t("profile.states.notAvailable")}
            </p>
          </CardHeader>

          <Button
            variant="outline"
            className="mt-3 lg:ml-auto lg:mt-0"
            onClick={() => handleCopy(referralCode)}
            disabled={!referralCode}
          >
            {t("profile.info.copy")} <Copy className="ml-2 h-4 w-4" />
          </Button>
        </Card>

        <Card className="p-4">
          <CardHeader className="mb-2 p-0">
            <CardTitle className="text-base lg:text-lg">
              {t("profile.info.referralLink")}
            </CardTitle>
          </CardHeader>

          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              placeholder={t("profile.states.notAvailable")}
              className="flex-1 cursor-pointer rounded-md border bg-muted px-3 py-2 text-sm"
              onClick={(e) => e.target.select()}
            />

            <Button
              variant="outline"
              onClick={() => handleCopy(referralLink)}
              disabled={!referralLink}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

const UpdatePassword = () => {
  const { t } = useTranslation();

  return (
    <Card className="min-h-full flex justify-center p-6">
      <div className="flex w-full max-w-md flex-col">
        <p className="mb-6 text-sm lg:text-base">
          {t("profile.password.helper")}
        </p>
        <PasswordForm />
      </div>
    </Card>
  );
};

const BrowserSessions = () => {
  const { t } = useTranslation();
  const sessionQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessions,
  });

  const { toast } = useToast();

  const sessionLogoutMutation = useMutation({
    mutationFn: logoutSession,
    onSuccess: (res) => {
      toast({ description: res.message });
    },
  });

  if (sessionQuery.isLoading)
    return (
      <Card className="min-h-full">
        <Skeleton className="min-h-full w-full" />
      </Card>
    );

  if (sessionQuery.isError) {
    return (
      <Card className="min-h-full p-6">
        <p className="font-medium">{t("profile.states.sessionsLoadErrorTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("profile.states.sessionsLoadErrorDescription")}
        </p>
      </Card>
    );
  }

  const sessionName = String(sessionQuery.data?.currentToken?.name ?? "").split(
    "||"
  );
  const browserInfo = sessionName[0] || t("profile.states.unknownBrowser");
  const locationInfo = sessionName[1] || t("profile.states.unknownLocation");
  const currentUserAgent = navigator.userAgent;
  const thisUser = browserInfo === currentUserAgent;

  return (
    <Card className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <p className="text-sm lg:text-base">
          {t("profile.sessions.helper")}
        </p>

        <div className="my-6 flex flex-col items-start gap-4 font-medium lg:flex-row lg:items-center">
          <Computer className="h-8 w-8 lg:h-10 lg:w-10" />
          <div>
            <p className="text-sm lg:text-base">{browserInfo}</p>
            <p className="text-sm lg:text-base">
              {locationInfo}.
              <span className="ml-1 text-accent">
                {thisUser
                  ? t("profile.sessions.thisDevice")
                  : t("profile.sessions.otherDevices")}
              </span>
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full lg:w-auto"
          onClick={() => sessionLogoutMutation.mutate()}
        >
          {t("profile.sessions.logoutOtherSessions")}
        </Button>
      </div>
    </Card>
  );
};
