import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import QRCode from "qrcode";

// Emails the student's ticket (with its QR code) after an organiser approves the payment screenshot,
// and the reason if it is rejected. Uses any SMTP account (a Gmail app password works).

export interface TicketMail {
  name: string;
  email: string;
  ticketId: string;
  token: string;
  eventName: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string; // HH:mm or HH:mm:ss
  venue: string;
  siteUrl?: string;
}

export interface RejectionMail {
  name: string;
  email: string;
  eventName: string;
  eventId: string;
  reason?: string | null;
  siteUrl?: string;
}

export function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function longDate(d: string): string {
  return new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function clock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const shell = (inner: string) => `<!doctype html><html><body style="margin:0;background:#F2F3F5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#151515">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden" cellspacing="0" cellpadding="0">${inner}</table>
<p style="font-size:12px;color:#6B7076;margin:16px 0 0">Ashoka Events</p>
</td></tr></table></body></html>`;

export async function buildTicketMessage(d: TicketMail): Promise<SendMailOptions> {
  const qr = await QRCode.toBuffer(d.token, { type: "png", width: 360, margin: 1, errorCorrectionLevel: "M" });
  const when = `${longDate(d.eventDate)}, ${clock(d.eventTime)}`;
  const link = d.siteUrl ? `<p style="margin:20px 0 0"><a href="${esc(d.siteUrl)}/tickets" style="color:#151515;font-weight:bold">Open My tickets</a></p>` : "";
  const html = shell(`
<tr><td style="background:#151515;color:#ffffff;padding:28px">
  <p style="margin:0;font-size:13px;color:#F2B83D;font-weight:bold">YOUR TICKET</p>
  <h1 style="margin:8px 0 14px;font-size:26px;line-height:1.1">${esc(d.eventName)}</h1>
  <p style="margin:0;font-size:15px">${esc(when)}</p>
  <p style="margin:4px 0 0;font-size:15px">${esc(d.venue)}</p>
  <p style="margin:18px 0 0;font-size:13px;color:#C9CBD0">Admit one</p>
  <p style="margin:2px 0 0;font-size:17px;font-weight:bold">${esc(d.name)}</p>
</td></tr>
<tr><td align="center" style="padding:28px">
  <img src="cid:ticketqr" width="220" height="220" alt="Your ticket QR code" style="display:block;border:0">
  <p style="margin:14px 0 0;font-family:monospace;font-size:14px;letter-spacing:1px">${esc(d.ticketId)}</p>
  <p style="margin:14px 0 0;font-size:14px;color:#6B7076">Show this QR code at the gate. It can be scanned only once, so don't share it. Turn your screen brightness up.</p>
  ${link}
</td></tr>`);
  const text = `Your ticket for ${d.eventName}\n${when}\n${d.venue}\nAdmit one: ${d.name}\nTicket ID: ${d.ticketId}\n\nOpen the QR code in this email at the gate. It can be scanned only once.`;
  return {
    to: d.email,
    subject: `Your ticket for ${d.eventName}`,
    text,
    html,
    attachments: [{ filename: "ticket-qr.png", content: qr, cid: "ticketqr", contentType: "image/png" }],
  };
}

export function buildRejectionMessage(d: RejectionMail): SendMailOptions {
  const why = d.reason?.trim() ? `Reason: ${d.reason.trim()}` : "The screenshot couldn't be verified.";
  const link = d.siteUrl ? `<p style="margin:20px 0 0"><a href="${esc(d.siteUrl)}/events/${esc(d.eventId)}" style="color:#151515;font-weight:bold">Upload a new screenshot</a></p>` : "";
  const html = shell(`
<tr><td style="padding:28px">
  <h1 style="margin:0 0 12px;font-size:24px">Your payment wasn't accepted</h1>
  <p style="margin:0 0 6px;font-size:15px">Hi ${esc(d.name)}, we couldn't confirm your payment for <b>${esc(d.eventName)}</b>.</p>
  <p style="margin:0;font-size:15px;color:#6B7076">${esc(why)}</p>
  <p style="margin:16px 0 0;font-size:15px">No ticket was issued. You can upload a new screenshot.</p>
  ${link}
</td></tr>`);
  return { to: d.email, subject: `Payment not accepted: ${d.eventName}`, text: `Hi ${d.name}, we couldn't confirm your payment for ${d.eventName}. ${why} No ticket was issued. You can upload a new screenshot.`, html };
}

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Sends several emails over ONE connection, one after another. A failure on one never stops the others. */
export async function sendBatch(items: { id: string; msg: SendMailOptions }[]): Promise<{ id: string; ok: boolean }[]> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, pool: true, maxConnections: 1,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
  });
  const from = process.env.EMAIL_FROM || `Ashoka Events <${process.env.SMTP_USER}>`;
  const out: { id: string; ok: boolean }[] = [];
  for (const it of items) {
    try {
      await transport.sendMail({ from, ...it.msg });
      out.push({ id: it.id, ok: true });
    } catch (e) {
      console.error("email failed:", it.id, e);
      out.push({ id: it.id, ok: false });
    }
  }
  transport.close();
  return out;
}

export async function sendMessage(msg: SendMailOptions): Promise<void> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000, // stay inside Vercel's time limit
  });
  await transport.sendMail({ from: process.env.EMAIL_FROM || `Ashoka Events <${process.env.SMTP_USER}>`, ...msg });
}
