import { profileData } from "./profileData";

function AboutTab() {
  return (
    <div className="min-h-[190px] rounded-[20px] border border-border/60 bg-background/40 px-4 py-5 sm:px-5 sm:py-6 md:min-h-[380px] md:px-4 md:py-3">
      <div className="max-w-[860px] space-y-5 text-left text-[17px] leading-[1.45] text-foreground sm:text-[18px]">
        <p className="whitespace-pre-line">
          {profileData.about[0]}
          {"\n"}
          {profileData.about[1]}
        </p>
        <p>{profileData.about[2]}</p>
        <p>{profileData.about[3]}</p>
        <p>{profileData.about[4]}</p>
      </div>
    </div>
  );
}

export default AboutTab;
