import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser, updateProfile } from "../../api/userApi";
import { useToast } from "../../hooks/use-toast";

export function ProfileForm() {
  const formSchema = z.object({
    firstname: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .or(z.literal("")),
    lastname: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .or(z.literal("")),
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 digits.")
      .or(z.literal("")),
    profileImage: z.any().optional(),
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);

  const userQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
  });
  const profileUser = userQuery.data?.user ?? {};

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstname: "",
      lastname: "",
      phone: "",
      profileImage: null,
    },
  });

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (res) => {
      if (res?.success === false) {
        toast({
          description: res.message || "Unable to update profile.",
          variant: "destructive",
        });
        return;
      }

      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      form.reset({
        firstname: "",
        lastname: "",
        phone: "",
        profileImage: null,
      });
      toast({
        description: res?.message || "Profile updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        description:
          error.response?.data?.message ||
          error.message ||
          "Unable to update profile.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data) => {
    const formData = new FormData();
    const firstname = data.firstname.trim();
    const lastname = data.lastname.trim();
    const phone = data.phone.trim();

    if (firstname && firstname !== (profileUser.firstname ?? "")) {
      formData.append("firstname", firstname);
    }

    if (lastname && lastname !== (profileUser.lastname ?? "")) {
      formData.append("lastname", lastname);
    }

    if (phone && phone !== (profileUser.phone ?? "")) {
      formData.append("phone", phone);
    }

    if (data.profileImage) {
      formData.append("image", data.profileImage);
    }

    profileMutation.mutate(formData);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    form.setValue("profileImage", file);
  };

  if (userQuery.isLoading) return null;
  if (userQuery.isError) {
    return (
      <div className="text-sm text-muted-foreground">
        Unable to load profile details right now.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        encType="multipart/form-data"
      >
        <div className="flex flex-col items-center gap-3">
          <img
            src={preview || profileUser.profile_photo_url || "/avatar.png"}
            alt="Profile"
            className="h-24 w-24 rounded-full object-cover"
          />

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="text-xs file:cursor-pointer file:rounded-full file:border file:px-4 file:py-1"
          />
        </div>

        <FormField
          control={form.control}
          name="firstname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder={profileUser.firstname ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lastname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder={profileUser.lastname ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input {...field} placeholder={profileUser.phone ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={profileMutation.isPending}
        >
          {profileMutation.isPending ? "Updating..." : "Update Profile"}
        </Button>
      </form>
    </Form>
  );
}
