import { NextResponse } from "next/server";
import { ApiError, authed, dbError, handler, isFile, requireRole } from "@/lib/server/api";
import { uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
const MAX_CSV_BYTES = 2 * 1024 * 1024;

// Upload a CSV bank/UPI statement for transaction matching.
// The CSV is parsed server-side: each row should contain a transaction reference (UTR/UPI txn ID).
// We extract the first column that looks like a transaction ID, or a column named "txn", "utr", "transaction id", "reference".
export const POST = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const eventId = uuid(params.id, "Event");
  const { data: event } = await ctx.sb.from("events").select("id").eq("id", eventId).eq("organiser_id", ctx.userId).maybeSingle();
  if (!event) throw new ApiError(404, "event_not_found", "That event doesn't exist, or it belongs to another organiser.");

  const form = await req.formData();
  const file = form.get("csv");
  if (!isFile(file) || file.size === 0) throw new ApiError(400, "no_csv", "Upload a CSV file.");
  if (file.size > MAX_CSV_BYTES) throw new ApiError(413, "csv_too_large", "The CSV must be under 2 MB.");
  const text = await file.text();
  if (!text.trim()) throw new ApiError(400, "empty_csv", "The CSV file is empty.");

  // Parse CSV: split into lines, find the transaction ID column
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new ApiError(400, "empty_csv", "The CSV needs a header row and at least one transaction.");

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { cells.push(cur); cur = ""; }
        else cur += c;
      }
    }
    cells.push(cur);
    return cells;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  // Find the txn ID column: look for common names
  const txnCol = headers.findIndex((h) =>
    /txn|utr|transaction.?id|reference|ref.?no|ref.?id|cheque|upi.?ref/i.test(h)
  );
  // Amount column
  const amtCol = headers.findIndex((h) => /amount|amt|value|credit|debit|deposit/i.test(h));

  const rows: { txn_id: string; amount: number | null; raw_line: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    // If we found a txn column, use it; otherwise use the first non-empty cell
    let txnId = "";
    if (txnCol >= 0 && cells[txnCol]) {
      txnId = cells[txnCol].trim();
    } else {
      // Fallback: first cell that looks like a long alphanumeric reference (12+ chars)
      txnId = cells.find((c) => c.trim().length >= 8)?.trim() ?? "";
    }
    if (!txnId) continue;
    let amount: number | null = null;
    if (amtCol >= 0 && cells[amtCol]) {
      const parsed = parseFloat(cells[amtCol].replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(parsed)) amount = parsed;
    }
    rows.push({ txn_id: txnId.slice(0, 60), amount, raw_line: lines[i].slice(0, 500) });
  }

  if (rows.length === 0) throw new ApiError(400, "no_txn", "We couldn't find any transaction IDs in the CSV. Make sure it has a column with UTR/transaction references.");

  // Clear existing records first, then insert new ones
  await ctx.sb.rpc("clear_transaction_records", { p_event_id: eventId }).catch(() => {});

  // Insert in batches of 100
  let imported = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map((r) => ({
      event_id: eventId, txn_id: r.txn_id, amount: r.amount, raw_line: r.raw_line, uploaded_by: ctx.userId,
    }));
    const { error } = await ctx.sb.from("transaction_records").insert(batch);
    if (error) throw dbError(error.message);
    imported += batch.length;
  }

  return NextResponse.json({ imported });
});
