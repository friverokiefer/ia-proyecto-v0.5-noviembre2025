// frontend/src/components/InLineProgress.tsx
import React from "react";

type Props = {
  loading: boolean;
  percent: number; // 0 - 100
  steps?: Array<{ label: string; done?: boolean }>;
};

export function InlineProgress({ loading, percent, steps }: Props) {
  if (!loading) return null;

  return (
    <div className="mt-4 rounded-xl border bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Generando…</span>
        <span className="text-xs text-gray-500">
          {Math.round(percent)}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-2 bg-blue-600 transition-all"
          style={{ width: `${Math.max(5, Math.min(100, percent))}%` }}
        />
      </div>

      {steps && steps.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-1">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className={
                  "inline-flex h-4 w-4 items-center justify-center rounded-full border " +
                  (s.done
                    ? "bg-green-500 text-white border-green-500"
                    : "bg-gray-100 text-gray-500")
                }
              >
                {s.done ? "✓" : "•"}
              </span>
              <span className={s.done ? "text-gray-600" : "text-gray-500"}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
