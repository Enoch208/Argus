/**
 * SOURCE OF TRUTH: /landing_page/lib/icons.tsx
 *
 * Single icon import surface. STRICT RULE (CODE-RULES.md, UI-RULES.md):
 * components MUST NOT import from `@hugeicons/*` directly. Add any new icon
 * here so swaps and renames are one edit.
 */

import type { ComponentType, SVGProps } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Activity01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  BotIcon,
  Cancel01Icon,
  ConnectIcon,
  CpuIcon,
  EarthIcon,
  FileSearchIcon,
  FingerPrintIcon,
  FlashIcon,
  Github01Icon,
  Layers01Icon,
  MapPinIcon,
  Menu01Icon,
  Mic01Icon,
  RefreshIcon,
  SecurityIcon,
  Shield01Icon,
  SparklesIcon,
  SphereIcon,
  Tick02Icon,
  ViewIcon,
  ViewOffSlashIcon,
  VolumeHighIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

export type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

function wrap(glyph: IconSvgElement, strokeWidth = 1.4): Icon {
  return function WrappedIcon({ size = 18, strokeWidth: _ignore, ...rest }) {
    return (
      <HugeiconsIcon
        {...rest}
        icon={glyph}
        size={size}
        strokeWidth={strokeWidth}
      />
    );
  };
}

// --- Brand --------------------------------------------------------------
export const Apple: Icon = ({ size = 18, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path d="M17.05 12.53c-.03-3.05 2.5-4.51 2.61-4.58-1.42-2.07-3.62-2.35-4.4-2.38-1.87-.19-3.65 1.1-4.6 1.1-.95 0-2.42-1.07-3.98-1.04-2.05.03-3.94 1.19-5 3.03-2.13 3.7-.54 9.18 1.53 12.17 1.02 1.47 2.23 3.12 3.82 3.06 1.53-.06 2.11-.99 3.96-.99s2.37.99 3.98.96c1.64-.03 2.68-1.5 3.69-2.98 1.17-1.71 1.65-3.37 1.68-3.45-.04-.02-3.26-1.25-3.29-4.9ZM14.03 3.6C14.87 2.58 15.44 1.16 15.29 0c-1.21.05-2.67.81-3.54 1.82-.78.91-1.46 2.35-1.28 3.73 1.35.1 2.72-.69 3.56-1.95Z" />
  </svg>
);
export const Windows: Icon = ({ size = 18, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path d="M2.75 4.35 10.6 3.3v8.1H2.75V4.35Zm8.9-1.18 9.6-1.28v9.51h-9.6V3.17ZM2.75 12.55h7.85v8.15l-7.85-1.07v-7.08Zm8.9 0h9.6v9.56l-9.6-1.28v-8.28Z" />
  </svg>
);
export const Github = wrap(Github01Icon);

// --- UI controls --------------------------------------------------------
export const ArrowRight = wrap(ArrowRight01Icon);
export const ArrowUpRight = wrap(ArrowUpRight01Icon);
export const ArrowDown = wrap(ArrowDown01Icon);
export const Menu = wrap(Menu01Icon);
export const Tick = wrap(Tick02Icon, 2);
export const AlertCircle = wrap(AlertCircleIcon);
export const Cancel = wrap(Cancel01Icon, 2);
export const Shield = wrap(Shield01Icon);
export const ShieldStrong = wrap(SecurityIcon);

// --- Argus pipeline glyphs ---------------------------------------------
export const Bot = wrap(BotIcon);
export const Cpu = wrap(CpuIcon);
export const View = wrap(ViewIcon);
export const ViewOff = wrap(ViewOffSlashIcon);
export const FileSearch = wrap(FileSearchIcon);
export const FingerPrint = wrap(FingerPrintIcon);
export const Earth = wrap(EarthIcon);
export const Layers = wrap(Layers01Icon);
export const Mic = wrap(Mic01Icon);
export const Connect = wrap(ConnectIcon);
export const Sparkles = wrap(SparklesIcon);
export const VolumeHigh = wrap(VolumeHighIcon);
export const Wallet = wrap(Wallet01Icon);
export const Flash = wrap(FlashIcon);
export const MapPin = wrap(MapPinIcon);
export const Sphere = wrap(SphereIcon);
export const Activity = wrap(Activity01Icon);
export const Refresh = wrap(RefreshIcon);
