import clsx, { type ClassValue } from "clsx";

/** Tiny class-merge helper. We don't pull in tailwind-merge; the duplication
 * cost across this single landing page is negligible. */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
