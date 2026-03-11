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
    <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.id} type="button" variant="secondary" onClick={() => onAction(action)}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
