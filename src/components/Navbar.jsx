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

const Navbar = () => {
  return (
    <NavigationMenu className="px-5 py-7 flex fixed w-full top-0 shadow-md bg-white z-[100]">
      <a href="/">
        <img src={logo} alt="Konne3ct logo" className="mb-3" />
      </a>
      <NavigationMenuList className="flex">
        <NavigationMenuItem>
          <a href="/" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Solutions
            </NavigationMenuLink>
          </a>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <a href="/" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Plans & Pricing
            </NavigationMenuLink>
          </a>
        </NavigationMenuItem>
      </NavigationMenuList>
      <div className="ml-auto">
        <NavigationMenuList>
          <NavigationMenuItem>
            <a href="/" legacyBehavior passHref>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                Schedule
              </NavigationMenuLink>
            </a>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <a href="/" legacyBehavior passHref>
              <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                Join
              </NavigationMenuLink>
            </a>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Host</NavigationMenuTrigger>
            <NavigationMenuContent className="!w-[200px] rounded bg-[#FFF] shadow p-4 ">
              <div className="flex flex-col gap-y-5">
                <a className="text-xs text-[#2D8CFF] cursor-pointer">
                  Create new meeting
                </a>
                <Separator/>
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
    </NavigationMenu>
  );
};

export default Navbar;
