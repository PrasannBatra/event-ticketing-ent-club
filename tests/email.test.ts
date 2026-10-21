import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { buildRejectionMessage, buildTicketMessage, clock, esc, longDate } from "../lib/server/email.ts";

const t = nodemailer.createTransport({ jsonTransport: true }); // builds the email without sending it

test("ticket email has the QR as an inline PNG and the right details", async () => {
  const msg = await buildTicketMessage({ name: "Ishaan Verma", email: "i@ashoka.edu.in", ticketId: "TKT-ABC123", token: "a".repeat(48), eventName: "Moonlight Mela", eventDate: "2026-10-24", eventTime: "19:30:00", venue: "Main Lawns", siteUrl: "https://x.app" });
  const out = JSON.parse((await t.sendMail({ from: "a@b.c", ...msg })).message);
  assert.equal(out.to[0].address, "i@ashoka.edu.in");
  assert.match(out.subject, /Moonlight Mela/);
  assert.match(out.html, /cid:ticketqr/);
  assert.match(out.html, /7:30 PM/);
  assert.match(out.html, /Saturday, 24 October 2026/);
  assert.equal(out.attachments[0].cid, "ticketqr");
  assert.ok(out.attachments[0].content.length > 200, "QR image present");
  assert.ok(!out.html.includes("a".repeat(48)), "the secret ticket code is not printed in the email text");
});

test("names are HTML-escaped so a student can't inject markup", async () => {
  const msg = await buildTicketMessage({ name: '<img src=x onerror=alert(1)>', email: "i@ashoka.edu.in", ticketId: "T", token: "tok", eventName: "A & B", eventDate: "2026-10-24", eventTime: "09:05", venue: "<b>", });
  assert.ok(!String(msg.html).includes("<img src=x"));
  assert.match(String(msg.html), /A &amp; B/);
  assert.equal(esc(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
});

test("rejection email carries the reason and no QR", () => {
  const msg = buildRejectionMessage({ name: "Stu", email: "s@ashoka.edu.in", eventName: "Show", eventId: "e1", reason: "amount doesn't match", siteUrl: "https://x.app" });
  assert.match(String(msg.html), /amount doesn&#39;t match/);
  assert.match(String(msg.html), /\/events\/e1/);
  assert.equal(msg.attachments, undefined);
});

test("date and time formatting", () => {
  assert.equal(clock("00:15"), "12:15 AM");
  assert.equal(clock("12:00:00"), "12:00 PM");
  assert.match(longDate("2026-01-01"), /Thursday, 1 January 2026/);
});
