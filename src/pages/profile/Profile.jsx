import React from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import avatar from "../../assets/avatar.png";
import { Button } from "../../components/ui/button";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { Separator } from "../../components/ui/separator";
import { Computer, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../../api/userApi";
import { capitalize } from "../../lib/utils";

const Profile = () => {
  return (
    <section className="page">
      <Tabs defaultValue="info" className="w-full h-full">
        <TabsList className="w-full">
          <TabsTrigger value="info" className="text-lg">
            Profile Information
          </TabsTrigger>
          <Separator orientation="vertical" />
          <TabsTrigger value="password" className="text-lg">
            Update Password
          </TabsTrigger>
          <Separator orientation="vertical" />
          <TabsTrigger value="two_auth" className="text-lg">
            Two Factor Authentication
          </TabsTrigger>
          <Separator orientation="vertical" />
          <TabsTrigger value="sessions" className="text-lg">
            Browser Sessions
          </TabsTrigger>
        </TabsList>
        <div className="mb-10"></div>
        <TabsContent value="info">
          <ProfileInformation />
        </TabsContent>
        <TabsContent value="password">
          <UpdatePassword />
        </TabsContent>
        <TabsContent value="two_auth">
          <TwoFactorAuth />
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
  const userQuery = useQuery({ queryKey: ["profile"], queryFn: getUser });

  if (userQuery.isSuccess)
    return (
      <div className="grid grid-cols-3 gap-6">
        <Card>
          <div>
            <CardTitle className="text-xl">Photo</CardTitle>
            <Avatar className="rounded-lg my-5 w-[90px] h-[90px]">
              <AvatarImage src={userQuery.data.user.profile_photo_url} />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
          <Button variant="outline" className="mb-5">
            Select a new photo
          </Button>
          <ProfileForm />
        </Card>
        <div className="flex flex-col gap-10 col-span-2">
          <Card className="flex items-center">
            <div>
              <CardHeader>
                <CardTitle>Active plan</CardTitle>
                <p>{capitalize(userQuery.data.user_plan.name)}</p>
              </CardHeader>
            </div>
            <Button className="ml-auto">
              {capitalize(userQuery.data.user_plan.status)}
            </Button>
          </Card>
          <Card className="flex items-center">
            <div>
              <CardHeader>
                <CardTitle>Referral Code</CardTitle>
                <p>{userQuery.data.user.referral_code}</p>
              </CardHeader>
            </div>
            <Button variant="outline" className="ml-auto">
              Copy <Copy />
            </Button>
          </Card>
        </div>
      </div>
    );
};

const UpdatePassword = () => {
  return (
    <Card className="min-h-full flex justify-center">
      <div className="flex justify-center w-[400px] flex-col">
        <p className="mb-8">
          Ensure your account is using a long random password to stay secure.
        </p>
        <PasswordForm />
      </div>
    </Card>
  );
};

const TwoFactorAuth = () => {
  return (
    <Card className="min-h-full flex items-center justify-center">
      <div className="w-[500px]">
        <div className="text-xl font-semibold">
          You have not enabled two factor authentication.
        </div>
        <p className="my-6">
          When two factor authentication is enabled, you will be prompted for a
          secure, random token during authentication. You may retrieve this
          token from your phone's Google Authenticator application.
        </p>
        <Button size="lg">Enable</Button>
      </div>
    </Card>
  );
};

const BrowserSessions = () => {
  return (
    <Card className="min-h-full flex items-center justify-center">
      <div className="w-[600px]">
        <p>
          If necessary, you may logout of all of your other browser sessions
          across all of your devices. If you feel your account has been
          compromised, you should also update your password.
        </p>
        <div className="flex my-10 gap-x-5 items-center font-medium">
          <Computer className="w-10 h-10" />
          <div>
            <p>Windows-Chrome</p>
            <p>
              155.94.217.92, <span className="text-accent">This device</span>
            </p>
          </div>
        </div>
        <Button size="lg">Logout Other Browser Sessions</Button>
      </div>
    </Card>
  );
};
