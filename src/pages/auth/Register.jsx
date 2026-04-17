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
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/card";
import SideDetail from "./SideDetail";
import logo from "../../assets/konn3ct_logo.png";
import facebook from "../../assets/icons/facebook.svg";
import google from "../../assets/icons/google.svg";
import apple from "../../assets/icons/apple.svg";
import { Separator } from "../../components/ui/separator";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";
import { useGoogleLogin } from "@react-oauth/google";
import useFacebookSDK from "../../hooks/useFacebookSDK";
import useAppleSDK from "../../hooks/useAppleSDK";
import AppleLogin from "react-apple-login";
import axios from "axios";
import {
  clearStoredReferralCode,
  getReferralCodeFromSearchParams,
  getStoredReferralCode,
  normalizeReferralCode,
  setStoredReferralCode,
} from "../../lib/referral";
import {
  googleUserInfoUrl,
  privacyPolicyUrl,
} from "../../lib/externalLinks";

export default function Register() {
  useFacebookSDK();

  return (
    <div className="page container mx-auto flex flex-col justify-center px-4 sm:flex-row md:flex-col lg:flex-row lg:px-0">
      <SideDetail className="md:hidden lg:flex" />
      <Card className="w-full max-w-md flex-1 sm:max-w-[560px] md:max-w-md lg:max-w-[560px]">
        <RegisterForm />
        <p className="px-2 text-center text-xs text-[#0A2540] sm:text-sm">
          By signing up you understand and agree to the Konn3ct Terms of Use.
          For more information about Privacy Data visit the{" "}
          <a
            href={privacyPolicyUrl}
            className="text-blue-500"
            rel="noreferrer"
            target="_blank"
          >
            Konn3ct Privacy Data Sheets.
          </a>
        </p>
      </Card>
    </div>
  );
}

