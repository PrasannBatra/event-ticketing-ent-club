"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import EventCard from "@/components/EventCard";
import { toLocalInput } from "@/lib/format";
import type { EventT, NewQrInput } from "@/lib/types";

interface QrRow {
  id: number;
  label: string;
  upiId: string;
  file: File | null;
  preview: string | null;
}

function NewEvent() {
  const router = useRouter();
  const { createEvent } = useStore();
  const [f, setF] = useState({
    name: "", description: "", date: "", time: "", venue: "", price: "",
    salesOpen: toLocalInput(new Date()), salesClose: "",
  });
  const [poster, setPoster] = useState<string | undefined>();
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [qrRows, setQrRows] = useState<QrRow[]>([{ id: 1, label: "", upiId: "", file: null, preview: null }]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const onPoster = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setErrors({ ...errors, poster: "Choose an image under 3 MB." });
    setPosterFile(file);
    const r = new FileReader();
    r.onload = () => { setPoster(r.result as string); setErrors((x) => ({ ...x, poster: "" })); };
    r.readAsDataURL(file);
  };

  const addQrRow = () => {
    setQrRows((rows) => [...rows, { id: Date.now() + Math.random(), label: "", upiId: "", file: null, preview: null }]);
  };

  const updateQrRow = (id: number, field: keyof QrRow, value: string | File | null) => {
    setQrRows((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      if (field === "file" && value instanceof File) {
        if (value.size > 3 * 1024 * 1024) { setErrors((e) => ({ ...e, qr: "QR images must be under 3 MB." })); return r; }
        const preview = URL.createObjectURL(value);
        return { ...r, file: value, preview };
      }
      return { ...r, [field]: value };
    }));
  };

  const removeQrRow = (id: number) => {
    setQrRows((rows) => {
      const row = rows.find((r) => r.id === id);
      if (row?.preview) URL.revokeObjectURL(row.preview);
      return rows.filter((r) => r.id !== id);
    });
  };

  const priceNum = Number(f.price) || 0;

  const preview: EventT = useMemo(() => ({
    id: "preview", name: f.name || "Your event name", description: "", date: f.date || "2026-01-01", time: f.time || "19:00",
    venue: f.venue || "Venue", posterUrl: poster, posterTheme: (f.name || "x").length % 5, price: priceNum,
    salesOpen: "", salesClose: "", organiserId: "", createdAt: "",
  }), [f, poster, priceNum]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = "Give your event a name.";
    if (!f.description.trim()) er.description = "Add a short description so students know what to expect.";
    if (!f.date) er.date = "Pick a date.";
    if (!f.time) er.time = "Pick a start time.";
    if (!f.venue.trim()) er.venue = "Add the venue.";
    if (f.price === "" || Number(f.price) < 0) er.price = "Set a ticket price. Use 0 for a free event.";
    if (!f.salesOpen) er.salesOpen = "Choose when sales open.";
    if (!f.salesClose) er.salesClose = "Choose when sales close.";
    else if (f.salesOpen && new Date(f.salesClose) <= new Date(f.salesOpen)) er.salesClose = "Sales must close after they open.";

    // Validate QR rows: at least one must have a file or UPI ID when the event is paid
    const validQrs = qrRows.filter((r) => r.file || r.upiId.trim());
    if (priceNum > 0 && validQrs.length === 0) {
      er.qr = "Add at least one payment option (a QR code image or a UPI ID) for paid events.";
    }

    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const qrInputs: NewQrInput[] = validQrs.map((r) => ({
        label: r.label.trim(), upiId: r.upiId.trim() || undefined, file: r.file,
      }));
      const id = await createEvent({
        name: f.name.trim(), description: f.description.trim(), date: f.date, time: f.time, venue: f.venue.trim(),
        posterUrl: poster, price: priceNum,
        salesOpen: new Date(f.salesOpen).toISOString(), salesClose: new Date(f.salesClose).toISOString(),
      }, posterFile, qrInputs.length ? qrInputs : undefined);
      router.push(`/organiser/events/${id}`);
    } catch {
      setBusy(false);
      setErrors({ form: "We couldn't create the event. Check your connection and try again." });
    }
  };

  const Err = ({ k }: { k: string }) => (errors[k] ? <p id={`${k}-err`} className="mt-1.5 text-sm font-semibold text-bad-fg">{errors[k]}</p> : null);
  const aria = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-err` : undefined });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
      <form onSubmit={submit} noValidate className="space-y-10">
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">Create event</h1>
          <p className="mt-2 text-muted">Your event goes live as soon as you create it. There's no approval step.</p>
        </div>

        <fieldset className="space-y-5">
          <legend className="mb-1 text-2xl font-semibold">Event details</legend>
          <div><label className="field-label" htmlFor="name">Event name</label><input id="name" className="input" value={f.name} onChange={set("name")} {...aria("name")} /><Err k="name" /></div>
          <div><label className="field-label" htmlFor="description">Description</label><textarea id="description" rows={5} className="input" value={f.description} onChange={set("description")} {...aria("description")} /><Err k="description" /></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="date">Date</label><input id="date" type="date" className="input" value={f.date} onChange={set("date")} {...aria("date")} /><Err k="date" /></div>
            <div><label className="field-label" htmlFor="time">Start time</label><input id="time" type="time" className="input" value={f.time} onChange={set("time")} {...aria("time")} /><Err k="time" /></div>
          </div>
          <div><label className="field-label" htmlFor="venue">Venue</label><input id="venue" className="input" value={f.venue} onChange={set("venue")} {...aria("venue")} /><Err k="venue" /></div>
          <div>
            <span className="field-label">Poster</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-ultra/40 bg-card px-4 py-5 font-semibold text-ultra-dark hover:bg-ultra-soft">
              <ImagePlus className="h-5 w-5" aria-hidden />
              {poster ? "Change poster image" : "Upload a poster image"}
              <input type="file" accept="image/*" className="sr-only" onChange={onPoster} />
            </label>
            <p className="mt-1.5 text-sm text-muted">Portrait images work best (4:5). Without one, we'll generate artwork.</p>
            <Err k="poster" />
          </div>
        </fieldset>

        <fieldset className="space-y-5">
          <legend className="mb-1 text-2xl font-semibold">Tickets</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="price">Ticket price (₹)</label><input id="price" type="number" min={0} inputMode="numeric" className="input" value={f.price} onChange={set("price")} {...aria("price")} /><Err k="price" />
              <p className="mt-1.5 text-sm text-muted">Use 0 for a free event. Students pay this amount via UPI.</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="salesOpen">Sales open</label><input id="salesOpen" type="datetime-local" className="input" value={f.salesOpen} onChange={set("salesOpen")} {...aria("salesOpen")} /><Err k="salesOpen" /></div>
            <div><label className="field-label" htmlFor="salesClose">Sales close</label><input id="salesClose" type="datetime-local" className="input" value={f.salesClose} onChange={set("salesClose")} {...aria("salesClose")} /><Err k="salesClose" /></div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-2xl font-semibold">Payment options {priceNum > 0 && <span className="text-sm font-normal text-muted">(at least one required)</span>}</legend>
          <p className="text-sm text-muted">Add a UPI QR code image and/or a UPI ID so students can pay. You need at least one payment option for paid events. For free events, you can skip this.</p>

          {errors.qr && <p id="qr-err" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{errors.qr}</p>}

          {qrRows.map((row, idx) => (
            <div key={row.id} className="rounded-2xl bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted">Option {idx + 1}</span>
                <button type="button" onClick={() => removeQrRow(row.id)} className="flex items-center gap-1 text-sm text-muted hover:text-bad-fg" aria-label="Remove payment option">
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor={`qr-label-${row.id}`}>Label <span className="font-normal text-muted">(optional)</span></label>
                  <input id={`qr-label-${row.id}`} className="input" placeholder="e.g. Axis Bank UPI, GPay" value={row.label} onChange={(e) => updateQrRow(row.id, "label", e.target.value)} maxLength={60} />
                </div>
                <div>
                  <label className="field-label" htmlFor={`qr-upi-${row.id}`}>UPI ID <span className="font-normal text-muted">(optional)</span></label>
                  <input id={`qr-upi-${row.id}`} className="input" placeholder="e.g. club@upi" value={row.upiId} onChange={(e) => updateQrRow(row.id, "upiId", e.target.value)} maxLength={100} />
                </div>
              </div>
              <div className="mt-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-ultra/40 bg-paper px-4 py-4 text-sm font-semibold text-ultra-dark hover:bg-ultra-soft">
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  {row.file ? "Change QR image" : "Upload a QR code image (optional if UPI ID is added)"}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) updateQrRow(row.id, "file", file); }} />
                </label>
                {row.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.preview} alt="QR preview" className="mt-3 max-h-40 rounded-xl border border-line object-contain bg-white" />
                )}
              </div>
            </div>
          ))}

          <button type="button" onClick={addQrRow} className="btn btn-outline w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden /> Add payment option
          </button>
        </fieldset>

        {errors.form && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-fg">{errors.form}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full sm:w-auto">{busy ? "Creating…" : "Create event"}</button>
      </form>

      <aside className="hidden lg:block" aria-label="Preview">
        <div className="sticky top-24">
          <p className="mb-3 text-sm font-semibold text-muted">How students will see it</p>
          <EventCard event={preview} href="#" />
        </div>
      </aside>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <RequireRole role="organiser">
      <NewEvent />
    </RequireRole>
  );
}
