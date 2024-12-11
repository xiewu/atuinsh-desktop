// Returns a color in HSL format within a reasonable range of values
function getColor() {
  return [
    Math.floor(360 * Math.random()),
    Math.floor(25 + 70 * Math.random()),
    Math.floor(85 + 10 * Math.random()),
  ];
}

// BlockNote only supports hex colors for collaboration flags
function hslToHex([h, s, l]: number[]) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0"); // convert to Hex and prefix "0" if needed
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function randomColor() {
  return hslToHex(getColor());
}
