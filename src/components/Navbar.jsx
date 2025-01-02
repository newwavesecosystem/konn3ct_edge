import React from "react";
import logo from "../assets/konn3ct_logo.png";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "../components/ui/navigation-menu";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import avatar from "../assets/avatar.png";
import { Separator } from "./ui/separator";
import useAuth from "../hooks/useAuth";

const Navbar = () => {
  const { isAuthenticated } = useAuth();
  return (
    <NavigationMenu className="px-5 py-7 flex fixed w-full top-0 shadow-md bg-white z-[100]">
      <a href="/">
        <img src={logo} alt="Konne3ct logo" className="mb-3" />
      </a>
      <NavigationMenuList className="flex">
        <NavigationMenuItem href="/">
          <NavigationMenuLink className={navigationMenuTriggerStyle()}>
            Solutions
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()}>
            Plans & Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
      {isAuthenticated ? (
        <div className="ml-auto">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                Schedule
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                Join
              </NavigationMenuLink>
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
              <AvatarImage src={avatar} />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </NavigationMenuList>
        </div>
      ) : (
        <div className="ml-auto">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink
                href="/login"
                className={navigationMenuTriggerStyle()}
              >
                Login
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                href="/register"
                className={navigationMenuTriggerStyle()}
              >
                Register
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </div>
      )}
    </NavigationMenu>
  );
};

export default Navbar;
