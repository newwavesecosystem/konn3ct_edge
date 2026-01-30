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

const Navbar = () => {
  const { isAuthenticated } = useAuth();
  const userQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
    enabled: isAuthenticated,
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-[100] bg-white shadow-md">
      <div className="flex items-center justify-between px-5 py-3">
        {/* Logo */}
        <Link to="/">
          <img src={logo} alt="Konne3ct logo" className="h-8" />
        </Link>

        {/* Desktop menu */}
        <NavigationMenu className="hidden md:flex ml-10">
          <NavigationMenuList className="flex space-x-6">
            <NavigationMenuItem>
              <Link className={navigationMenuTriggerStyle()} to={`${process.env.REACT_APP_LANDING_URL}/Features`}>Solutions</Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link className={navigationMenuTriggerStyle()} to={`${process.env.REACT_APP_LANDING_URL}/Pricing`}>
                Plans & Pricing
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link className={navigationMenuTriggerStyle()} to="/">
                Dashboard
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right side (auth or guest) */}
        <div className="hidden md:flex ml-auto items-center gap-6">
          {isAuthenticated ? (
            <>
              <Link className={navigationMenuTriggerStyle()} to="/rooms">
                Schedule
              </Link>
              <Link className={navigationMenuTriggerStyle()} to="/join">
                Join
              </Link>
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Host</NavigationMenuTrigger>
                    <NavigationMenuContent className="!w-[200px] rounded bg-[#FFF] shadow p-4 ">
                      <div className="flex flex-col gap-y-5">
                        <Link
                          to="/rooms"
                          className="text-xs text-[#2D8CFF] cursor-pointer"
                        >
                          Create new meeting
                        </Link>
                        <Separator />
                        <Link
                          to="/streams"
                          className="text-xs text-[#2D8CFF] cursor-pointer"
                        >
                          Start streaming
                        </Link>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
              <Link to="/profile">
                <Avatar className="rounded-lg">
                  {userQuery.isSuccess && (
                    <AvatarImage src={userQuery.data.user.profile_photo_url} />
                  )}
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </Link>

            </>
          ) : (
            <>
              <Link to="/join" className={navigationMenuTriggerStyle()}>
                Join a Meeting Room
              </Link>
              <Link to="/login" className={navigationMenuTriggerStyle()}>
                Sign in
              </Link>
              <Link to="/register">
                <Button className="bg-[#012E89] text-white rounded-full">
                  Sign up, It's Free
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white shadow-md border-t px-5 py-4 space-y-4">
          <Link className="block" to={`${process.env.REACT_APP_LANDING_URL}/Features`}>
            Solutions
          </Link>
          <Link className="block" to={`${process.env.REACT_APP_LANDING_URL}/Pricing`}>
            Plans & Pricing
          </Link>
          <Link className="block" to="/">
            Dashboard
          </Link>
          <Separator />
          {isAuthenticated ? (
            <>
              <Link className="block" to="/rooms">
                Schedule
              </Link>
              <Link className="block" to="/join">
                Join
              </Link>
              <Link className="block" to="/rooms">
                Create new meeting
              </Link>
              <Link className="block" to="/streams">
                Start streaming
              </Link>
            </>
          ) : (
            <>
              <Link className="block" to="/join">
                Join a Meeting Room
              </Link>
              <Link className="block" to="/login">
                Sign in
              </Link>
              <Link className="block" to="/register">
                <Button className="w-full bg-[#012E89] text-white rounded-full">
                  Sign up, It's Free
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
