import { Separator } from "../components/ui/separator";
import { Card } from "../components/ui/card";
import React from "react";
import {
  Tabs,
  TabsTrigger,
  TabsList,
  TabsContent,
} from "../components/ui/tabs";

const Settings = () => {
  return (
    <section className="container mx-auto page">
      <Card className="h-full">
        <div className="flex items-center gap-20 p-4 pt-8 md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center lg:gap-20 lg:pt-10">
          <h3 className="font-medium text-xl">Settings</h3>
        </div>
        <Tabs defaultValue="general" className="">
          <Separator />
          <TabsList className="md:grid md:grid-cols-2 md:gap-2 lg:flex lg:justify-between">
            <TabsTrigger className="md:w-full lg:w-auto" value="general">General</TabsTrigger>
            <TabsTrigger className="md:w-full lg:w-auto" value="meeting">Meeting</TabsTrigger>
            <TabsTrigger className="md:w-full lg:w-auto" value="recording">Recording</TabsTrigger>
            <TabsTrigger className="md:w-full lg:w-auto" value="audio">Audio Conference</TabsTrigger>
            <TabsTrigger className="md:w-full lg:w-auto" value="whiteBoard">White Board</TabsTrigger>
            <TabsTrigger className="md:w-full lg:w-auto" value="scheduling">Scheduling</TabsTrigger>
          </TabsList>
          <Separator />
          <TabsContent value="general">General</TabsContent>
          <TabsContent value="meeting">Meeting</TabsContent>
          <TabsContent value="recording">Recording</TabsContent>
          <TabsContent value="audio">Audio Conference</TabsContent>
          <TabsContent value="whiteBoard">White Board</TabsContent>
          <TabsContent value="scheduling">Scheduling</TabsContent>
        </Tabs>
      </Card>
    </section>
  );
};

export default Settings;
