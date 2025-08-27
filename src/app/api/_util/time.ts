import { DateTime } from "luxon";

export function dayWindowISO(tz: string, d = new Date()) {
  const now = DateTime.fromJSDate(d, { zone: tz });
  return {
    day: now.toFormat("yyyy-LL-dd"),
    start: now.startOf("day").toUTC().toISO(),
    end: now.endOf("day").toUTC().toISO()
  };
}