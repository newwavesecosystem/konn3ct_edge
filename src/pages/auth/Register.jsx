import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import useAuth from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Card } from "../../components/ui/card";
import SideDetail from "./SideDetail";
import logo from "../../assets/konn3ct_logo.png";
import facebook from "../../assets/icons/facebook.svg";
import google from "../../assets/icons/google.svg";
import sso from "../../assets/icons/sso.svg";
import apple from "../../assets/icons/apple.svg";
import { Separator } from "../../components/ui/separator";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

export default function Register() {
  return (
    <div className="page container mx-auto flex justify-center">
      <SideDetail />
      <Card className="max-w-[560px] flex-1 ">
        <RegisterForm />
        <p className="text-[#0A2540] text-center text-sm">
          By signing up you understand and agree to the Newwaves ecosystem Terms
          of Use. For more information about Privacy Data visit the Newwaves
          Privacy Data Sheets.
        </p>
      </Card>
    </div>
  );
}

// Define the Zod schema for registration validation
const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter.",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter.",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number." })
    .regex(/[@$!%*?&]/, {
      message:
        "Password must contain at least one special character (@$!%*?&).",
    }),
  firstname: z.string().min(2, { message: "First name is required." }),
  lastname: z.string().min(2, { message: "Last name is required." }),
  phone: z
    .string()
    .min(10, { message: "Phone number must be at least 10 digits." }),
});

export function RegisterForm() {
  // Initialize the form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      firstname: "",
      lastname: "",
      phone: "",
    },
  });

  const { register } = useAuth();

  const registerMutation = useMutation({
    mutationFn: register,
  });

  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  // Handle form submission
  async function onSubmit(values) {
    registerMutation.mutate(values, {
      onSuccess: () => {
        alert("You've successfully signed up to Konn3ct");
      },
      onError: () => {
        alert("There was an error signing up");
      },
    });
  }

  return (
    <div className="px-20">
      <div className="flex justify-center">
        <img src={logo} alt="konn3ct" />
      </div>
      <h3 className="text-xl font-bold mb-10 text-center">Sign in</h3>
      <p className="text-xl font-medium text-center mb-10">Continue with: </p>

      <div className="flex justify-evenly">
        <div className="flex flex-col justify-center items-center gap-y-1">
          <img className="h-8" src={facebook} alt="Facebook" />{" "}
          <p className="text-[10px] font-medium">Facebook</p>
        </div>
        <div className="flex flex-col justify-center items-center gap-y-1">
          <img className="h-8" src={google} alt="google" />{" "}
          <p className="text-[10px] font-medium">Google</p>
        </div>
        <div className="flex flex-col justify-center items-center gap-y-1">
          <img className="h-8" src={apple} alt="apple" />{" "}
          <p className="text-[10px] font-medium">Apple</p>
        </div>
        <div className="flex flex-col justify-center items-center gap-y-1">
          <img className="h-8" src={sso} alt="sso" />{" "}
          <p className="text-[10px] font-medium">SSO</p>
        </div>
      </div>

      <div className="flex my-10 justify-center items-center">
        <Separator className="flex-1 bg-black h-[1px]" />
        <p className="mx-2 font-medium">OR</p>
        <Separator className="flex-1 bg-black h-[1px]" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    className="rounded-full px-4"
                    type="email"
                    placeholder="you@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">
                  Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      className="rounded-full px-4"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* First Name Field */}
          <FormField
            control={form.control}
            name="firstname"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">
                  First Name
                </FormLabel>
                <FormControl>
                  <Input
                    className="rounded-full px-4"
                    placeholder="Samuel"
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
            name="lastname"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">
                  Last Name
                </FormLabel>
                <FormControl>
                  <Input
                    className="rounded-full px-4"
                    placeholder="Odejinmi"
                    {...field}
                  />
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
                <FormLabel className="text-[#0A2540] font-bold">
                  Phone
                </FormLabel>
                <FormControl>
                  <Input
                    className="rounded-full px-4"
                    type="tel"
                    placeholder="08166390205"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full bg-[#012E89] shadow-md">
            Sign up
          </Button>
        </form>
      </Form>
      <div className="flex justify-center my-8 gap-x-1">
        <p>Already have an account?</p>
        <Link to="/login" className="text-[#012E89]">
          Sign in
        </Link>
      </div>
    </div>
  );
}
