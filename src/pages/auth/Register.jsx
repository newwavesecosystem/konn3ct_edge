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
import { Eye, EyeOff, Search } from "lucide-react";
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
import { useTranslation } from "react-i18next";
import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  validatePhoneNumberLength,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import {
  clearStoredReferralCode,
  getReferralCodeFromSearchParams,
  getStoredReferralCode,
  normalizeReferralCode,
  setStoredReferralCode,
} from "../../lib/referral";
import {
  googleUserInfoUrl,
} from "../../lib/externalLinks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../components/ui/select";
import { privacyPolicyUrl } from "../../lib/externalLinks";

const regionNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const getCountryLabel = (countryCode) => {
  const countryName = regionNames?.of(countryCode) || countryCode;
  return `${countryName} (+${getCountryCallingCode(countryCode)})`;
};

const getPhoneValidationMessage = (validationResult, t) => {
  switch (validationResult) {
    case "TOO_SHORT":
      return t("auth.register.validation.phoneTooShort");
    case "TOO_LONG":
      return t("auth.register.validation.phoneTooLong");
    case "INVALID_LENGTH":
      return t("auth.register.validation.phoneInvalidLength");
    default:
      return t("auth.register.validation.phoneInvalid");
  }
};

export default function Register() {
  const { t } = useTranslation();
  useFacebookSDK();

  return (
    <div className="page container mx-auto flex flex-col justify-center px-4 sm:flex-row md:flex-col lg:flex-row lg:px-0">
      <SideDetail className="md:hidden lg:flex" />
      <Card className="w-full max-w-md flex-1 sm:max-w-[560px] md:max-w-md lg:max-w-[560px]">
        <RegisterForm />
        <p className="px-2 text-center text-xs text-[#0A2540] dark:text-white sm:text-sm">
          {t("auth.termsPrefix")}{" "}
          <a
            href={privacyPolicyUrl}
            className="text-blue-500 underline dark:text-blue-400"
            rel="noreferrer"
            target="_blank"
          >
            {t("auth.privacyLinkLabel")}
          </a>
        </p>
      </Card>
    </div>
  );
}

