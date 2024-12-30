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
    <section className="container page">
      <Card className="h-full">
        <div className="p-4 pt-10 flex items-center gap-20">
          <h3 className="font-medium text-xl">Settings</h3>
        </div>
        <Tabs defaultValue="general" className="">
          <Separator />
          <TabsList className="flex justify-between">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="meeting">Meeting</TabsTrigger>
            <TabsTrigger value="recording">Recording</TabsTrigger>
            <TabsTrigger value="audio">Audio Conference</TabsTrigger>
            <TabsTrigger value="whiteBoard">White Board</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
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
