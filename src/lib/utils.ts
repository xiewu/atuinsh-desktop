import type { ClassValue } from "clsx";

import clsx from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const COMMON_UNITS = ["small", "medium", "large"];

/**
 * We need to extend the tailwind merge to include NextUI's custom classes.
 *
 * So we can use classes like `text-small` or `text-default-500` and override them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      opacity: ["disabled"],
      spacing: ["divider"],
      borderWidth: COMMON_UNITS,
      borderRadius: COMMON_UNITS,
    },
    classGroups: {
      shadow: [{ shadow: COMMON_UNITS }],
      "font-size": [{ text: ["tiny", ...COMMON_UNITS] }],
      "bg-image": ["bg-stripe-gradient"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// edge still uses the old one
export function getWeekInfo() {
  let locale = new Intl.Locale(navigator.language);

  // @ts-ignore
  if (locale.getWeekInfo) {
    // @ts-ignore
    return locale.getWeekInfo();
    // @ts-ignore
  } else if (locale.weekInfo) {
    // @ts-ignore
    return locale.weekInfo;
  }

  throw new Error("Could not fetch week info via new or old api");
}

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

export const generateColorSet = (
  names: Set<string>,
  isDarkMode: boolean = false,
): Map<string, string> => {
  const baseHues = [0, 60, 120, 180, 240, 300]; // Red, Yellow, Green, Cyan, Blue, Magenta
  const colorMap = new Map<string, string>();
  const nameArray = Array.from(names);

  const generateColor = (hue: number, index: number): string => {
    const saturation = isDarkMode ? 80 : 75;
    const lightness = isDarkMode
      ? 60 + (index % 3) * 10
      : 50 + (index % 3) * 10;
    return hslToHex({ h: hue, s: saturation, l: lightness });
  };

  // Generate initial colors
  nameArray.forEach((name, index) => {
    const hue = baseHues[index % baseHues.length];
    const color = generateColor(hue, index);
    colorMap.set(name, color);
  });

  // Adjust colors to maximize distinctiveness
  for (let i = 0; i < nameArray.length; i++) {
    const currentColor = hexToHsl(colorMap.get(nameArray[i])!);
    for (let j = i + 1; j < nameArray.length; j++) {
      const otherColor = hexToHsl(colorMap.get(nameArray[j])!);
      const hueDiff = Math.abs(currentColor.h - otherColor.h);

      if (hueDiff < 30 || hueDiff > 330) {
        // Colors are too similar, adjust one of them
        otherColor.h = (otherColor.h + 30) % 360;
        colorMap.set(nameArray[j], hslToHex(otherColor));
      }
    }
  }

  // Ensure consistent output for the same input
  const sortedNames = Array.from(names).sort();
  const finalColorMap = new Map<string, string>();
  sortedNames.forEach((name) => {
    finalColorMap.set(name, colorMap.get(name)!);
  });

  return finalColorMap;
};

// Color conversion functions
const hslToRgb = (hsl: HSL): RGB => {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const rgbToHex = (rgb: RGB): string => {
  const toHex = (c: number) => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

const hslToHex = (hsl: HSL): string => rgbToHex(hslToRgb(hsl));

const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToHsl = (rgb: RGB): HSL => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hexToHsl = (hex: string): HSL => rgbToHsl(hexToRgb(hex));
