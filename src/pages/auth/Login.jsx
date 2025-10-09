import { useEffect, useState } from "react";
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
import { Link, useNavigate } from "react-router-dom";
import SideDetail from "./SideDetail";
import { Card } from "../../components/ui/card";
import logo from "../../assets/konn3ct_logo.png";
import facebook from "../../assets/icons/facebook.svg";
import google from "../../assets/icons/google.svg";
import sso from "../../assets/icons/sso.svg";
import apple from "../../assets/icons/apple.svg";
import { Separator } from "../../components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";
import { useGoogleLogin } from "@react-oauth/google";
import useFacebookSDK from "../../hooks/useFacebookSDK";
import AppleLogin from "react-apple-login";
import axios from "axios";

export default function Login() {
  useFacebookSDK();
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, []);

  return (
    <div className="page container mx-auto flex flex-col sm:flex-row justify-center px-4 sm:px-0">
      <SideDetail className="hidden sm:block" />
      <Card className="w-full max-w-md sm:max-w-[560px] flex-1">
        <LoginForm />
        <p className="text-[#0A2540] text-center text-xs sm:text-sm px-2">
          By signing up you understand and agree to the Konn3ct
          Terms of Use. For more information about Privacy Data
          visit the{" "}
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

export function LoginForm() {
  const formSchema = z.object({
    username: z.string().email({ message: "Invalid email address." }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters." }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, login_social } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (res) => {
      if (res.success) {
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

  const socialLoginMutation = useMutation({
    mutationFn: login_social,
    onSuccess: (res) => {
      if (res.success) {
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

  async function onSubmit(values) {
    loginMutation.mutate(values);
  }

  const handleGoogleLogin = useGoogleLogin({
      onSuccess: async (tokenResponse) => {
          // tokenResponse contains the access_token and other details
          console.log('Google Login Success:', tokenResponse);

          // 2. Fetch User Info (Optional, but recommended for user details)
          // The useGoogleLogin hook (in the default implicit flow) returns an access_token.
          // We use this token to securely fetch the user's public profile data from Google.
          try {
              const userInfoResponse = await axios.get(
                  'https://www.googleapis.com/oauth2/v3/userinfo',
                  {
                      headers: {
                          Authorization: `Bearer ${tokenResponse.access_token}`,
                      },
                  }
              );

              console.log('User Info:', userInfoResponse.data);

              // Send token & profile to backend
              socialLoginMutation.mutate({
                  provider: "google",
                  accessstoken: tokenResponse.access_token,
                  email: userInfoResponse.data.email,
                  name: userInfoResponse.data.name,
                  id: userInfoResponse.sub,
                  avatar: userInfoResponse.data.picture,
              });

          } catch (error) {
              console.error('Error fetching user info or sending to backend:', error);
              // Handle server communication errors
          }
      },
    onError: (error) => console.log(error),
  });

  // ✅ Facebook login
  const handleFacebookLogin = () => {
    if (!window.FB) {
      console.error("FB SDK not loaded");
      return;
    }

    window.FB.login(
      (response) => {
        if (response.authResponse) {
          const { accessToken } = response.authResponse;

          // Get basic profile info
          window.FB.api(
            "/me",
            { fields: "id,name,email,picture" },
            (profile) => {
              console.log("Facebook profile:", profile);

              // Send token & profile to backend
                socialLoginMutation.mutate({
                    provider: "facebook",
                    accessstoken: accessToken,
                    email: profile.email,
                    name: profile.name,
                    facebookId: profile.id,
                    avatar: profile.picture?.data?.url,
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

  // ✅ Apple login handler
  const handleAppleResponse = (res) => {
    console.log("Apple login response:", res);

    if (res?.authorization?.code) {
        socialLoginMutation.mutate({
        provider: "apple",
        accessstoken: res.authorization.code,
        email: res.user?.email,
        name:
          res.user?.name?.firstName && res.user?.name?.lastName
            ? `${res.user.name.firstName} ${res.user.name.lastName}`
            : "N/A",
      });
    } else {
      toast({
        title: "Apple login failed",
        description: "Could not complete Apple login",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-4 sm:px-20">
      <div className="flex justify-center mb-6">
        <img src={logo} alt="konn3ct" className="h-10 sm:h-auto" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold mb-6 text-center">Sign in</h3>
      <p className="text-base sm:text-xl font-medium text-center mb-8">
        Continue with:
      </p>

      <div className="flex flex-wrap justify-center sm:justify-evenly gap-6 sm:gap-0">
        {/* ✅ Facebook */}
        <div
          className="flex flex-col justify-center items-center gap-y-1 cursor-pointer"
          onClick={() => handleFacebookLogin()}
        >
          <img className="h-8" src={facebook} alt="Facebook" />
          <p className="text-[10px] font-medium">Facebook</p>
        </div>

        {/* ✅ Google */}
        <div
          className="flex flex-col justify-center items-center gap-y-1 cursor-pointer"
          onClick={() => handleGoogleLogin()}
        >
          <img className="h-8" src={google} alt="Google" />
          <p className="text-[10px] font-medium">Google</p>
        </div>

        {/* ✅ Apple */}
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
          callback={handleAppleResponse}
        />

        {/* ✅ SSO */}
        <div onClick={()=>toast({
            title: "SSO Login Failed",
            description: "Your device is not registered for this access. Please contact your system administrator.",
            variant: "destructive",
        })} className="flex flex-col justify-center items-center gap-y-1 cursor-pointer">
          <img className="grayscale h-8" src={sso} alt="SSO" />
          <p className="text-[10px] font-medium">SSO</p>
        </div>
      </div>

      <div className="flex my-8 justify-center items-center">
        <Separator className="flex-1 bg-black h-[1px]" />
        <p className="mx-2 text-sm sm:text-base font-medium">OR</p>
        <Separator className="flex-1 bg-black h-[1px]" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A2540] font-bold">
                  Email address
                </FormLabel>
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
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="rounded-full px-4 w-full"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#012E89] text-sm sm:text-[14px] font-bold"
                  >
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-[#012E89] shadow-md"
            disabled={loginMutation.isPending}
          >
            Sign in
          </Button>
        </form>
      </Form>

      <div className="flex justify-center my-4 gap-x-2 text-sm sm:text-base">
        <p>Don't have an account?</p>
        <Link to="/register" className="text-[#012E89]">
          Sign up
        </Link>
      </div>
      <Link
        to="/forgot-password"
        className="text-[#012E89] flex justify-center mb-8 text-sm sm:text-base"
      >
        Forgot password?
      </Link>
    </div>
  );
}
