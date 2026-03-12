import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...classNames: Array<string | false | null | undefined>): string =>
  twMerge(clsx(classNames));
