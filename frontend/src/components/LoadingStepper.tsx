// frontend/src/components/LoadingStepper.tsx
import React from "react";
import { cn } from "@/lib/utils";

const steps = [
  "Preparando variantes de texto",
  "Generando héroes con IA",
  "Normalizando a 1200×630",
  "Armando respuestas",
];

export function LoadingStepper({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const activeIdx =
    clamped < 25 ? 0 : clamped < 55 ? 1 : clamped < 85 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/10 backdrop-blur-sm">
      <div className="w-[min(560px,92vw)] space-y-4 rounded-2xl border bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            Generando variantes…
          </h3>
          <span className="text-sm text-gray-500">{clamped}%</span>
        </div>

        {/* barra progreso */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-brand transition-[width] duration-300"
            style={{ width: `${clamped}%` }}
          />
        </div>

        {/* pasos */}
        <ol className="grid grid-cols-2 gap-2 text-sm">
          {steps.map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-md border px-3 py-2",
                i < activeIdx &&
                  "border-green-200 bg-green-50 text-green-700",
                i === activeIdx &&
                  "border-brand/30 bg-brand/10 text-brand",
                i > activeIdx &&
                  "border-gray-200 bg-gray-50 text-gray-600"
              )}
            >
              {i < activeIdx ? "✅" : i === activeIdx ? "⏳" : "•"}{" "}
              <span className="align-middle">{s}</span>
            </li>
          ))}
        </ol>

        <p className="text-xs text-gray-500">
          Consejo: puedes seguir escribiendo feedback mientras generamos
          las imágenes.
        </p>
      </div>
    </div>
  );
}
