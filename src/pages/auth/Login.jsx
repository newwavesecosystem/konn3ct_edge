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
import { GoogleLogin, useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

export default function Login() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, []);

  return (
    <div className="page container mx-auto flex justify-center">
      <SideDetail />
      <Card className="max-w-[560px] flex-1 ">
        <LoginForm />
        <p className="text-[#0A2540] text-center text-sm">
          By signing in you understand and agree to the Newwaves ecosystem Terms
          of Use. For more information about Privacy Data visit the Newwaves
          Privacy Data Sheets.
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
  const { login } = useAuth();
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

  async function onSubmit(values) {
    loginMutation.mutate(values);
  }

  const handleGoogleLogin = useGoogleLogin({
    // onSuccess: (tokenResponse) => console.log(tokenResponse),
    onError: (error) => console.log(error),
  });

  return (
    <div className="px-20">
      <div className="flex justify-center">
        <img src={logo} alt="konn3ct" />
      </div>
      <h3 className="text-xl font-bold mb-10 text-center">Sign in</h3>
      <p className="text-xl font-medium text-center mb-10">Continue with: </p>

      <div className="flex justify-evenly">
        <div className="flex flex-col justify-center items-center gap-y-1 cursor-pointer">
          <img className="grayscale h-8" src={facebook} alt="Facebook" />{" "}
          <p className="text-[10px] font-medium">Facebook</p>
        </div>
        <div
          className="flex flex-col justify-center items-center gap-y-1 cursor-pointer"
          onClick={() => handleGoogleLogin()}
        >
          <img className="h-8" src={google} alt="google" />
          <p className="text-[10px] font-medium">Google</p>
        </div>
        <div className="flex flex-col justify-center items-center gap-y-1 cursor-pointer">
          <img className="grayscale h-8" src={apple} alt="apple" />{" "}
          <p className="text-[10px] font-medium">Apple</p>
        </div>
        <div className="flex flex-col justify-center items-center gap-y-1 cursor-pointer">
          <img className="grayscale h-8" src={sso} alt="sso" />{" "}
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
                    className="rounded-full px-4"
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
                      className="rounded-full px-4"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
                <div className="flex justify-center mt-5">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#012E89] text-[14px] font-bold"
                  >
                    {showPassword ? <p>Hide password</p> : <p>Show password</p>}
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
      <div className="flex justify-center my-8 gap-x-1">
        <p>Don't have an account?</p>
        <Link to="/register" className="text-[#012E89]">
          Sign up
        </Link>
      </div>
    </div>
  );
}
