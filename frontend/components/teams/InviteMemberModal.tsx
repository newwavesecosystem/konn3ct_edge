"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Mail, Shield, Crown, User } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  role: z.enum(["Owner", "Admin", "Member"], { required_error: "Please select a role." }),
});

export type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: InviteFormValues) => void;
}

const roleOptions = [
  { value: "Owner", label: "Owner", description: "Full access to all resources", icon: <Crown className="h-4 w-4" /> },
  { value: "Admin", label: "Admin", description: "Can manage members and settings", icon: <Shield className="h-4 w-4" /> },
  { value: "Member", label: "Member", description: "Standard user access", icon: <User className="h-4 w-4" /> },
];

export function InviteMemberModal({ isOpen, onClose, onSuccess }: InviteMemberModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "Member",
    },
  });

  const onSubmit = async (data: InviteFormValues) => {
    setIsSubmitting(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    onSuccess(data);
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Invite Team Member</h2>
          <p className="text-sm text-text-muted mt-1">
            Send an invitation to add a new member to your team.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold text-text-primary">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              leftIcon={<Mail className="h-4 w-4" />}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-semibold text-text-primary">
              Assign Role
            </label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select
                  id="role"
                  options={roleOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select a role"
                />
              )}
            />
            {errors.role && (
              <p className="text-xs text-red-500 font-medium">{errors.role.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)]"
            >
              {isSubmitting ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
