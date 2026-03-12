import { cva } from "class-variance-authority";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  JSX,
  PropsWithChildren,
  TextareaHTMLAttributes
} from "react";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-panel border px-4 py-2 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      intent: {
        primary:
          "border-signal-cyan bg-signal-cyan/10 text-signal-cyan hover:border-signal-cyan hover:bg-signal-cyan/25",
        secondary:
          "border-chrome-400/70 bg-chrome-600/40 text-chrome-50 hover:bg-chrome-500/60",
        ghost:
          "border-transparent bg-transparent text-chrome-200 hover:border-chrome-500/80 hover:bg-chrome-600/30",
        danger:
          "border-signal-red/70 bg-signal-red/10 text-signal-red hover:bg-signal-red/18"
      }
    },
    defaultVariants: {
      intent: "secondary"
    }
  }
);

export const Button = ({
  className,
  intent,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: "primary" | "secondary" | "ghost" | "danger";
}): JSX.Element => (
  <button className={cn(buttonVariants({ intent }), className)} {...buttonProps} />
);

export const Input = ({
  className,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement>): JSX.Element => (
  <input
    className={cn(
      "h-10 w-full rounded-panel border border-chrome-400/70 bg-chrome-700/80 px-4 text-sm text-chrome-50 outline-none transition focus:border-signal-cyan/70",
      className
    )}
    {...inputProps}
  />
);

export const Textarea = ({
  className,
  ...textareaProps
}: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element => (
  <textarea
    className={cn(
      "min-h-28 w-full rounded-panel border border-chrome-400/70 bg-chrome-700/80 px-4 py-3 text-sm text-chrome-50 outline-none transition focus:border-signal-cyan/70",
      className
    )}
    {...textareaProps}
  />
);

export const Panel = ({
  children,
  className
}: PropsWithChildren<{
  className?: string;
}>): JSX.Element => (
  <section
    className={cn(
      "rounded-sm border border-chrome-500/80 bg-chrome-700/85",
      className
    )}
  >
    {children}
  </section>
);

export const Label = ({
  children,
  className
}: PropsWithChildren<{
  className?: string;
}>): JSX.Element => (
  <span className={cn("text-xs font-semibold uppercase tracking-[0.28em] text-chrome-200", className)}>
    {children}
  </span>
);

export const Badge = ({
  children,
  tone = "default"
}: PropsWithChildren<{
  tone?: "default" | "success" | "warning" | "danger";
}>): JSX.Element => {
  const toneClassName =
    tone === "success"
      ? "border-signal-green/50 text-signal-green"
      : tone === "warning"
        ? "border-signal-orange/50 text-signal-orange"
        : tone === "danger"
          ? "border-signal-red/50 text-signal-red"
          : "border-chrome-400/60 text-chrome-100";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em]",
        toneClassName
      )}
    >
      {children}
    </span>
  );
};
