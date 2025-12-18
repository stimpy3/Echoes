export function getHexFromUserId(userId) {
  if (!userId || typeof userId !== "string") return "#8400ffff"; // fallback

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Normalize to 0–1
  const normalized = (hash % 360) / 360;
  let hue = Math.floor(normalized * 360);

  // Avoid green range 90–150
  if (hue >= 90 && hue <= 150) {
    hue = (hue + 60) % 360; // shift away from green
  }

  const saturation = 90; // high for neon
  const lightness = 85;  // medium-high to pop

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

