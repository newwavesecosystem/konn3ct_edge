import React from "react";
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
import avatar from "../assets/avatar.png";
import { Separator } from "./ui/separator";
import useAuth from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/userApi";
import { Button } from "./ui/button";

const Navbar = () => {
  const { isAuthenticated } = useAuth();
  const userQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getUser,
    enabled: isAuthenticated,
  });
  return (
    <NavigationMenu className="px-5 py-3 flex fixed w-full top-0 shadow-md bg-white z-[100]">
      <Link to="/">
        <img src={logo} alt="Konne3ct logo" className="mb-3" />
      </Link>
      <NavigationMenuList className="flex">
        <NavigationMenuItem to="/">
          <Link className={navigationMenuTriggerStyle()}>Solutions</Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link className={navigationMenuTriggerStyle()}>Plans & Pricing</Link>
        </NavigationMenuItem>
      </NavigationMenuList>
      {isAuthenticated ? (
        <div className="ml-auto">
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link className={navigationMenuTriggerStyle()}>Schedule</Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link className={navigationMenuTriggerStyle()}>Join</Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Host</NavigationMenuTrigger>
              <NavigationMenuContent className="!w-[200px] rounded bg-[#FFF] shadow p-4 ">
                <div className="flex flex-col gap-y-5">
                  <a className="text-xs text-[#2D8CFF] cursor-pointer">
                    Create new meeting
                  </a>
                  <Separator />
                  <a className="text-xs text-[#2D8CFF] cursor-pointer">
                    Start streaming
                  </a>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <Avatar className="rounded-lg">
              {userQuery.isSuccess && (
                <AvatarImage src={userQuery.data.user.profile_photo_url} />
              )}
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </NavigationMenuList>
        </div>
      ) : (
        <div className="ml-auto">
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link to="/join" className={navigationMenuTriggerStyle()}>
                Join a Meeting Room
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link to="/login" className={navigationMenuTriggerStyle()}>
                Sign in
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link to="/register" className={navigationMenuTriggerStyle()}>
                <Button
                  variant="lg"
                  className={
                    navigationMenuTriggerStyle() +
                    " bg-[#012E89] text-white rounded-full"
                  }
                >
                  Sign up, It's Free
                </Button>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </div>
      )}
    </NavigationMenu>
  );
};

export default Navbar;
