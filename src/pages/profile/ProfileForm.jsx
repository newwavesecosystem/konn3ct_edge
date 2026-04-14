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
    firstname: z
      .string()
      .min(2, t("auth.validation.firstNameMin2"))
      .or(z.literal("")),
    lastname: z
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
  const profileUser = userQuery.data?.user ?? {};

  /* ---------------- FORM ---------------- */
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstname: "",
      lastname: "",
      phone: "",
      profileImage: null,
    },
  });

  /* ---------------- MUTATION ---------------- */
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

  /* ---------------- SUBMIT ---------------- */
  const onSubmit = (data) => {
    const formData = new FormData();
    const firstname = data.firstname.trim();
    const lastname = data.lastname.trim();
    const phone = data.phone.trim();

    if (firstname && firstname !== (profileUser.firstname ?? ""))
      formData.append("firstname", firstname);

    if (lastname && lastname !== (profileUser.lastname ?? ""))
      formData.append("lastname", lastname);

    if (phone && phone !== (profileUser.phone ?? ""))
      formData.append("phone", phone);

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
          name="firstname"
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
          name="lastname"
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
