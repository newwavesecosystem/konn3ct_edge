import React from "react";
import { cn } from "../../../lib/utils";
import AnimatedKonn3ctLogo from "./AnimatedKonn3ctLogo";

const variantStyles = {
  crash: {
    badgeClass:
      "border-red-300/60 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-100",
    badgeText: "App Recovery",
    accentClass: "from-emerald-100 via-white to-red-100",
  },
  offline: {
    badgeClass:
      "border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100",
    badgeText: "Network State",
    accentClass: "from-emerald-100 via-white to-amber-100",
  },
};

const FullscreenFallbackShell = ({
  variant = "crash",
  title,
  description,
  details,
  actions,
}) => {
  const style = variantStyles[variant] ?? variantStyles.crash;

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-slate-950 p-4">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-95",
          style.accentClass
        )}
      />
      <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-emerald-500/25 blur-3xl" />
      <div className="absolute -right-10 bottom-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative flex min-h-[calc(100vh-2rem)] items-center justify-center">
        <article className="w-full max-w-2xl rounded-3xl border border-white/70 bg-white/90 p-6 shadow-2xl backdrop-blur sm:p-10">
          <div
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
              style.badgeClass
            )}
          >
            {style.badgeText}
          </div>

          <AnimatedKonn3ctLogo className="my-8" />

          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-base">
            {description}
          </p>

          {details ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {details}
            </p>
          ) : null}

          {actions}
        </article>
      </div>
    </section>
  );
};

export default FullscreenFallbackShell;
