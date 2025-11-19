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

const formSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters.",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Invalid email address.",
  }),
  phone: z.string().min(10, {
    message: "Phone number must be at least 10 digits.",
  }),
  profileImage: z.any().optional(),
});

export function ProfileForm() {
  const userQuery = useQuery({ queryKey: ["profile"], queryFn: getUser });
  const [selectedImage, setSelectedImage] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (res) => {
      queryClient.invalidateQueries(["profile"]);
      toast({ description: res.message });
    },
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      profileImage: null,
    },
  });

  const onSubmit = (data) => {
    const formData = new FormData();
    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName);
    formData.append("email", data.email);
    formData.append("phone", data.phone);
    if (data.profileImage) {
      formData.append("image", data.profileImage);
    }

    profileMutation.mutate(formData);

    form.reset();
    setSelectedImage(null);
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(URL.createObjectURL(file));
      form.setValue("profileImage", file);
    }
  };

  if (userQuery.isSuccess)
    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8"
          encType="multipart/form-data"
        >
          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center gap-4">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Profile Preview"
                className="w-24 h-24 rounded-full object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-xs mx-auto file:py-1 file:border-[1px] file:hover:cursor-pointer file:border-black file:bg-white file:rounded-full file:px-5"
            />
          </div>

          {/* First Name Field */}
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder={userQuery.data.user.firstname}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Last Name Field */}
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder={userQuery.data.user.lastname}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder={userQuery.data.user.email} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone Field */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder={userQuery.data.user.phone} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">Update Profile</Button>
        </form>
      </Form>
    );
}
