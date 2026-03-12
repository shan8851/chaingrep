import { Check, Copy } from "lucide-react";

import type { ButtonHTMLAttributes, JSX } from "react";

import { cn } from "../lib/utils";

type CopyIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  copied: boolean;
  label: string;
};

export const CopyIconButton = ({
  className,
  copied,
  label,
  ...buttonProps
}: CopyIconButtonProps): JSX.Element => (
  <button
    aria-label={copied ? `${label} copied` : `Copy ${label}`}
    className={cn(
      "inline-flex size-8 items-center justify-center rounded-panel border border-chrome-500/80 bg-chrome-800 text-chrome-200 transition hover:border-signal-cyan/70 hover:text-signal-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan/60",
      copied && "border-signal-green/60 text-signal-green",
      className
    )}
    title={copied ? `${label} copied` : `Copy ${label}`}
    type="button"
    {...buttonProps}
  >
    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
  </button>
);
