"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { useStore } from "@/lib/store";
import RequireRole from "@/components/RequireRole";
import EventCard from "@/components/EventCard";
import { toLocalInput } from "@/lib/format";
import type { EventT } from "@/lib/types";

function NewEvent() {
  const router = useRouter();
  const { createEvent } = useStore();
  const [f, setF] = useState({
    name: "", description: "", date: "", time: "", venue: "", price: "", capacity: "",
    salesOpen: toLocalInput(new Date()), salesClose: "",
  });
  const [poster, setPoster] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const onPoster = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setErrors({ ...errors, poster: "Choose an image under 3 MB." });
    const r = new FileReader();
    // Production: upload to Supabase Storage and save the public URL instead of a data URL.
    r.onload = () => { setPoster(r.result as string); setErrors((x) => ({ ...x, poster: "" })); };
    r.readAsDataURL(file);
  };

  const preview: EventT = useMemo(() => ({
    id: "preview", name: f.name || "Your event name", description: "", date: f.date || "2026-01-01", time: f.time || "19:00",
    venue: f.venue || "Venue", posterUrl: poster, posterTheme: (f.name || "x").length % 5, price: Number(f.price) || 0,
    salesOpen: "", salesClose: "", organiserId: "", createdAt: "",
  }), [f, poster]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = "Give your event a name.";
    if (!f.description.trim()) er.description = "Add a short description so students know what to expect.";
    if (!f.date) er.date = "Pick a date.";
    if (!f.time) er.time = "Pick a start time.";
    if (!f.venue.trim()) er.venue = "Add the venue.";
    if (f.price === "" || Number(f.price) < 0) er.price = "Set a ticket price. Use 0 for a free event.";
    if (f.capacity !== "" && (!Number.isInteger(Number(f.capacity)) || Number(f.capacity) < 1)) er.capacity = "Capacity must be a whole number, or leave it blank.";
    if (!f.salesOpen) er.salesOpen = "Choose when sales open.";
    if (!f.salesClose) er.salesClose = "Choose when sales close.";
    else if (f.salesOpen && new Date(f.salesClose) <= new Date(f.salesOpen)) er.salesClose = "Sales must close after they open.";
    setErrors(er);
    if (Object.keys(er).length) return;
    const id = createEvent({
      name: f.name.trim(), description: f.description.trim(), date: f.date, time: f.time, venue: f.venue.trim(),
      posterUrl: poster, price: Number(f.price), capacity: f.capacity === "" ? undefined : Number(f.capacity),
      salesOpen: new Date(f.salesOpen).toISOString(), salesClose: new Date(f.salesClose).toISOString(),
    });
    router.push(`/organiser/events/${id}`);
  };

  const Err = ({ k }: { k: string }) => (errors[k] ? <p id={`${k}-err`} className="mt-1.5 text-sm font-semibold text-bad">{errors[k]}</p> : null);
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
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-ultra/40 bg-white px-4 py-5 font-semibold text-ultra-dark hover:bg-ultra-soft">
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
            <div><label className="field-label" htmlFor="price">Ticket price (₹)</label><input id="price" type="number" min={0} inputMode="numeric" className="input" value={f.price} onChange={set("price")} {...aria("price")} /><Err k="price" /></div>
            <div>
              <label className="field-label" htmlFor="capacity">Total capacity <span className="font-normal text-muted">(optional)</span></label>
              <input id="capacity" type="number" min={1} inputMode="numeric" className="input" value={f.capacity} onChange={set("capacity")} {...aria("capacity")} />
              <p className="mt-1.5 text-sm text-muted">Only you can see this. Sales stop when it's reached.</p>
              <Err k="capacity" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="salesOpen">Sales open</label><input id="salesOpen" type="datetime-local" className="input" value={f.salesOpen} onChange={set("salesOpen")} {...aria("salesOpen")} /><Err k="salesOpen" /></div>
            <div><label className="field-label" htmlFor="salesClose">Sales close</label><input id="salesClose" type="datetime-local" className="input" value={f.salesClose} onChange={set("salesClose")} {...aria("salesClose")} /><Err k="salesClose" /></div>
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto">Create event</button>
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
