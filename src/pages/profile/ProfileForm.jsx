import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import { Camera, User, Phone } from "lucide-react";

export function ProfileForm() {
  const { t } = useTranslation();
  const formSchema = z.object({
    firstname: z
      .string()
      .min(2, t("profile.form.validation.firstNameMin"))
      .or(z.literal("")),
    lastname: z
      .string()
      .min(2, t("profile.form.validation.lastNameMin"))
      .or(z.literal("")),
    phone: z
      .string()
      .min(10, t("profile.form.validation.phoneMin"))
      .or(z.literal("")),
    profileImage: z.any().optional(),
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

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
          description: res.message || t("profile.form.errors.updateFailed"),
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
        description: res?.message || t("profile.form.errors.updateSuccess"),
      });
    },
    onError: (error) => {
      toast({
        description:
          error.response?.data?.message ||
          error.message ||
          t("profile.form.errors.updateFailed"),
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

  if (userQuery.isLoading) return <div className="p-6">Loading profile...</div>;
  if (userQuery.isError) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("profile.form.errors.load")}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        encType="multipart/form-data"
      >
        {/* Modern Header Gradient & Avatar */}
        <div className="h-24 bg-gradient-to-r from-brand-blue to-brand-green relative w-full">
          <div className="absolute -bottom-10 left-6">
            <div className="relative">
              <img
                src={preview || profileUser.profile_photo_url || "/avatar.png"}
                alt={t("profile.form.imageAlt")}
                className="h-20 w-20 rounded-2xl object-cover bg-white shadow-xl ring-4 ring-surface"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface border border-border/60 shadow-sm hover:bg-black/[0.04] transition-colors"
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <div className="pt-14 p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("profile.form.firstName")}
                  </FormLabel>
                  <FormControl>
                    <Input className="h-11 bg-black/[0.02]" {...field} placeholder={profileUser.firstname ?? ""} />
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
                  <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("profile.form.lastName")}
                  </FormLabel>
                  <FormControl>
                    <Input className="h-11 bg-black/[0.02]" {...field} placeholder={profileUser.lastname ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("profile.form.phone")}
                  </FormLabel>
                  <FormControl>
                    <Input className="h-11 bg-black/[0.02]" {...field} placeholder={profileUser.phone ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button
              type="submit"
              className="h-10 rounded-xl px-6 bg-brand-green hover:bg-[#287854] text-white"
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending
                ? t("profile.form.updating")
                : t("profile.form.submit")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
