export type AudioAsset = {
  id: string;
  src: string;
  text: string;
  language: "ar";
  speaker: string;
  license: string;
  source: string;
  verified: boolean;
};
/** Only bundled, explicitly verified recordings are eligible. Empty by default. */
export async function playArabic(
  text: string,
  rate = 0.8,
  id?: string,
): Promise<() => void> {
  if (id) {
    try {
      const r = await fetch(import.meta.env.BASE_URL + "audio/manifest.json");
      if (r.ok) {
        const m = await r.json();
        const asset: AudioAsset | undefined = m.recordings.find(
          (a: AudioAsset) =>
            a.id === id &&
            a.verified &&
            a.license &&
            a.source &&
            /^audio\/[a-zA-Z0-9_./-]+$/.test(a.src) &&
            !a.src.includes(".."),
        );
        if (asset) {
          const audio = new Audio(import.meta.env.BASE_URL + asset.src);
          audio.playbackRate = rate;
          await audio.play();
          return () => audio.pause();
        }
      }
    } catch {}
  }
  if (!("speechSynthesis" in window))
    throw Error("Speech synthesis unavailable");
  const voice = speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("ar"));
  if (!voice) throw Error("No Arabic voice installed");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[\u2066-\u2069]/g, ""));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  speechSynthesis.speak(u);
  return () => speechSynthesis.cancel();
}
