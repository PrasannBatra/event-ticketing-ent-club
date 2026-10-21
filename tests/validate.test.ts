import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, parseEventInput, sniffImage, toCsv, uuid, ValidationError } from "../lib/server/validate.ts";

const good = { name: "Show", description: "d", date: "2026-11-01", time: "19:30", venue: "Lawn", price: "499", capacity: "", salesOpen: "2026-10-20T10:00:00Z", salesClose: "2026-10-30T10:00:00Z" } as Record<string, string>;
const get = (o: Record<string, string>) => (k: string) => o[k];

test("valid event parses, blank capacity means no limit", () => {
  const e = parseEventInput(get(good));
  assert.equal(e.price, 499);
  assert.equal(e.capacity, null);
});
test("rejects bad input", () => {
  for (const bad of [{ name: "" }, { price: "-1" }, { price: "abc" }, { capacity: "0" }, { capacity: "1.5" }, { time: "25:00" }, { date: "2026-13-45" }, { salesClose: "2026-10-01T10:00:00Z" }]) {
    assert.throws(() => parseEventInput(get({ ...good, ...bad })), ValidationError, JSON.stringify(bad));
  }
});
test("image sniffing checks real file bytes", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))?.ext, "jpg");
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext, "png");
  assert.equal(sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.ext, "webp");
  assert.equal(sniffImage(new TextEncoder().encode("MZ this is an exe")), null);
  assert.equal(sniffImage(new Uint8Array([])), null);
});
test("uuid check", () => {
  assert.throws(() => uuid("nope", "Event"), ValidationError);
  assert.equal(uuid("123e4567-e89b-12d3-a456-426614174000", "Event"), "123e4567-e89b-12d3-a456-426614174000");
});
test("csv escapes commas, quotes and spreadsheet formulas", () => {
  assert.equal(csvCell('Doe, "Jo"'), '"Doe, ""Jo"""');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell(null), "");
  assert.ok(toCsv([["a", "b"], ["1", "2"]]).startsWith("\uFEFFa,b\r\n1,2"));
});
