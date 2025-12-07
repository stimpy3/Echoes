export function formatTime(date) {
  if (!date) return "";

  const time = new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  return time.toLowerCase(); //"9:48 pm"
}