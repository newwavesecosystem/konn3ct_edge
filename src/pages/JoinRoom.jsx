import React from "react";
import SideDetail from "./auth/SideDetail";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import logo from "src/assets/konn3ct_logo.png";
import { Button } from "../components/ui/button";

const JoinRoom = () => {
  return (
    <div className="container page mx-auto flex justify-center">
      <SideDetail />
      <Card className="max-w-[560px] flex-1 ">
        <JoinForm />
        <p className="text-[#0A2540] text-center text-sm">
          By signing in you understand and agree to the Newwaves ecosystem Terms
          of Use. For more information about Privacy Data visit the Newwaves
          Privacy Data Sheets.
        </p>
      </Card>
    </div>
  );
};

export default JoinRoom;

const JoinForm = () => {
  const formSchema = {};

  const form = useForm({
    // resolver: zodResolver(formSchema),
    defaultValues: {
      roomName: "",
      name: "",
      email: "",
    },
  });

  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <div className="px-20">
      <div className="flex justify-center mb-16">
        <img src={logo} alt="konn3ct" />
      </div>
      <h3 className="text-xl font-medium mb-10 text-center">Join a Meeting</h3>
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
                    placeholder="Enter meeting room name or link"
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
                    type="text"
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
            className="w-full bg-[#012E89] shadow-md !my-10"
            // disabled={loginMutation.isPending}
          >
            Konne3ct
          </Button>
        </form>
      </Form>
    </div>
  );
};
