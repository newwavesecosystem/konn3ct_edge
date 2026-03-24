import React from "react";
import logo from "../../../assets/konn3ct_logo.png";
import { cn } from "../../../lib/utils";

const AnimatedKonn3ctLogo = ({ className }) => {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div className="absolute h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="absolute h-36 w-36 rounded-full border border-emerald-500/30 animate-ping [animation-duration:2.6s]" />
      <div className="absolute h-24 w-24 rounded-full border-2 border-emerald-400/35 animate-[spin_8s_linear_infinite]" />

      <div className="relative rounded-2xl bg-white/85 px-6 py-4 shadow-2xl backdrop-blur">
        <img src={logo} alt="Konn3ct logo" className="h-12 w-auto sm:h-14" />
      </div>
    </div>
  );
};

export default AnimatedKonn3ctLogo;
