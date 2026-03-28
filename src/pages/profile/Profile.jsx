import React from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
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

const Profile = () => {
  return (
    <section className="page">
      <Tabs defaultValue="info" className="w-full h-full">
        <TabsList className="mb-20 w-full flex flex-wrap gap-2 md:grid md:grid-cols-2 lg:flex lg:flex-wrap">
          <TabsTrigger value="info" className="text-base lg:text-lg">
            Profile Information
          </TabsTrigger>
          <Separator orientation="vertical" className="hidden lg:block" />
          <TabsTrigger value="password" className="text-base lg:text-lg">
            Update Password
          </TabsTrigger>
          <Separator orientation="vertical" className="hidden lg:block" />
          <TabsTrigger value="sessions" className="text-base lg:text-lg">
            Browser Sessions
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

/* ================= PROFILE INFORMATION ================= */

const ProfileInformation = () => {
  const userQuery = useQuery({ queryKey: ["profile"], queryFn: getUser });
  const { toast } = useToast();

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ description: "Copied to clipboard" });
  };

  if (userQuery.isLoading) return null;
  if (userQuery.isError) {
    return (
      <Card className="p-4">
        <p className="font-medium">Unable to load profile information.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Please refresh and try again.
        </p>
      </Card>
    );
  }

  const user = userQuery.data?.user ?? {};
  const userPlan = userQuery.data?.user_plan ?? {};
  const referralCode = user?.referral_code ?? "";
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* LEFT COLUMN */}
      <Card className="p-4">
        <CardTitle className="mb-4 text-lg lg:text-xl">Photo</CardTitle>
        <ProfileForm />
      </Card>

      {/* RIGHT COLUMN */}
      <div className="flex flex-col gap-6 col-span-2">
        {/* ACTIVE PLAN */}
        <Card className="flex flex-col items-start p-4 lg:flex-row lg:items-center">
          <CardHeader className="p-0">
            <CardTitle className="text-base lg:text-lg">
              Active plan
            </CardTitle>
            <p className="text-sm lg:text-base">
              {capitalize(userPlan?.name ?? "basic")}
            </p>
          </CardHeader>

          <Button className="mt-3 lg:mt-0 lg:ml-auto">
            {capitalize(userPlan?.status ?? "active")}
          </Button>
        </Card>

        {/* REFERRAL CODE CARD */}
        <Card className="flex flex-col items-start p-4 lg:flex-row lg:items-center">
          <CardHeader className="p-0">
            <CardTitle className="text-base lg:text-lg">
              Referral Code
            </CardTitle>
            <p className="font-mono text-sm lg:text-base">
              {referralCode || "N/A"}
            </p>
          </CardHeader>

          <Button
            variant="outline"
            className="mt-3 lg:mt-0 lg:ml-auto"
            onClick={() => handleCopy(referralCode)}
          >
            Copy <Copy className="ml-2 h-4 w-4" />
          </Button>
        </Card>

        {/* REFERRAL LINK CARD (SEPARATE) */}
        <Card className="p-4">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="text-base lg:text-lg">
              Referral Link
            </CardTitle>
          </CardHeader>

          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted cursor-pointer"
              onClick={(e) => e.target.select()}
            />

            <Button
              variant="outline"
              onClick={() => handleCopy(referralLink)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

/* ================= UPDATE PASSWORD ================= */

const UpdatePassword = () => {
  return (
    <Card className="min-h-full flex justify-center p-6">
      <div className="w-full max-w-md flex flex-col">
        <p className="mb-6 text-sm lg:text-base">
          Ensure your account is using a long random password to stay secure.
        </p>
        <PasswordForm />
      </div>
    </Card>
  );
};

/* ================= BROWSER SESSIONS ================= */

const BrowserSessions = () => {
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
        <Skeleton className="w-full min-h-full" />
      </Card>
    );

  if (sessionQuery.isError) {
    return (
      <Card className="min-h-full p-6">
        <p className="font-medium">Unable to load browser sessions.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Please refresh and try again.
        </p>
      </Card>
    );
  }

  const sessionName = String(sessionQuery.data?.currentToken?.name ?? "").split(
    "||"
  );
  const browserInfo = sessionName[0] || "Unknown browser";
  const locationInfo = sessionName[1] || "Unknown location";
  const currentUserAgent = navigator.userAgent;
  const thisUser = browserInfo === currentUserAgent;

  return (
    <Card className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <p className="text-sm lg:text-base">
          If necessary, you may logout of all of your other browser sessions
          across all of your devices.
        </p>

        <div className="my-6 flex flex-col items-start gap-4 font-medium lg:flex-row lg:items-center">
          <Computer className="h-8 w-8 lg:h-10 lg:w-10" />
          <div>
            <p className="text-sm lg:text-base">{browserInfo}</p>
            <p className="text-sm lg:text-base">
              {locationInfo}.
              <span className="ml-1 text-accent">
                {thisUser ? "This device" : "Other devices"}
              </span>
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full lg:w-auto"
          onClick={() => sessionLogoutMutation.mutate()}
        >
          Logout Other Browser Sessions
        </Button>
      </div>
    </Card>
  );
};