export function RegisterForm() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const referralCodeFromUrl = useMemo(
    () => getReferralCodeFromSearchParams(searchParams),
    [searchParams]
  );
  const initialReferralCode = referralCodeFromUrl || getStoredReferralCode();
  const countryOptions = useMemo(
    () =>
      getCountries()
        .map((countryCode) => ({
          value: countryCode,
          label: getCountryLabel(countryCode),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    []
  );
  const selectedCountryExample = getExampleNumber("NG", examples);
  const formSchema = z.object({
    email: z.string().email({ message: t("auth.register.validation.email") }),
    password: z
      .string()
      .min(8, { message: t("auth.register.validation.passwordMin") })
      .regex(/[A-Z]/, {
        message: t("auth.register.validation.passwordUppercase"),
      })
      .regex(/[a-z]/, {
        message: t("auth.register.validation.passwordLowercase"),
      })
      .regex(/[0-9]/, {
        message: t("auth.register.validation.passwordNumber"),
      })
      .regex(/[@$!%*?&]/, {
        message: t("auth.register.validation.passwordSpecialCharacter"),
      }),
    firstname: z
      .string()
      .min(2, { message: t("auth.register.validation.firstNameRequired") })
      .refine((value) => value.trim().length > 0, {
        message: t("auth.register.validation.firstNameWhitespace"),
      }),
    lastname: z
      .string()
      .min(2, { message: t("auth.register.validation.lastNameRequired") })
      .refine((value) => value.trim().length > 0, {
        message: t("auth.register.validation.lastNameWhitespace"),
      }),
    country_code: z.string().min(1, {
      message: t("auth.register.validation.countryRequired"),
    }),
    phone: z.string().transform((value) => value.replace(/\D/g, "")),
    referral_code: z.string().optional(),
  }).superRefine((values, ctx) => {
    const validationResult = validatePhoneNumberLength(
      values.phone,
      values.country_code
    );

    if (validationResult) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: getPhoneValidationMessage(validationResult, t),
        path: ["phone"],
      });
    }
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      firstname: "",
      lastname: "",
      country_code: "NG",
      phone: "",
      referral_code: initialReferralCode,
    },
  });

  const { register, login_social } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const { ready: appleSdkReady, error: appleSdkError } = useAppleSDK();
  const selectedCountryCode = form.watch("country_code");
  const selectedCountryLabel =
    countryOptions.find((option) => option.value === selectedCountryCode)
      ?.label || t("common.selectCountry");
  const selectedPhoneExample =
    getExampleNumber(selectedCountryCode, examples) || selectedCountryExample;
  const phoneMaxLength = selectedPhoneExample?.nationalNumber?.length;
  const filteredCountryOptions = useMemo(() => {
    const normalizedQuery = countrySearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return countryOptions;
    }

    return countryOptions.filter((country) =>
      country.label.toLowerCase().includes(normalizedQuery)
    );
  }, [countryOptions, countrySearch]);

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (res) => {
      if (res.success) {
        clearStoredReferralCode();
        toast({ title: t("auth.register.successTitle"), description: res.message });
        navigate("/");
      } else {
        toast({
          title: t("auth.register.errorTitle"),
          description: res.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: t("auth.register.errorTitle"),
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
        toast({
          title: t("auth.register.loginSuccessTitle"),
          description: res.message,
        });
        navigate("/");
      } else {
        toast({
          title: t("auth.register.loginErrorTitle"),
          description: res.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: t("auth.register.loginErrorTitle"),
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
    const { referral_code, country_code, phone, ...restValues } = values;
    const normalizedReferralCode = normalizeReferralCode(referral_code);
    const referralPayload = getReferralPayload(referral_code);
    const normalizedPhone = `+${getCountryCallingCode(country_code)}${phone}`;

    if (normalizedReferralCode) {
      setStoredReferralCode(normalizedReferralCode);
    } else {
      clearStoredReferralCode();
    }

    registerMutation.mutate({
      ...restValues,
      phone: normalizedPhone,
      ...referralPayload,
    });
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log("Google Login Success:", tokenResponse);

      try {
        if (!googleUserInfoUrl) {
          toast({
            title: t("auth.register.loginErrorTitle"),
            description: t("auth.register.googleUserInfoMissing"),
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
      title: t("auth.login.appleFailedTitle"),
      description: appleSdkError
        ? t("auth.register.appleUnavailable")
        : t("auth.register.appleLoading"),
      variant: "destructive",
    });
  };

  return (
    <div className="px-4 sm:px-20 md:px-8 lg:px-20">
      <div className="mb-6 flex justify-center">
        <img src={logo} alt="konn3ct" className="h-10 sm:h-auto" />
      </div>
      <h3 className="mb-6 text-center text-lg font-bold sm:text-xl">
        {t("auth.register.title")}
      </h3>
      <p className="mb-8 text-center text-base font-medium sm:text-xl">
        {t("common.continueWith")}
      </p>

      <div className="flex flex-wrap justify-center gap-6 sm:justify-evenly sm:gap-0 md:gap-4 lg:gap-0">
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-y-1"
          onClick={handleFacebookLogin}
        >
          <img className="h-8" src={facebook} alt={t("common.facebook")} />
          <p className="text-[10px] font-medium">{t("common.facebook")}</p>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-y-1"
          onClick={() => handleGoogleLogin()}
        >
          <img className="h-8" src={google} alt={t("common.google")} />
          <p className="text-[10px] font-medium">{t("common.google")}</p>
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
                <img className="h-8" src={apple} alt={t("common.apple")} />
                <p className="text-[10px] font-medium">{t("common.apple")}</p>
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
            <img className="h-8" src={apple} alt={t("common.apple")} />
            <p className="text-[10px] font-medium">{t("common.apple")}</p>
          </div>
        )}
      </div>

      <div className="my-8 flex items-center justify-center">
        <Separator className="h-[1px] flex-1 bg-black" />
        <p className="mx-2 text-sm font-medium sm:text-base">{t("common.or")}</p>
        <Separator className="h-[1px] flex-1 bg-black" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540] dark:text-white">
                  {t("auth.register.emailLabel")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t("auth.register.emailPlaceholder")}
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
                <FormLabel className="font-bold text-[#0A2540] dark:text-white">
                  {t("common.password")}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.register.passwordPlaceholder")}
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
                <FormLabel className="font-bold text-[#0A2540] dark:text-white">
                  {t("auth.register.firstName")}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("auth.register.firstNamePlaceholder")}
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
                <FormLabel className="font-bold text-[#0A2540] dark:text-white">
                  {t("auth.register.lastName")}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("auth.register.lastNamePlaceholder")}
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
            name="country_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540] dark:text-white">
                  {t("auth.register.phone")}
                </FormLabel>
                <div className="flex gap-3">
                  <FormControl>
                    <div className="w-[140px] shrink-0">
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("phone", "");
                          }}
                        >
                        <SelectTrigger className="rounded-2xl">
                          <span className="truncate text-foreground">
                            {selectedCountryLabel}
                          </span>
                        </SelectTrigger>
                        <SelectContent className="left-0 w-[280px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl p-0">
                          <div
                            className="border-b border-border p-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center rounded-xl border border-input bg-background px-3">
                              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <Input
                                value={countrySearch}
                                onChange={(event) =>
                                  setCountrySearch(event.target.value)
                                }
                                placeholder={t("common.searchCountryOrCode")}
                                className="border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                              />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto p-2">
                            {filteredCountryOptions.length > 0 ? (
                              filteredCountryOptions.map((countryCode) => (
                                <SelectItem
                                  key={countryCode.value}
                                  value={countryCode.value}
                                  className="whitespace-normal rounded-xl px-3 py-2.5"
                                >
                                  {countryCode.label}
                                </SelectItem>
                              ))
                            ) : (
                              <p className="px-3 py-4 text-sm text-muted-foreground">
                                {t("common.noCountryMatches")}
                              </p>
                            )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                  </FormControl>

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field: phoneField }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="tel"
                            inputMode="numeric"
                            placeholder={
                              selectedPhoneExample?.nationalNumber ||
                              "8166390205"
                            }
                            className="w-full rounded-full px-4"
                            {...phoneField}
                            onChange={(event) => {
                              const digitsOnly = event.target.value
                                .replace(/\D/g, "")
                                .slice(0, phoneMaxLength);
                              phoneField.onChange(digitsOnly);
                            }}
                            maxLength={phoneMaxLength}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="referral_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-[#0A2540] dark:text-white">
                  {t("auth.register.referralCode")}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("auth.register.referralCodePlaceholder")}
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
            {t("auth.register.submit")}
          </Button>
        </form>
      </Form>

      <div className="my-4 flex justify-center gap-x-2 text-sm sm:text-base">
        <p>{t("auth.register.alreadyHaveAccount")}</p>
        <Link to="/login" className="text-[#012E89] underline dark:text-blue-400">
          {t("auth.register.signIn")}
        </Link>
      </div>
    </div>
  );
}
