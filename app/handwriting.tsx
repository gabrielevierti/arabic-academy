import React, { useRef, useState } from "react";
import { useLanguage } from "../lib/i18n";
export default function Handwriting({ letter }: { letter: string }) {
  const en = useLanguage() === "en",
    t = (a: string, b: string) => (en ? b : a),
    [paths, setPaths] = useState<string[]>([]),
    [overlay, setOverlay] = useState(true),
    drawing = useRef(false),
    svg = useRef<SVGSVGElement>(null);
  function point(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return `${((e.clientX - r.left) * 400) / r.width},${((e.clientY - r.top) * 240) / r.height}`;
  }
  return (
    <details className="panel spaced">
      <summary>{t("Prova a scrivere", "Try handwriting")}</summary>
      <p>
        {t(
          "Confronto manuale, senza valutazione automatica o ordine dei tratti presunto. Usa un dito, il mouse o una penna.",
          "Manual comparison, with no automatic grade or assumed stroke order. Use a finger, mouse or pen.",
        )}
      </p>
      <svg
        ref={svg}
        viewBox="0 0 400 240"
        className="writing-pad"
        role="img"
        aria-label={t("Area per scrivere a mano", "Handwriting area")}
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setPaths((p) => [...p, "M" + point(e)]);
        }}
        onPointerMove={(e) => {
          if (drawing.current) {
            const pos = point(e);
            setPaths((p) => [...p.slice(0, -1), p[p.length - 1] + " L" + pos]);
          }
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerCancel={() => (drawing.current = false)}
      >
        {overlay && (
          <text
            x="200"
            y="172"
            textAnchor="middle"
            fontSize="160"
            opacity=".15"
            lang="ar"
          >
            {letter}
          </text>
        )}
        <path d="M10 185H390" stroke="#bbc8be" strokeDasharray="5 5" />
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#173f3d"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="row">
        <button className="secondary" onClick={() => setPaths([])}>
          {t("Cancella e riprova", "Clear and retry")}
        </button>
        <button
          className="secondary"
          aria-pressed={overlay}
          onClick={() => setOverlay(!overlay)}
        >
          {t("Modello di riferimento", "Reference overlay")}
        </button>
      </div>
    </details>
  );
}
