import { CircleCheck } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../lib/utils";

const SideDetail = ({ className }) => {
  const { t } = useTranslation();
  const features = t("auth.sideDetail.features", { returnObjects: true });

  return (
    <div
      className={cn("mb-10 flex flex-1 flex-col gap-y-6 font-medium", className)}
    >
      {(Array.isArray(features) ? features : []).map((message, id) => (
        <div key={id} className="flex gap-x-2 items-center">
          <CircleCheck className="h-[20px] w-[20px]" />
          <p className="text-[#0A2540] dark:text-white">{message}</p>
        </div>
      ))}
    </div>
  );
};

export default SideDetail;
