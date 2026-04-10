import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import SideDetail from "./auth/SideDetail";
import { joinRoom } from "../api/roomsApi";
import logo from "src/assets/konn3ct_logo.png";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { buildJoinMeetingUrl } from "../lib/externalLinks";

const JoinRoom = () => {
  const { t } = useTranslation();

  return (
    <div className="container page mx-auto flex justify-center">
      <SideDetail className="md:hidden lg:flex" />
      <Card className="max-w-[560px] flex-1">
        <JoinForm />
        <p className="text-center text-sm text-[#0A2540]">
          {t("joinRoom.termsNotice")}
        </p>
      </Card>
    </div>
  );
};

export default JoinRoom;

const JoinForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const joinMutation = useMutation({
    mutationFn: joinRoom,
    onSuccess: (res) => {
      if (res.success) {
        const meetingUrl = buildJoinMeetingUrl(res.sessionToken || res.data);

        if (meetingUrl) {
          window.open(meetingUrl, "_blank");
          navigate("/");
        } else {
          toast({
            description: t("joinRoom.meetingLinkUnavailable"),
            variant: "destructive",
          });
        }
      }
      toast({ description: res.message });
    },
    onError: () => {
      toast({ description: t("joinRoom.unexpectedError") });
    },
  });

  const formSchema = z.object({
    email: z.string().email({ message: t("auth.validation.invalidEmail") }),
    roomName: z
      .string()
      .min(2, { message: t("joinRoom.validation.roomNameMin") })
      .refine((value) => value.trim().length > 0, {
        message: t("joinRoom.validation.roomNameRequired"),
      }),
    name: z
      .string()
      .min(2, { message: t("joinRoom.validation.nameMin") })
      .refine((value) => value.trim().length > 0, {
        message: t("joinRoom.validation.nameRequired"),
      }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomName: "",
      name: "",
      email: "",
    },
  });

  const onSubmit = (data) => {
    joinMutation.mutate(data);
  };

  return (
    <div className="px-20 md:px-10 lg:px-20">
      <div className="mb-16 flex justify-center">
        <img src={logo} alt="konn3ct" />
      </div>
      <h3 className="mb-10 text-center text-xl font-medium">
        {t("joinRoom.title")}
      </h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="roomName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="text"
                    placeholder={t("joinRoom.roomNamePlaceholder")}
                    className="rounded-full px-4"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="text"
                    placeholder={t("joinRoom.namePlaceholder")}
                    className="rounded-full px-4"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t("joinRoom.emailPlaceholder")}
                    className="rounded-full px-4"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="!my-10 w-full bg-[#012E89] shadow-md"
            disabled={joinMutation.isPending}
          >
            {t("joinRoom.submitButton")}
          </Button>
        </form>
      </Form>
    </div>
  );
};
