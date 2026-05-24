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
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { updatePassword } from "../../api/userApi";
import { useToast } from "../../hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PasswordForm({ onCancel }) {
  const { t } = useTranslation();
  const formSchema = z
    .object({
      currentPassword: z.string().min(6, {
        message: t("profile.passwordForm.validation.currentPasswordMin"),
      }),
      newPassword: z.string().min(6, {
        message: t("profile.passwordForm.validation.newPasswordMin"),
      }),
      confirmPassword: z.string().min(6, {
        message: t("profile.passwordForm.validation.confirmPasswordMin"),
      }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("profile.passwordForm.validation.passwordsMustMatch"),
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showCurrent ? "text" : "password"}
                    placeholder={t("profile.passwordForm.currentPasswordPlaceholder")}
                    className="pl-9 h-11 bg-black/[0.02]"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
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
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showNew ? "text" : "password"}
                    placeholder={t("profile.passwordForm.newPasswordPlaceholder")}
                    className="pl-9 h-11 bg-black/[0.02]"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
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
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder={t("profile.passwordForm.confirmNewPasswordPlaceholder")}
                    className="pl-9 h-11 bg-black/[0.02]"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="rounded-lg h-9"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className="rounded-lg h-9 bg-brand-green hover:bg-[#287854] text-white"
            disabled={passwordMutation.isPending}
          >
            {passwordMutation.isPending ? t("profile.form.updating", "Updating...") : t("profile.passwordForm.submit", "Update Password")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
