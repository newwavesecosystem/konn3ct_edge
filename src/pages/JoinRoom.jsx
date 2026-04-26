import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

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
import {
  buildJoinMeetingUrl,
  privacyPolicyUrl,
} from "../lib/externalLinks";

const JoinRoom = () => {
  return (
    <div className="page container mx-auto flex flex-col justify-center px-4 sm:flex-row md:flex-col lg:flex-row lg:px-0">
      <SideDetail className="md:hidden lg:flex" />
      <Card className="w-full max-w-md flex-1 sm:max-w-[560px] md:max-w-md lg:max-w-[560px]">
        <JoinForm />
        <p className="px-2 text-center text-xs text-[#0A2540] dark:text-white sm:text-sm">
          By signing in you understand and agree to the Newwaves ecosystem
          Terms of Use. For more information about Privacy Data visit the{" "}
          <a
            href={privacyPolicyUrl}
            className="text-blue-500 underline dark:text-blue-400"
            rel="noreferrer"
            target="_blank"
          >
            Newwaves Privacy Data Sheets.
          </a>
        </p>
      </Card>
    </div>
  );
};

export default JoinRoom;

const JoinForm = () => {
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
            description: "Meeting link is not configured.",
            variant: "destructive",
          });
        }
      }
      toast({ description: res.message });
    },
    onError: () => {
      toast({ description: "An error occurred." });
    },
  });

  const formSchema = z.object({
    email: z.string().email({ message: "Invalid email address." }),
    roomName: z
      .string()
      .min(2, { message: "Room name must be at least 2 characters long." })
      .refine((value) => value.trim().length > 0, {
        message: "Room name cannot be empty or whitespace.",
      }),
    name: z
      .string()
      .min(2, { message: "Username must be at least 2 characters long." })
      .refine((value) => value.trim().length > 0, {
        message: "Username cannot be empty or whitespace.",
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
    <div className="px-4 sm:px-20 md:px-8 lg:px-20">
      <div className="mb-6 flex justify-center">
        <img src={logo} alt="konn3ct" className="h-10 sm:h-auto" />
      </div>
      <h3 className="mb-6 text-center text-lg font-bold sm:text-xl">
        Join a Meeting
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
                    placeholder="Enter meeting room name or ID"
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
                    placeholder="Enter your name"
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
                    placeholder="Enter your email address"
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
            className="w-full bg-[#012E89] shadow-md"
            disabled={joinMutation.isPending}
          >
            Konn3ct
          </Button>
        </form>
      </Form>
    </div>
  );
};
