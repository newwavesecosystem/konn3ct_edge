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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
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
        <TabsList className="w-full flex flex-wrap gap-2 mb-20">
          <TabsTrigger value="info" className="text-base md:text-lg">
            Profile Information
          </TabsTrigger>
          <Separator orientation="vertical" className="hidden md:block" />
          <TabsTrigger value="password" className="text-base md:text-lg">
            Update Password
          </TabsTrigger>
          {/* <Separator orientation="vertical" className="hidden md:block" />
          <TabsTrigger value="two_auth" className="text-lg">
            Two Factor Authentication
          </TabsTrigger> */}
          <Separator orientation="vertical" className="hidden md:block" />
          <TabsTrigger value="sessions" className="text-base md:text-lg">
            Browser Sessions
          </TabsTrigger>
        </TabsList>
        <div className="mb-6"></div>
        <TabsContent value="info">
          <ProfileInformation />
        </TabsContent>
        <TabsContent value="password">
          <UpdatePassword />
        </TabsContent>
        {/* <TabsContent value="two_auth">
          <TwoFactorAuth />
        </TabsContent> */}
        <TabsContent value="sessions">
          <BrowserSessions />
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default Profile;

const ProfileInformation = () => {
  const userQuery = useQuery({ queryKey: ["profile"], queryFn: getUser });
  const { toast } = useToast();

  const handleCopy = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ description: "Copied to clipboard" });
    }
  };

  if (userQuery.isSuccess) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column (photo + form) */}
        <Card className="p-4">
          <CardTitle className="text-lg md:text-xl">Photo</CardTitle>
          <Avatar className="rounded-lg my-5 w-[80px] h-[80px] md:w-[90px] md:h-[90px]">
            <AvatarImage src={userQuery.data.user.profile_photo_url} />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <ProfileForm />
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-6 col-span-2">
          <Card className="flex flex-col md:flex-row items-start md:items-center p-4">
            <div>
              <CardHeader className="p-0">
                <CardTitle className="text-base md:text-lg">Active plan</CardTitle>
                <p className="text-sm md:text-base">
                  {capitalize(userQuery.data.user_plan.name)}
                </p>
              </CardHeader>
            </div>
            <Button className="mt-3 md:mt-0 md:ml-auto">
              {capitalize(userQuery.data.user_plan.status)}
            </Button>
          </Card>

          <Card className="flex flex-col md:flex-row items-start md:items-center p-4">
            <div>
              <CardHeader className="p-0">
                <CardTitle className="text-base md:text-lg">Referral Code</CardTitle>
                <p className="text-sm md:text-base">
                  {userQuery.data.user.referral_code}
                </p>
              </CardHeader>
            </div>
            <Button
              variant="outline"
              className="mt-3 md:mt-0 md:ml-auto"
              onClick={() => handleCopy(userQuery.data.user.referral_code)}
            >
              Copy <Copy className="ml-2 h-4 w-4" />
            </Button>
          </Card>
        </div>
      </div>
    );
  }
};

const UpdatePassword = () => {
  return (
    <Card className="min-h-full flex justify-center p-6">
      <div className="w-full max-w-md flex flex-col">
        <p className="mb-6 text-sm md:text-base">
          Ensure your account is using a long random password to stay secure.
        </p>
        <PasswordForm />
      </div>
    </Card>
  );
};

const TwoFactorAuth = () => {
  return (
    <Card className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-lg md:text-xl font-semibold">
          You have not enabled two factor authentication.
        </div>
        <p className="my-4 md:my-6 text-sm md:text-base">
          When two factor authentication is enabled, you will be prompted for a
          secure, random token during authentication. You may retrieve this
          token from your phone's Google Authenticator application.
        </p>
        <Button size="lg" className="w-full md:w-auto">Enable</Button>
      </div>
    </Card>
  );
};

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
        <Skeleton className="w-full min-h-full relative" />
      </Card>
    );

  const sessionName = sessionQuery.data.currentToken.name.split("||");
  const currentUserAgent = navigator.userAgent;
  const thisUser = sessionName[0] === currentUserAgent;

  return (
    <Card className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <p className="text-sm md:text-base">
          If necessary, you may logout of all of your other browser sessions
          across all of your devices. If you feel your account has been
          compromised, you should also update your password.
        </p>

        <div className="flex flex-col md:flex-row my-6 md:my-10 gap-4 md:gap-x-5 items-start md:items-center font-medium">
          <Computer className="w-8 h-8 md:w-10 md:h-10" />
          <div>
            <p className="text-sm md:text-base">{sessionName[0]}</p>
            <p className="text-sm md:text-base">
              {sessionName[1]}{"."}
              <span className="ml-1 text-accent">
                {thisUser ? "This device" : "Other devices"}
              </span>
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full md:w-auto"
          onClick={() => sessionLogoutMutation.mutate()}
        >
          Logout Other Browser Sessions
        </Button>
      </div>
    </Card>
  );
};
