import { useEffect, useRef } from "react";
import { localDay } from "./learning";
import { activeSeconds } from "./study-clock";
export function useStudyTime(
  active: boolean,
  data: Record<string, any>,
  put: (key: string, value: any) => void,
  onTick?: (seconds: number) => void,
) {
  const latest = useRef({ data, put, onTick });
  latest.current = { data, put, onTick };
  useEffect(() => {
    if (!active) return;
    let last = Date.now(),
      interaction = last,
      remainder = 0;
    const touch = () => (interaction = Date.now());
    const visibility = () => {
      last = Date.now();
      if (document.visibilityState === "visible") interaction = last;
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    window.addEventListener("scroll", touch, true);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    const timer = setInterval(() => {
      const now = Date.now(),
        delta = activeSeconds(
          now,
          last,
          interaction,
          document.visibilityState === "visible",
          document.hasFocus(),
        );
      last = now;
      if (!delta) return;
      remainder += delta;
      const seconds = Math.floor(remainder);
      if (!seconds) return;
      remainder -= seconds;
      const { data, put, onTick } = latest.current,
        today = localDay();
      put("study:" + today, {
        seconds: Math.min(
          86400,
          (data["study:" + today]?.seconds || 0) + seconds,
        ),
      });
      put("activity:" + today, true);
      onTick?.(seconds);
    }, 5000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("scroll", touch, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
    };
  }, [active]);
}
