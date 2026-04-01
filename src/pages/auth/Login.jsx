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
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation();
  useFacebookSDK();
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <div className="page container mx-auto flex flex-col justify-center px-4 sm:flex-row md:flex-col lg:flex-row lg:px-0">
      <SideDetail className="md:hidden lg:flex" />
      <Card className="w-full max-w-md flex-1 sm:max-w-[560px] md:max-w-md lg:max-w-[560px]">
        <LoginForm />
        <p className="px-2 text-center text-xs text-[#0A2540] sm:text-sm">
          {t("auth.termsPrefix")}{" "}
          <a
            href="https://konn3ct.com/docs/DATAPRIVACY.pdf"
            className="text-blue-500"
          >
            {t("auth.privacyLinkLabel")}
          </a>
        </p>
      </Card>
    </div>
  );
}

export function LoginForm() {
  const { t } = useTranslation();
  const formSchema = z.object({
    username: z
      .string()
      .email({ message: t("auth.validation.invalidEmail") }),
    password: z
      .string()
      .min(6, { message: t("auth.validation.passwordMin6") }),
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
        toast({ title: t("auth.loginSuccessful"), description: res.message });
        navigate("/");
      } else {
        toast({
          title: t("auth.loginUnsuccessful"),
          description: res.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: t("auth.loginUnsuccessful"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const socialLoginMutation = useMutation({
    mutationFn: login_social,
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: t("auth.loginSuccessful"), description: res.message });
        navigate("/");
      } else {
        toast({
          title: t("auth.loginUnsuccessful"),
          description: res.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: t("auth.loginUnsuccessful"),
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
      console.log("Google Login Success:", tokenResponse);

      try {
        const userInfoResponse = await axios.get(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );

        console.log("User Info:", userInfoResponse.data);

        socialLoginMutation.mutate({
          provider: "google",
          accessstoken: tokenResponse.access_token,
          email: userInfoResponse.data.email,
          name: userInfoResponse.data.name,
          id: userInfoResponse.sub,
          avatar: userInfoResponse.data.picture,
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
        title: t("auth.appleLoginFailed"),
        description: t("auth.appleLoginDescription"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-4 sm:px-20 md:px-8 lg:px-20">
      <div className="mb-6 flex justify-center">
        <img src={logo} alt="konn3ct" className="h-10 sm:h-auto" />
      </div>
      <h3 className="mb-6 text-center text-lg font-bold sm:text-xl">
        {t("auth.loginTitle")}
      </h3>
      <p className="mb-8 text-center text-base font-medium sm:text-xl">
        {t("auth.continueWith")}
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
          callback={handleAppleResponse}
        />

        <div
          onClick={() =>
            toast({
              title: t("auth.ssoLoginFailed"),
              description: t("auth.ssoLoginDescription"),
              variant: "destructive",
            })
          }
          className="flex cursor-pointer flex-col items-center justify-center gap-y-1"
        >
          <img className="h-8 grayscale" src={sso} alt="SSO" />
          <p className="text-[10px] font-medium">SSO</p>
        </div>
      </div>

      <div className="my-8 flex items-center justify-center">
        <Separator className="h-[1px] flex-1 bg-black" />
        <p className="mx-2 text-sm font-medium sm:text-base">{t("auth.or")}</p>
        <Separator className="h-[1px] flex-1 bg-black" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540]">
                  {t("auth.emailAddress")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t("auth.emailPlaceholder")}
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
                  {t("auth.password")}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.passwordPlaceholder")}
                      className="w-full rounded-full px-4"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-sm font-bold text-[#012E89] sm:text-[14px]"
                  >
                    {showPassword
                      ? t("auth.hidePassword")
                      : t("auth.showPassword")}
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
            {t("auth.signIn")}
          </Button>
        </form>
      </Form>

      <div className="my-4 flex justify-center gap-x-2 text-sm sm:text-base">
        <p>{t("auth.noAccount")}</p>
        <Link to="/register" className="text-[#012E89]">
          {t("auth.signUp")}
        </Link>
      </div>
      <Link
        to="/forgot-password"
        className="mb-8 flex justify-center text-sm text-[#012E89] sm:text-base"
      >
        {t("auth.forgotPasswordLink")}
      </Link>
    </div>
  );
}
