import { Spinner } from "@keiri/ui/components/spinner";

import { Button, cn } from "./_adapter";
import type { Action } from "./Schema";
import { useActionButtons } from "./UseActionButtons";

export interface ActionButtonsProps {
  actions: Action[];
  onAction: (actionId: string) => void | Promise<void>;
  onBeforeAction?: (actionId: string) => boolean | Promise<boolean>;
  confirmTimeout?: number;
  align?: "left" | "center" | "right";
  className?: string;
}

export function ActionButtons({
  actions,
  onAction,
  onBeforeAction,
  confirmTimeout = 3000,
  align = "right",
  className,
}: ActionButtonsProps) {
  const { actions: resolvedActions, runAction } = useActionButtons({
    actions,
    onAction,
    onBeforeAction,
    confirmTimeout,
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        "@sm/actions:flex-row @sm/actions:flex-wrap @sm/actions:items-center @sm/actions:gap-2",
        align === "left" && "@sm/actions:justify-start",
        align === "center" && "@sm/actions:justify-center",
        align === "right" && "@sm/actions:justify-end",
        className,
      )}
    >
      {resolvedActions.map((action) => {
        const label = action.currentLabel;
        const variant = action.variant || "default";

        return (
          <Button
            key={action.id}
            variant={variant}
            onClick={() => runAction(action.id)}
            disabled={action.isDisabled}
            className={cn(
              "rounded-full px-4!",
              "justify-center",
              "min-h-11 w-full text-base",
              "@sm/actions:min-h-0 @sm/actions:w-auto @sm/actions:px-3 @sm/actions:py-2 @sm/actions:text-sm",
              action.isConfirming && "ring-destructive ring-2 ring-offset-2 motion-safe:animate-pulse",
            )}
            aria-label={action.shortcut ? `${label} (${action.shortcut})` : label}
          >
            {action.isLoading && <Spinner className="mr-2 size-4" />}
            {action.icon && !action.isLoading && <span className="mr-2">{action.icon}</span>}
            {label}
            {action.shortcut && !action.isLoading && (
              <kbd className="border-border bg-muted ml-2.5 hidden rounded-lg border px-2 py-0.5 font-mono text-xs font-medium sm:inline-block">
                {action.shortcut}
              </kbd>
            )}
          </Button>
        );
      })}
    </div>
  );
}
