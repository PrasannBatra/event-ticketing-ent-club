import type { EventT, Order, Ticket, User } from "./types";

export interface DB {
  users: User[];
  events: EventT[];
  orders: Order[];
  tickets: Ticket[];
  currentUserId: string | null;
}

export const DEMO_STUDENT_ID = "stu-demo";
export const DEMO_ORGANISER_ID = "org-demo";

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Aarav", "Ananya", "Vihaan", "Diya", "Arjun", "Meera", "Kabir", "Saanvi", "Rohan", "Ira", "Dev", "Tara", "Neil", "Anika", "Yash", "Myra", "Reyansh", "Kiara", "Advait", "Zoya", "Shaurya", "Navya", "Veer", "Riya"];
const LAST = ["Sharma", "Verma", "Gupta", "Mehta", "Kapoor", "Singh", "Bhatia", "Malhotra", "Chopra", "Rao", "Nair", "Iyer", "Khanna", "Sethi", "Bansal", "Arora", "Joshi", "Das", "Ghosh", "Saxena"];
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function buildSeed(now = new Date()): DB {
  const rng = mulberry32(2026);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const rid = (len: number) => Array.from({ length: len }, () => ALPHA[Math.floor(rng() * ALPHA.length)]).join("");

  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();

  const users: User[] = [
    { id: DEMO_STUDENT_ID, name: "Ishaan Verma", email: "ishaan.verma_ug2026@ashoka.edu.in", studentId: "AU2026-1042", role: "student", createdAt: hoursFromNow(-900) },
    { id: DEMO_ORGANISER_ID, name: "Kabir Mehta", email: "kabir.mehta_ug2025@ashoka.edu.in", studentId: "AU2025-0388", role: "organiser", createdAt: hoursFromNow(-1200) },
  ];

  const seen = new Set(users.map((u) => u.email));
  const pool: User[] = [];
  while (pool.length < 230) {
    const f = pick(FIRST);
    const l = pick(LAST);
    const yr = 2025 + Math.floor(rng() * 4);
    const email = `${f}.${l}_ug${yr}@ashoka.edu.in`.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    pool.push({
      id: "stu-" + rid(6),
      name: `${f} ${l}`,
      email,
      studentId: `AU${yr}-${String(Math.floor(rng() * 9000) + 1000)}`,
      role: "student",
      createdAt: hoursFromNow(-Math.floor(rng() * 800)),
    });
  }
  users.push(...pool);

  const mk = (
    id: string, name: string, description: string, offset: number, time: string, venue: string,
    price: number, capacity: number | undefined, openH: number, closeH: number, theme: number,
  ): EventT => ({
    id, name, description, date: day(offset), time, venue, posterTheme: theme, price, capacity,
    salesOpen: hoursFromNow(openH), salesClose: hoursFromNow(closeH),
    organiserId: DEMO_ORGANISER_ID, createdAt: hoursFromNow(openH - 24),
  });

  const events: EventT[] = [
    mk("moonlight-mela", "Moonlight Mela: Headliner Night",
      "The big one. A full evening on the Main Lawns with a headlining act, two openers and food stalls running until midnight.\n\nGates open at 6:30 PM. Carry your QR ticket on your phone with the brightness turned up. One ticket admits one person, and each ticket can be scanned only once.",
      12, "19:30", "Main Lawns", 499, 300, -144, 12 * 24 + 4, 0),
    mk("open-mic-cafe", "Open Mic Cafe",
      "Songs, poetry, stand-up and the occasional experiment. Sign up at the door to perform or just come to listen. Chai and snacks available at the counter.",
      0, "18:00", "Cafe Quad", 99, undefined, -96, 10, 1),
    mk("founders-pitch-night", "Founders' Pitch Night",
      "Six student teams pitch to a panel of alumni founders and investors. Q&A after each pitch, networking over snacks at the end.",
      18, "17:00", "Lecture Theatre 2", 149, 120, -72, 17 * 24, 2),
    mk("standup-evening", "Stand-up Evening",
      "An hour and a half of stand-up from three touring comics and a student opener. Seating is first come, first served.",
      8, "19:00", "Auditorium", 249, 80, -200, 8 * 24, 3),
    mk("winter-fest-dance-night", "Winter Fest Dance Night",
      "The first night of Winter Fest. DJs, a dance floor under the lights and a late-night food truck.",
      30, "20:00", "Mess Lawns", 699, 400, 6 * 24, 29 * 24, 4),
  ];

  const sold: Record<string, number> = { "moonlight-mela": 187, "open-mic-cafe": 46, "founders-pitch-night": 31, "standup-evening": 80, "winter-fest-dance-night": 0 };
  const checkedIn: Record<string, number> = { "open-mic-cafe": 28 };

  const orders: Order[] = [];
  const tickets: Ticket[] = [];

  for (const ev of events) {
    const n = sold[ev.id];
    const buyers = [...pool].sort(() => rng() - 0.5).slice(0, ev.id === "founders-pitch-night" ? n - 1 : n);
    if (ev.id === "founders-pitch-night") buyers.push(users[0]);
    const open = new Date(ev.salesOpen).getTime();
    buyers.forEach((u, i) => {
      const at = new Date(open + rng() * Math.max(now.getTime() - open, 3600_000)).toISOString();
      const orderId = "ord_" + rid(8);
      const t: Ticket = {
        id: "TKT-" + rid(5), orderId, userId: u.id, eventId: ev.id,
        token: rid(28), status: "active", createdAt: at,
      };
      if (i < (checkedIn[ev.id] ?? 0)) {
        t.status = "used";
        t.checkedInAt = new Date(now.getTime() - rng() * 40 * 60_000).toISOString();
        t.checkedInBy = DEMO_ORGANISER_ID;
      }
      orders.push({ id: orderId, userId: u.id, eventId: ev.id, amount: ev.price, paymentId: "pay_" + rid(10), paymentStatus: "paid", createdAt: at });
      tickets.push(t);
    });
  }

  return { users, events, orders, tickets, currentUserId: null };
}
