export function formatDDMMYY(date) {
  if (!date) return "";

  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, "0");      // day with leading zero
  const month = String(d.getMonth() + 1).padStart(2, "0"); // month is 0-indexed
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}