export function shortenText(text, maxLength) {
  if (typeof text !== "string") return "";
  if (text.length <= maxLength) return text;

  return text.slice(0, maxLength).trim() + "...";
}
