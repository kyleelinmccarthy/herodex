"use client";

import { useEffect, useState } from "react";
import { currentTimeOfDay, localDateOf } from "@/lib/utils/schedule-days";

/**
 * Corrects a server-rendered date/time against the browser's real local
 * clock. First render returns the server values verbatim (nothing
 * browser-dependent is read during render, so there's no hydration
 * mismatch); a post-mount effect then reads the browser's actual Date and
 * corrects both values, re-syncing every minute so "current vs upcoming"
 * status advances without a page refresh. `dateChanged` flags the rare
 * midnight-boundary case where the browser's calendar date no longer
 * matches what the server rendered.
 */
export function useBrowserToday(serverDate: string, serverTime: string) {
  const [state, setState] = useState({ date: serverDate, time: serverTime, dateChanged: false });

  useEffect(() => {
    function sync() {
      const date = localDateOf(new Date());
      setState({ date, time: currentTimeOfDay(), dateChanged: date !== serverDate });
    }
    sync();
    const id = setInterval(sync, 60_000);
    return () => clearInterval(id);
  }, [serverDate]);

  return state;
}
