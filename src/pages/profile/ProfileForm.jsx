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

const PROFILE_FORM_TEXT = {
  validation: {
    firstNameMin2: "First name must be at least 2 characters",
    lastNameMin2: "Last name must be at least 2 characters",
    phoneMin10: "Phone number must be at least 10 digits.",
  },
  loadProfileDetailsError: "Unable to load profile details right now.",
  firstName: "First Name",
  lastName: "Last Name",
  phone: "Phone",
  updating: "Updating...",
  updateProfile: "Update Profile",
};

export function ProfileForm() {
  const formSchema = z.object({
    firstname: z
      .string()
      .min(2, PROFILE_FORM_TEXT.validation.firstNameMin2)
      .or(z.literal("")),
    lastname: z
      .string()
      .min(2, PROFILE_FORM_TEXT.validation.lastNameMin2)
      .or(z.literal("")),
    phone: z
      .string()
      .min(10, PROFILE_FORM_TEXT.validation.phoneMin10)
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
        {PROFILE_FORM_TEXT.loadProfileDetailsError}
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
              <FormLabel>{PROFILE_FORM_TEXT.firstName}</FormLabel>
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
              <FormLabel>{PROFILE_FORM_TEXT.lastName}</FormLabel>
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
              <FormLabel>{PROFILE_FORM_TEXT.phone}</FormLabel>
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
          {profileMutation.isPending
            ? PROFILE_FORM_TEXT.updating
            : PROFILE_FORM_TEXT.updateProfile}
        </Button>
      </form>
    </Form>
  );
}
