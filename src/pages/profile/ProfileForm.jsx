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
import { useTranslation } from "react-i18next";

export function ProfileForm() {
  const { t } = useTranslation();
  const formSchema = z.object({
    firstName: z
      .string()
      .min(2, t("auth.validation.firstNameMin2"))
      .or(z.literal("")),
    lastName: z
      .string()
      .min(2, t("auth.validation.lastNameMin2"))
      .or(z.literal("")),
    phone: z
      .string()
      .min(10, t("auth.validation.phoneMin10"))
      .or(z.literal("")),
    profileImage: z.any().optional(),
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);

  /* ---------------- FETCH USER ---------------- */
  const userQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
  });

  /* ---------------- FORM ---------------- */
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      profileImage: null,
    },
  });

  /* ---------------- MUTATION ---------------- */
  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (res) => {
      queryClient.invalidateQueries(["profile"]);
      toast({ description: res.message || t("profile.updateProfile") });
    },
  });

  /* ---------------- SUBMIT ---------------- */
  const onSubmit = (data) => {
    const formData = new FormData();

    if (data.firstName.trim())
      formData.append("firstName", data.firstName);

    if (data.lastName.trim())
      formData.append("lastName", data.lastName);

    if (data.phone.trim())
      formData.append("phone", data.phone);

    if (data.profileImage)
      formData.append("image", data.profileImage);

    profileMutation.mutate(formData);
  };

  /* ---------------- IMAGE CHANGE ---------------- */
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
        {t("profile.loadProfileDetailsError")}
      </div>
    );
  }

  const profileUser = userQuery.data?.user ?? {};

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        encType="multipart/form-data"
      >
        {/* ---------------- IMAGE ---------------- */}
        <div className="flex flex-col items-center gap-3">
          <img
            src={
              preview ||
              profileUser.profile_photo_url ||
              "/avatar.png"
            }
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover"
          />

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="text-xs file:px-4 file:py-1 file:rounded-full file:border file:cursor-pointer"
          />
        </div>

        {/* ---------------- FIRST NAME ---------------- */}
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.register.firstName")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={profileUser.firstname ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ---------------- LAST NAME ---------------- */}
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.register.lastName")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={profileUser.lastname ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ---------------- PHONE ---------------- */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.register.phone")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={profileUser.phone ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ---------------- BUTTON ---------------- */}
        <Button
          type="submit"
          className="w-full"
          disabled={profileMutation.isPending}
        >
          {profileMutation.isPending
            ? t("profile.updating")
            : t("profile.updateProfile")}
        </Button>
      </form>
    </Form>
  );
}
