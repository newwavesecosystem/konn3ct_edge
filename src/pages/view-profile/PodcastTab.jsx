import {
  CirclePause,
  CirclePlay,
  Menu,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { podcasts } from "./profileData";

const BRAND_GREEN = "#227451";

function PodcastTab({ currentPodcast }) {
  return (
    <div className="flex min-h-[520px] flex-col rounded-[20px] border border-border/60 bg-background/40">
      <div className="divide-y divide-border/60">
        {podcasts.map((podcast) => {
          const RowIcon = podcast.active ? CirclePause : CirclePlay;

          return (
            <div
              key={podcast.id}
              className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center gap-3 px-4 py-4 sm:px-5"
            >
              <button
                type="button"
                className="text-foreground/85"
                aria-label={podcast.active ? "Pause podcast" : "Play podcast"}
              >
                <RowIcon className="h-5 w-5 fill-current" />
              </button>

              <img
                src={podcast.image}
                alt={`${podcast.title} thumbnail`}
                className="h-10 w-10 rounded-[8px] object-cover"
              />

              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-foreground">
                  {podcast.title}
                </p>
                <p className="text-[13px] text-muted-foreground">{podcast.author}</p>
              </div>

              <p className="hidden text-[14px] text-muted-foreground sm:block">{podcast.views}</p>
              <p className="hidden text-[14px] text-muted-foreground sm:block">{podcast.duration}</p>
              <button type="button" aria-label="More options" className="text-muted-foreground">
                <Menu className="h-4 w-4 rotate-90" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-auto p-3 sm:p-4">
        <div className="rounded-[16px] border border-border/70 bg-background px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentPodcast.image}
                alt={`${currentPodcast.title} artwork`}
                className="h-12 w-12 rounded-[10px] object-cover"
              />
              <div>
                <p className="text-[15px] font-medium text-foreground">
                  {currentPodcast.title}
                </p>
                <p className="text-[13px] text-muted-foreground">{currentPodcast.author}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 text-muted-foreground">
              <button type="button" aria-label="Shuffle">
                <Shuffle className="h-[17px] w-[17px]" />
              </button>
              <button type="button" aria-label="Previous">
                <SkipBack className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                aria-label="Pause"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: BRAND_GREEN }}
              >
                <CirclePause className="h-5 w-5 fill-current" />
              </button>
              <button type="button" aria-label="Next">
                <SkipForward className="h-[18px] w-[18px]" />
              </button>
              <button type="button" aria-label="Repeat">
                <Repeat className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="flex items-center gap-3 lg:min-w-[255px]">
              <span className="text-[13px] text-foreground/80">03:41</span>
              <div className="h-[4px] flex-1 rounded-full bg-muted">
                <div
                  className="h-[4px] rounded-full"
                  style={{ width: "45%", backgroundColor: BRAND_GREEN }}
                />
              </div>
              <span className="text-[13px] text-muted-foreground">12:11</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PodcastTab;
