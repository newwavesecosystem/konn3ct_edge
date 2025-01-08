import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import React, { useState } from "react";
import StatCard from "../components/StatCard";
import { Card } from "../components/ui/card";
import activeIcon from "../assets/icons/active.svg";
import inactiveIcon from "../assets/icons/inactive.svg";
import roomsIcon from "../assets/icons/roomsIcon.svg";
import { Separator } from "../components/ui/separator";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMeeting, getRooms } from "../api/roomsApi";
import { Dialog, DialogContent, DialogTrigger } from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { useForm } from "react-hook-form";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const Rooms = () => {
  const roomQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const [openDialog, setOpenDialog] = useState(false);

  if (roomQuery.isLoading)
    return <div className="container page">Loading...</div>;

  return (
    <section className="page container">
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Card className="w-full min-h-full">
          <div className="p-4 pt-10 flex items-center justify-between gap-x-4">
            <DialogTrigger asChild>
              <Button>
                <Plus /> Create Room
              </Button>
            </DialogTrigger>
            <StatCard
              value={roomQuery.data.total_rooms}
              name="Total room"
              icon={roomsIcon}
            />
            <Separator orientation="vertical" className="h-[50px]" />
            <StatCard
              value={roomQuery.data.active_rooms}
              name="Active room"
              icon={activeIcon}
            />
            <Separator orientation="vertical" className="h-[50px]" />
            <StatCard
              value={roomQuery.data.total_rooms - roomQuery.data.active_rooms}
              name="Inactive room"
              icon={inactiveIcon}
            />
          </div>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="">NAME</TableHead>
                <TableHead>ROOM URL</TableHead>
                <TableHead>
                  <div className="flex justify-between">
                    <p>ACTIONS</p>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomQuery.data.rooms.map(({ name, url, id }) => (
                <TableRow key={id}>
                  <TableCell className="">{name}</TableCell>
                  <TableCell className="">{url}</TableCell>
                  <TableCell>
                    <div className="flex gap-x-2">
                      <Button variant="outline">Copy Link</Button>
                      <Button variant="destructive">Delete</Button>
                      <Button variant="outline">Manage</Button>
                      <Button>Start Meeting</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {roomQuery.data.rooms.length === 0 && (
            <p>No data available for this table</p>
          )}
        </Card>

        <DialogContent className="w-1/2">
          <DialogTitle>Create a new Meeting</DialogTitle>
          <DialogDescription>
            You will create a new meeting, accessible on the dashboard.
          </DialogDescription>
          <CreateMeetingDialog setOpenDialog={setOpenDialog} />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Rooms;

const CreateMeetingDialog = ({ setOpenDialog }) => {
  const queryClient = useQueryClient();

  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries(["rooms"]);
    },
  });

  const formSchema = z.object({
    name: z.string().min(5, {
      message: "Meeting name must be at least 5 characters.",
    }),
    url: z.string().min(5, {
      message: "Meeting url must be at least 5 characters.",
    }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
    },
  });

  const onSubmit = (data) => {
    createMeetingMutation.mutate(data);
    setOpenDialog(false);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-y-5 "
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meeting Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meeting url</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="self-center">
          Create Meeting
        </Button>
      </form>
    </Form>
  );
};
