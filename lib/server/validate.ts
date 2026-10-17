// Pure input checks for the API routes. No framework imports, so it is easy to unit test.

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function text(v: unknown, field: string, min: number, max: number): string {
  if (typeof v !== "string") throw new ValidationError(field, `${field} is required.`);
  const s = v.trim();
  if (s.length < min) throw new ValidationError(field, `${field} is required.`);
  if (s.length > max) throw new ValidationError(field, `${field} must be at most ${max} characters.`);
  return s;
}

export function uuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new ValidationError(field, `${field} is not valid.`);
  return v;
}

/** Looks at the first bytes of the file, so a renamed .exe can't pass as an image. */
export function sniffImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 7 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length > 11 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export interface EventInput {
  name: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  price: number;
  capacity: number | null;
  salesOpen: string;
  salesClose: string;
}

export function parseEventInput(get: (key: string) => unknown): EventInput {
  const name = text(get("name"), "Name", 1, 120);
  const description = text(get("description"), "Description", 1, 5000);
  const venue = text(get("venue"), "Venue", 1, 160);

  const date = text(get("date"), "Date", 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + "T00:00:00Z").getTime())) throw new ValidationError("date", "Date is not valid.");
  const time = text(get("time"), "Time", 5, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ValidationError("time", "Time is not valid.");

  const price = Number(get("price"));
  if (get("price") === "" || get("price") == null || !Number.isFinite(price) || price < 0 || price > 100000) {
    throw new ValidationError("price", "Price must be a number from 0 to 100000.");
  }

  const capRaw = get("capacity");
  let capacity: number | null = null;
  if (capRaw !== "" && capRaw != null) {
    capacity = Number(capRaw);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) throw new ValidationError("capacity", "Capacity must be a whole number, or left blank.");
  }

  const open = new Date(String(get("salesOpen")));
  const close = new Date(String(get("salesClose")));
  if (Number.isNaN(open.getTime())) throw new ValidationError("salesOpen", "Sales open time is not valid.");
  if (Number.isNaN(close.getTime())) throw new ValidationError("salesClose", "Sales close time is not valid.");
  if (close <= open) throw new ValidationError("salesClose", "Sales must close after they open.");

  return { name, description, date, time, venue, price, capacity, salesOpen: open.toISOString(), salesClose: close.toISOString() };
}

/** CSV cell with quoting, and a guard so Excel never runs a student's name as a formula. */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
