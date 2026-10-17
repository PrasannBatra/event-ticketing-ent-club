import { ApiError, authed, handler, requireRole } from "@/lib/server/api";
import { toCsv, uuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

// CSV export of the attendee list, for Excel or Google Sheets
export const GET = handler(async (req, { params }) => {
  const ctx = await authed(req);
  requireRole(ctx, "organiser");
  const id = uuid(params.id, "Event");
  const { data: event } = await ctx.sb.from("events").select("name").eq("id", id).eq("organiser_id", ctx.userId).maybeSingle();
  if (!event) throw new ApiError(404, "event_not_found", "That event doesn't exist, or it belongs to another organiser.");
  const { data, error } = await ctx.sb.rpc("event_attendees", { p_event_id: id });
  if (error) throw new ApiError(500, "server_error", "Couldn't build the export.");

  type Row = { name: string; email: string; student_id: string; ticket_id: string; status: string; bought_at: string; checked_in_at: string | null };
  const rows = ((data ?? []) as Row[]).map((a) => [
    a.name, a.email, a.student_id, a.ticket_id, event.name, "Verified", a.bought_at,
    a.status === "used" ? "Checked in" : "Not checked in", a.checked_in_at ?? "",
  ]);
  const csv = toCsv([["Name", "Email", "Student ID", "Ticket ID", "Event", "Payment status", "Purchase time", "Check-in status", "Check-in time"], ...rows]);
  const file = String(event.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "attendees";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}-attendees.csv"` } });
});