export function RegisterForm() {
  const [searchParams] = useSearchParams();
  const referralCodeFromUrl = useMemo(
    () => getReferralCodeFromSearchParams(searchParams),
    [searchParams]
  );
  const initialReferralCode = referralCodeFromUrl || getStoredReferralCode();
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
      .regex(/[0-9]/, {
        message: "Password must contain at least one number.",
      })
      .regex(/[@$!%*?&]/, {
        message:
          "Password must contain at least one special character (@$!%*?&).",
      }),
    firstname: z
      .string()
      .min(2, { message: "First name is required." })
      .refine((value) => value.trim().length > 0, {
        message: "First name is required and cannot be empty or whitespace.",
      }),
    lastname: z
      .string()
      .min(2, { message: "Last name is required." })
      .refine((value) => value.trim().length > 0, {
        message: "Last name is required and cannot be empty or whitespace.",
      }),
    phone: z
      .string()
      .min(10, { message: "Phone number must be at least 10 digits." }),
    referral_code: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      firstname: "",
      lastname: "",
      phone: "",
      referral_code: initialReferralCode,
    },
  });

  const { register, login_social } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { ready: appleSdkReady, error: appleSdkError } = useAppleSDK();

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (res) => {
      if (res.success) {
        clearStoredReferralCode();
        toast({ title: "Sign-up Successful", description: res.message });
        navigate("/");
      } else {
        toast({
          title: "Sign-up Unsuccessful",
          description: res.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Sign-up Unsuccessful",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const socialLoginMutation = useMutation({
    mutationFn: login_social,
    onSuccess: (res) => {
      if (res.success) {
        clearStoredReferralCode();
        toast({ title: "Login Successful", description: res.message });
        navigate("/");
      } else {
        toast({
          title: "Login Unsuccessful",
          description: res.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Login Unsuccessful",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (referralCodeFromUrl) {
      setStoredReferralCode(referralCodeFromUrl);
    }

    const nextReferralCode = referralCodeFromUrl || getStoredReferralCode();

    if (nextReferralCode !== form.getValues("referral_code")) {
      form.setValue("referral_code", nextReferralCode, { shouldDirty: false });
    }
  }, [form, referralCodeFromUrl]);

  const getReferralPayload = (value = form.getValues("referral_code")) => {
    const referralCode = normalizeReferralCode(value);

    if (!referralCode) return {};

    return {
      referral: referralCode,
      ref: referralCode,
    };
  };

  async function onSubmit(values) {
    const { referral_code, ...restValues } = values;
    const normalizedReferralCode = normalizeReferralCode(referral_code);
    const referralPayload = getReferralPayload(referral_code);

    if (normalizedReferralCode) {
      setStoredReferralCode(normalizedReferralCode);
    } else {
      clearStoredReferralCode();
    }

    registerMutation.mutate({
      ...restValues,
      ...referralPayload,
    });
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log("Google Login Success:", tokenResponse);

      try {
        if (!googleUserInfoUrl) {
          toast({
            title: "Login Unsuccessful",
            description: "Google user info URL is not configured.",
            variant: "destructive",
          });
          return;
        }

        const userInfoResponse = await axios.get(googleUserInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        console.log("User Info:", userInfoResponse.data);

        socialLoginMutation.mutate({
          provider: "google",
          accessstoken: tokenResponse.access_token,
          email: userInfoResponse.data.email,
          name: userInfoResponse.data.name,
          id: userInfoResponse.sub,
          avatar: userInfoResponse.data.picture,
          ...getReferralPayload(),
        });
      } catch (error) {
        console.error(
          "Error fetching user info or sending to backend:",
          error
        );
      }
    },
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

          window.FB.api(
            "/me",
            { fields: "id,name,email,picture" },
            (profile) => {
              console.log("Facebook profile:", profile);

              socialLoginMutation.mutate({
                provider: "facebook",
                accessstoken: accessToken,
                email: profile.email,
                name: profile.name,
                facebookId: profile.id,
                avatar: profile.picture?.data?.url,
                ...getReferralPayload(),
              });
            }
          );
        } else {
          console.log("Facebook login cancelled/failed", response);
        }
      },
      { scope: "email,public_profile" }
    );
  };

  const handleAppleUnavailable = () => {
    toast({
      title: "Apple login failed",
      description: appleSdkError
        ? "Apple sign-in is temporarily unavailable."
        : "Apple sign-in is still loading. Please try again.",
      variant: "destructive",
    });
  };

  return (
    <div className="px-4 sm:px-20 md:px-8 lg:px-20">
      <div className="mb-6 flex justify-center">
        <img src={logo} alt="konn3ct" className="h-10 sm:h-auto" />
      </div>
      <h3 className="mb-6 text-center text-lg font-bold sm:text-xl">
        Sign Up
      </h3>
      <p className="mb-8 text-center text-base font-medium sm:text-xl">
        Continue with:
      </p>

      <div className="flex flex-wrap justify-center gap-6 sm:justify-evenly sm:gap-0 md:gap-4 lg:gap-0">
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-y-1"
          onClick={handleFacebookLogin}
        >
          <img className="h-8" src={facebook} alt="Facebook" />
          <p className="text-[10px] font-medium">Facebook</p>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-y-1"
          onClick={() => handleGoogleLogin()}
        >
          <img className="h-8" src={google} alt="Google" />
          <p className="text-[10px] font-medium">Google</p>
        </div>

        {appleSdkReady ? (
          <AppleLogin
            clientId={process.env.REACT_APP_APPLE_CLIENT_ID}
            redirectURI={process.env.REACT_APP_APPLE_REDIRECT_URI}
            responseType="code"
            responseMode="query"
            usePopup={true}
            render={(renderProps) => (
              <div
                onClick={renderProps.onClick}
                className="flex cursor-pointer flex-col items-center justify-center gap-y-1"
              >
                <img className="h-8" src={apple} alt="Apple" />
                <p className="text-[10px] font-medium">Apple</p>
              </div>
            )}
            callback={(res) => {
              console.log("Apple response:", res);
            }}
          />
        ) : (
          <div
            onClick={handleAppleUnavailable}
            className="flex cursor-pointer flex-col items-center justify-center gap-y-1 opacity-60"
          >
            <img className="h-8" src={apple} alt="Apple" />
            <p className="text-[10px] font-medium">Apple</p>
          </div>
        )}
      </div>

      <div className="my-8 flex items-center justify-center">
        <Separator className="h-[1px] flex-1 bg-black" />
        <p className="mx-2 text-sm font-medium sm:text-base">OR</p>
        <Separator className="h-[1px] flex-1 bg-black" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540]">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full rounded-full px-4"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540]">
                  Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="w-full rounded-full px-4"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
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

          <FormField
            control={form.control}
            name="firstname"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540]">
                  First Name
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Samuel"
                    className="w-full rounded-full px-4"
                    {...field}
                  />
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
                <FormLabel className="font-bold text-[#0A2540]">
                  Last Name
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Odejinmi"
                    className="w-full rounded-full px-4"
                    {...field}
                  />
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
                <FormLabel className="font-bold text-[#0A2540]">
                  Phone
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="08166390205"
                    className="w-full rounded-full px-4"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> 

          <FormField
            control={form.control}
            name="referral_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540]">
                  Referral Code
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Referral Code"
                    className="w-full rounded-full px-4"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} 
          />

          <Button
            type="submit"
            className="w-full bg-[#012E89] shadow-md"
            disabled={registerMutation.isPending}
          >
            Sign up
          </Button>
        </form>
      </Form>

      <div className="my-4 flex justify-center gap-x-2 text-sm sm:text-base">
        <p>Already have an account?</p>
        <Link to="/login" className="text-[#012E89]">
          Sign in
        </Link>
      </div>
    </div>
  );
}
