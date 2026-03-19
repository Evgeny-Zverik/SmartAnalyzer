"use client";

import { Button } from "@/components/ui/Button";
import type { PluginAction } from "@/lib/plugins/types";

type PluginToolbarProps = {
  actions: PluginAction[];
  onAction: (action: PluginAction) => void;
};

export function PluginToolbar({ actions, onAction }: PluginToolbarProps) {
  if (actions.length === 0) return null;
  return (
    <div className="rounded-[26px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#f7f8fa)] p-3 shadow-[0_14px_44px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="secondary"
            className="rounded-xl border-zinc-300 bg-zinc-50 hover:bg-white"
            onClick={() => onAction(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
