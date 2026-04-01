import React, { useState } from "react";
import logo from "../assets/konn3ct_logo.png";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "../components/ui/navigation-menu";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";
import useAuth from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/userApi";
import { Button } from "./ui/button";
import { Menu, X } from "lucide-react"; // icons for mobile toggle
import { useTranslation } from "react-i18next";

const Navbar = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const userQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
    enabled: isAuthenticated,
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-[100] w-full border-b border-border/80 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors duration-300">
      <div className="flex items-center justify-between px-5 py-3">
        {/* Logo */}
        <Link to="/">
          <img src={logo} alt="Konne3ct logo" className="h-8" />
        </Link>

        {/* Desktop menu */}
        <NavigationMenu className="ml-10 hidden lg:flex">
          <NavigationMenuList className="flex space-x-6">
            <NavigationMenuItem>
              <Link
                className={navigationMenuTriggerStyle()}
                to={`${process.env.REACT_APP_LANDING_URL}/Features`}
              >
                {t("navigation.solutions")}
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link
                className={navigationMenuTriggerStyle()}
                to={`${process.env.REACT_APP_LANDING_URL}/Pricing`}
              >
                {t("navigation.plansPricing")}
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link className={navigationMenuTriggerStyle()} to="/">
                {t("navigation.dashboard")}
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right side (auth or guest) */}
        <div className="ml-auto hidden items-center gap-6 lg:flex">
          {isAuthenticated ? (
            <>
              <Link className={navigationMenuTriggerStyle()} to="/rooms">
                {t("navigation.schedule")}
              </Link>
              <Link className={navigationMenuTriggerStyle()} to="/join">
                {t("navigation.join")}
              </Link>
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {t("navigation.host")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="!w-[200px] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md">
                      <div className="flex flex-col gap-y-5">
                        <Link
                          to="/rooms"
                          className="text-xs text-[#2D8CFF] cursor-pointer"
                        >
                          {t("navigation.createMeeting")}
                        </Link>
                        <Separator />
                        <Link
                          to="/streams"
                          className="text-xs text-[#2D8CFF] cursor-pointer"
                        >
                          {t("navigation.startStreaming")}
                        </Link>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
              <Link to="/profile">
                <Avatar className="rounded-lg">
                  {userQuery.isSuccess && (
                    <AvatarImage src={userQuery.data?.user?.profile_photo_url} />
                  )}
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </Link>

            </>
          ) : (
            <>
              <Link to="/join" className={navigationMenuTriggerStyle()}>
                {t("navigation.joinMeetingRoom")}
              </Link>
              <Link to="/login" className={navigationMenuTriggerStyle()}>
                {t("navigation.signIn")}
              </Link>
              <Link to="/register">
                <Button className="bg-[#012E89] text-white rounded-full">
                  {t("navigation.signUpFree")}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle button */}
        <button
          className="rounded-md p-2 text-foreground transition-colors duration-300 hover:bg-accent hover:text-accent-foreground lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="space-y-4 border-t border-border bg-background px-5 py-4 text-foreground shadow-md transition-colors duration-300 lg:hidden">
          <Link className="block" to={`${process.env.REACT_APP_LANDING_URL}/Features`}>
            {t("navigation.solutions")}
          </Link>
          <Link className="block" to={`${process.env.REACT_APP_LANDING_URL}/Pricing`}>
            {t("navigation.plansPricing")}
          </Link>
          <Link className="block" to="/">
            {t("navigation.dashboard")}
          </Link>
          <Separator />
          {isAuthenticated ? (
            <>
              <Link className="block" to="/rooms">
                {t("navigation.schedule")}
              </Link>
              <Link className="block" to="/join">
                {t("navigation.join")}
              </Link>
              <Link className="block" to="/rooms">
                {t("navigation.createMeeting")}
              </Link>
              <Link className="block" to="/streams">
                {t("navigation.startStreaming")}
              </Link>
            </>
          ) : (
            <>
              <Link className="block" to="/join">
                {t("navigation.joinMeetingRoom")}
              </Link>
              <Link className="block" to="/login">
                {t("navigation.signIn")}
              </Link>
              <Link className="block" to="/register">
                <Button className="w-full bg-[#012E89] text-white rounded-full">
                  {t("navigation.signUpFree")}
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
