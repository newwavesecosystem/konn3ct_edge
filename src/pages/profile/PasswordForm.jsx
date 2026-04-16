import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { updatePassword } from "../../api/userApi";
import { useToast } from "../../hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

const PASSWORD_FORM_TEXT = {
  validation: {
    currentPasswordMin: "Current password must be at least 6 characters.",
    newPasswordMin: "New password must be at least 6 characters.",
    confirmPasswordMin: "Confirm password must be at least 6 characters.",
    passwordsMustMatch: "Passwords must match.",
  },
  currentPassword: "Current Password",
  enterCurrentPassword: "Enter current password",
  newPassword: "New Password",
  enterNewPassword: "Enter new password",
  confirmNewPassword: "Confirm New Password",
  confirmNewPasswordPlaceholder: "Confirm new password",
  save: "Save",
};

export function PasswordForm() {
  const formSchema = z
    .object({
      currentPassword: z.string().min(6, {
        message: PASSWORD_FORM_TEXT.validation.currentPasswordMin,
      }),
      newPassword: z.string().min(6, {
        message: PASSWORD_FORM_TEXT.validation.newPasswordMin,
      }),
      confirmPassword: z.string().min(6, {
        message: PASSWORD_FORM_TEXT.validation.confirmPasswordMin,
      }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: PASSWORD_FORM_TEXT.validation.passwordsMustMatch,
      path: ["confirmPassword"],
    });
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { toast } = useToast();
  const navigate = useNavigate();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: (res) => {
      toast({ description: res.message });
      if (res.success) {
        navigate("/login");
      }
    },
  });

  const onSubmit = (data) => {
    const payload = {
      current_password: data.currentPassword,
      new_password: data.newPassword,
    };
    passwordMutation.mutate(payload);
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PASSWORD_FORM_TEXT.currentPassword}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    placeholder={PASSWORD_FORM_TEXT.enterCurrentPassword}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PASSWORD_FORM_TEXT.newPassword}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    placeholder={PASSWORD_FORM_TEXT.enterNewPassword}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PASSWORD_FORM_TEXT.confirmNewPassword}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder={
                      PASSWORD_FORM_TEXT.confirmNewPasswordPlaceholder
                    }
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg">
          {PASSWORD_FORM_TEXT.save}
        </Button>
      </form>
    </Form>
  );
}
