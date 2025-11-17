// frontend/src/components/NumberStepper.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 5,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={dec}
        aria-label="Disminuir"
      >
        <Minus size={16} />
      </Button>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || min))}
        className="w-20 text-center"
      />
      <Button
        type="button"
        variant="outline"
        onClick={inc}
        aria-label="Aumentar"
      >
        <Plus size={16} />
      </Button>
    </div>
  );
}
