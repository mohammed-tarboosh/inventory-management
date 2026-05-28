export const fmtNum = (n: number | null | undefined, digits = 2) =>
  n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtInt = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString("en-US");

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "-";
  return dt.toISOString().slice(0, 10);
};

export const todayStr = () => new Date().toISOString().slice(0, 10);