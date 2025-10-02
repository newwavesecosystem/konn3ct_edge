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
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Card } from "../../components/ui/card";
import SideDetail from "./SideDetail";
import logo from "../../assets/konn3ct_logo.png";
import facebook from "../../assets/icons/facebook.svg";
import google from "../../assets/icons/google.svg";
import apple from "../../assets/icons/apple.svg";
import sso from "../../assets/icons/sso.svg";
import { Separator } from "../../components/ui/separator";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";
import { useGoogleLogin } from "@react-oauth/google";
import useFacebookSDK from "../../hooks/useFacebookSDK";
import AppleLogin from "react-apple-login";

export default function Register() {
  useFacebookSDK();

  return (
    <div className="page container mx-auto flex flex-col sm:flex-row justify-center px-4 sm:px-0">
      {/* Side detail (desktop only) */}
      <SideDetail className="hidden sm:block" />
      {/* Form card */}
      <Card className="w-full max-w-md sm:max-w-[560px] flex-1">
        <RegisterForm />
        <p className="text-[#0A2540] text-center text-xs sm:text-sm px-2">
          By signing up you understand and agree to the Konn3ct Terms of Use. For
          more information about Privacy Data visit the{" "}
          <a
            href="https://konn3ct.com/docs/DATAPRIVACY.pdf"
            className="text-blue-500"
          >
            Konn3ct Privacy Data Sheets.
          </a>
        </p>
      </Card>
    </div>
  );
}

// ✅ Validation schema
const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter." })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter." })
    .regex(/[0-9]/, { message: "Password must contain at least one number." })
    .regex(/[@$!%*?&]/, {
      message: "Password must contain at least one special character (@$!%*?&).",
    }),
  firstname: z.string().min(2, { message: "First name is required." }).refine((v) => v.trim().length > 0, {
    message: "First name is required and cannot be empty or whitespace.",
  }),
  lastname: z.string().min(2, { message: "Last name is required." }).refine((v) => v.trim().length > 0, {
    message: "Last name is required and cannot be empty or whitespace.",
  }),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
});

export function RegisterForm() {
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
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Sign-up Successful", description: res.message });
        navigate("/");
      } else {
        toast({ title: "Sign-up Unsuccessful", description: res.message, variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Sign-up Unsuccessful", description: error.message, variant: "destructive" });
    },
  });

  async function onSubmit(values) {
    registerMutation.mutate(values);
  }

  const handleGoogleLogin = useGoogleLogin({
    onError: (error) => console.log(error),
  });

  const handleFacebookLogin = () => {
    if (!window.FB) {
      console.error("FB SDK not loaded");
      return;
    }
    window.FB.login(
      (response) => {
        if (response.authResponse) {
          const { accessToken } = response.authResponse;
          registerMutation.mutate({ provider: "facebook", token: accessToken });
        } else {
          console.log("Facebook login cancelled/failed", response);
        }
      },
      { scope: "email,public_profile" }
    );
  };

  return (
    <div className="px-4 sm:px-20">
      <div className="flex justify-center mb-6">
        <img src={logo} alt="konn3ct" className="h-10 sm:h-auto" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold mb-6 text-center">Sign Up</h3>
      <p className="text-base sm:text-xl font-medium text-center mb-8">
        Continue with:
      </p>

      {/* Social logins */}
      <div className="flex flex-wrap justify-center sm:justify-evenly gap-6 sm:gap-0">
        <div
          className="flex flex-col justify-center items-center gap-y-1 cursor-pointer"
          onClick={() => handleFacebookLogin()}
        >
          <img className="h-8" src={facebook} alt="Facebook" />
          <p className="text-[10px] font-medium">Facebook</p>
        </div>

        <div
          className="flex flex-col justify-center items-center gap-y-1 cursor-pointer"
          onClick={() => handleGoogleLogin()}
        >
          <img className="h-8" src={google} alt="Google" />
          <p className="text-[10px] font-medium">Google</p>
        </div>

        <AppleLogin
          clientId={process.env.REACT_APP_APPLE_CLIENT_ID}
          redirectURI={process.env.REACT_APP_APPLE_REDIRECT_URI}
          responseType="code"
          responseMode="query"
          usePopup={true}
          render={(renderProps) => (
            <div
              onClick={renderProps.onClick}
              className="flex flex-col justify-center items-center gap-y-1 cursor-pointer"
            >
              <img className="h-8" src={apple} alt="Apple" />
              <p className="text-[10px] font-medium">Apple</p>
            </div>
          )}
          callback={(res) => {
            console.log("Apple response:", res);
          }}
        />

        <div className="flex flex-col justify-center items-center gap-y-1 cursor-pointer">
          <img className="h-8" src={sso} alt="SSO" />
          <p className="text-[10px] font-medium">SSO</p>
        </div>
      </div>

      {/* Divider */}
      <div className="flex my-8 justify-center items-center">
        <Separator className="flex-1 bg-black h-[1px]" />
        <p className="mx-2 text-sm sm:text-base font-medium">OR</p>
        <Separator className="flex-1 bg-black h-[1px]" />
      </div>

      {/* Form fields */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="rounded-full px-4 w-full"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="rounded-full px-4 w-full"
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

          {/* First Name */}
          <FormField
            control={form.control}
            name="firstname"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">First Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Samuel"
                    className="rounded-full px-4 w-full"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Last Name */}
          <FormField
            control={form.control}
            name="lastname"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">Last Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Odejinmi"
                    className="rounded-full px-4 w-full"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="08166390205"
                    className="rounded-full px-4 w-full"
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

      {/* Footer */}
      <div className="flex justify-center my-4 gap-x-2 text-sm sm:text-base">
        <p>Already have an account?</p>
        <Link to="/login" className="text-[#012E89]">
          Sign in
        </Link>
      </div>
    </div>
  );
}
