"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/keystone/access.ts
var access_exports = {};
__export(access_exports, {
  FAMILY_ROLE: () => FAMILY_ROLE,
  ROLE_SESSION_FIELDS: () => ROLE_SESSION_FIELDS,
  TUTOR_ROLE: () => TUTOR_ROLE,
  isSignedIn: () => isSignedIn,
  permissions: () => permissions,
  rules: () => rules
});
function isSignedIn({ session }) {
  return Boolean(session);
}
var flag, permissions, rules, TUTOR_ROLE, FAMILY_ROLE, ROLE_SESSION_FIELDS;
var init_access = __esm({
  "features/keystone/access.ts"() {
    "use strict";
    flag = (key) => ({ session }) => Boolean(session?.data.role?.[key]);
    permissions = {
      canManagePeople: flag("canManagePeople"),
      canManageRoles: flag("canManageRoles"),
      canAccessDashboard: flag("canAccessDashboard"),
      canManageBusiness: flag("canManageBusiness"),
      canManageFamilies: flag("canManageFamilies"),
      canManageSessions: flag("canManageSessions"),
      canManagePayments: flag("canManagePayments"),
      canViewEarnings: flag("canViewEarnings"),
      canReadPayments: ({ session }) => Boolean(session?.data.role?.canManagePayments || session?.data.role?.canViewEarnings)
    };
    rules = {
      canReadPeople: ({ session }) => {
        if (!session) return false;
        if (session.data.role?.canSeeOtherPeople) return true;
        return { id: { equals: session.itemId } };
      },
      canUpdatePeople: ({ session }) => {
        if (!session) return false;
        if (session.data.role?.canEditOtherPeople) return true;
        return { id: { equals: session.itemId } };
      }
    };
    TUTOR_ROLE = {
      name: "Tutor",
      canSeeOtherPeople: true,
      canEditOtherPeople: true,
      canManagePeople: true,
      canManageRoles: true,
      canAccessDashboard: true,
      canManageBusiness: true,
      canManageFamilies: true,
      canManageSessions: true,
      canManagePayments: true,
      canViewEarnings: true
    };
    FAMILY_ROLE = {
      name: "Family",
      canSeeOtherPeople: false,
      canEditOtherPeople: false,
      canManagePeople: false,
      canManageRoles: false,
      canAccessDashboard: false,
      canManageBusiness: false,
      canManageFamilies: false,
      canManageSessions: false,
      canManagePayments: false,
      canViewEarnings: false
    };
    ROLE_SESSION_FIELDS = `
      id
      name
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageBusiness
      canManageFamilies
      canManageSessions
      canManagePayments
      canViewEarnings`;
  }
});

// features/keystone/utils/prisma-result.ts
function throwOnKeystonePrismaError(result, operation = "Prisma operation") {
  if (result instanceof Error) throw result;
  if (result === null || typeof result !== "object") return result;
  if ("errors" in result && Array.isArray(result.errors)) {
    throw new Error(`${operation} returned a GraphQL error result`);
  }
  return result;
}
function validatePrismaResult(path2, result) {
  throwOnKeystonePrismaError(result, path2);
  const operation = path2.slice(path2.lastIndexOf(".") + 1);
  if (operation === "count") {
    if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${path2} returned a malformed count`);
  } else if (["createMany", "updateMany", "deleteMany"].includes(operation)) {
    const count = result?.count;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error(`${path2} returned a malformed affected-row count`);
  }
  return result;
}
function guardKeystonePrismaResults(client) {
  const wrap = (value, path2) => {
    const cached = guardedClientCache.get(value);
    if (cached) return cached;
    const proxy = new Proxy(value, {
      get(target, property, receiver) {
        const member = Reflect.get(target, property, receiver);
        const name = typeof property === "string" ? property : String(property);
        const memberPath = path2 ? `${path2}.${name}` : name;
        if (typeof member === "function") {
          const operation = member;
          return (...args) => {
            let guardedArgs = args;
            if (memberPath === "$transaction" && typeof args[0] === "function") {
              const callback = args[0];
              guardedArgs = [(transaction2) => callback(guardKeystonePrismaResults(transaction2)), ...args.slice(1)];
            }
            return Promise.resolve(Reflect.apply(operation, target, guardedArgs)).then((result) => validatePrismaResult(memberPath, result));
          };
        }
        if (member && typeof member === "object" && !(member instanceof Date) && !Array.isArray(member)) {
          return wrap(member, memberPath);
        }
        return member;
      }
    });
    guardedClientCache.set(value, proxy);
    return proxy;
  };
  return wrap(client, "");
}
var guardedClientCache;
var init_prisma_result = __esm({
  "features/keystone/utils/prisma-result.ts"() {
    "use strict";
    guardedClientCache = /* @__PURE__ */ new WeakMap();
  }
});

// features/keystone/utils/business.ts
function guarded(prisma) {
  return guardKeystonePrismaResults(prisma);
}
function transaction(prisma, work) {
  return guarded(prisma).$transaction(async (tx) => work(guardKeystonePrismaResults(tx)), { maxWait: 2e4, timeout: 3e4 });
}
async function lockTutorBooking(tx, profileId) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "tutor-booking", profileId);
}
async function lockTutorBilling(tx, profileId) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "tutor-billing", profileId);
}
async function lockFamily(tx, familyId) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "tutor-family", familyId);
}
async function requireTutor(db, session, permission = "canManageSessions") {
  if (!session) throw new CommandError("Sign in first.");
  if (!session.data.role?.[permission]) throw new CommandError("Your role does not allow this.");
  const profile = await db.tutorProfile.findFirst({ where: { ownerId: session.itemId } });
  if (!profile) throw new CommandError("Set up your business first.");
  return profile;
}
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function cleanEmail(value) {
  const email = cleanText(value, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommandError("Enter a valid email.");
  return email;
}
function cleanUrl(value) {
  const url = cleanText(value, 500);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new CommandError("Enter a full link starting with https://");
  }
}
function wholeCents(value, label, max = 1e8) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new CommandError(`${label} is not a valid amount.`);
  return n;
}
function parseInstant(value, label = "Choose a time.") {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) throw new CommandError(label);
  return date;
}
function validTimeZone(value) {
  const tz = cleanText(value, 80);
  if (!tz) return "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    throw new CommandError("Choose a valid timezone.");
  }
}
var CommandError, ok, fail, share;
var init_business = __esm({
  "features/keystone/utils/business.ts"() {
    "use strict";
    init_prisma_result();
    CommandError = class extends Error {
    };
    ok = (data) => ({ success: true, error: null, data });
    fail = (error) => ({
      success: false,
      error: error instanceof CommandError ? error.message : "This could not be completed. Try again.",
      data: null
    });
    share = (amount, percent) => Math.floor(amount * percent / 100);
  }
});

// features/shared/business-time.ts
function businessDateParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function businessDateKey(value, timeZone) {
  const p = businessDateParts(value, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
function businessMinute(value, timeZone) {
  const p = businessDateParts(value, timeZone);
  return Number(p.hour) * 60 + Number(p.minute);
}
function businessWallTime(date, minute, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, 0, minute);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = businessDateParts(new Date(instant), timeZone);
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    const delta = target - represented;
    if (!delta) return new Date(instant);
    instant += delta;
  }
  throw new Error("This local time does not exist in your timezone. Choose another time.");
}
function businessDayRange(value, timeZone) {
  const key = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : businessDateKey(value, timeZone);
  const next = /* @__PURE__ */ new Date(`${key}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: businessWallTime(key, 0, timeZone), end: businessWallTime(next.toISOString().slice(0, 10), 0, timeZone) };
}
var init_business_time = __esm({
  "features/shared/business-time.ts"() {
    "use strict";
  }
});

// features/keystone/utils/availability.ts
function dayOfWeekFor(date) {
  return DAYS[(/* @__PURE__ */ new Date(`${date}T12:00:00Z`)).getUTCDay()];
}
function dayIndexFor(date) {
  return (/* @__PURE__ */ new Date(`${date}T12:00:00Z`)).getUTCDay();
}
function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN((/* @__PURE__ */ new Date(`${value}T12:00:00Z`)).getTime()) && (/* @__PURE__ */ new Date(`${value}T12:00:00Z`)).toISOString().slice(0, 10) === value;
}
function addDays(date, days) {
  const d = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function overlaps(a, b, bufferMinutes = 0) {
  const pad = bufferMinutes * 6e4;
  return a.startsAt.getTime() < b.endsAt.getTime() + pad && b.startsAt.getTime() < a.endsAt.getTime() + pad;
}
function openSlots(input) {
  const { hours, date, timeZone, duration } = input;
  const now = input.now ?? /* @__PURE__ */ new Date();
  if (!hours?.isWorking) return [];
  const start = hours.startMinute ?? 900;
  const end = hours.endMinute ?? 1200;
  const step = Math.max(5, input.slotMinutes);
  const earliest = now.getTime() + input.minNoticeHours * 36e5;
  const latest = now.getTime() + input.maxAdvanceDays * 864e5;
  const out = [];
  for (let minute = start; minute + duration <= end; minute += step) {
    const inBreak = typeof hours.breakStartMinute === "number" && typeof hours.breakEndMinute === "number" && minute < hours.breakEndMinute && hours.breakStartMinute < minute + duration;
    if (inBreak) continue;
    let begins;
    try {
      begins = businessWallTime(date, minute, timeZone);
    } catch {
      continue;
    }
    if (businessMinute(begins, timeZone) !== minute || businessDateKey(begins, timeZone) !== date) continue;
    if (begins.getTime() < earliest || begins.getTime() > latest) continue;
    const slot = { startsAt: begins, endsAt: new Date(begins.getTime() + duration * 6e4) };
    if (!input.busy.some((b) => overlaps(slot, b, input.bufferMinutes))) out.push(begins.toISOString());
  }
  return out;
}
function tutorDaysCovering(date, viewerTimeZone, tutorTimeZone) {
  const { start, end } = businessDayRange(date, viewerTimeZone);
  const first = businessDateKey(start, tutorTimeZone);
  const last = businessDateKey(new Date(end.getTime() - 1), tutorTimeZone);
  const days = [first];
  while (days[days.length - 1] < last) days.push(addDays(days[days.length - 1], 1));
  return { days, start, end };
}
var DAYS;
var init_availability = __esm({
  "features/keystone/utils/availability.ts"() {
    "use strict";
    init_business_time();
    DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  }
});

// features/keystone/utils/ledger.ts
async function entryKey(tx, sessionId, purchaseId, kind) {
  const n = await tx.creditEntry.count({ where: { purchaseId, ...sessionId ? { sessionId } : { sessionId: null } } });
  return `${purchaseId}:${sessionId ?? "none"}:${kind}:${n + 1}`;
}
async function write(tx, p) {
  await tx.creditEntry.create({
    data: {
      profileId: p.profileId,
      purchaseId: p.purchaseId,
      sessionId: p.sessionId ?? null,
      kind: p.kind,
      minutes: p.minutes,
      heldChange: p.heldChange ?? 0,
      note: p.note ?? "",
      key: await entryKey(tx, p.sessionId ?? null, p.purchaseId, p.kind)
    }
  });
}
async function heldFor(tx, sessionId) {
  const rows = await tx.creditEntry.findMany({ where: { sessionId }, select: { purchaseId: true, heldChange: true, minutes: true, kind: true }, take: 200 });
  const purchaseId = rows[0]?.purchaseId ?? null;
  const held = rows.reduce((sum, r) => sum + r.heldChange, 0);
  const debited = rows.filter((r) => r.kind === "debit").reduce((s, r) => s - r.heldChange, 0);
  const returned = rows.filter((r) => r.kind === "reversal").reduce((s, r) => s + r.minutes, 0);
  const reopened = rows.filter((r) => r.kind === "hold" && r.minutes === 0).reduce((s, r) => s + r.heldChange, 0);
  return { purchaseId, held, charged: debited - returned - reopened };
}
async function expirePurchases(tx, profileId, familyId) {
  const now = /* @__PURE__ */ new Date();
  const stale = await tx.packagePurchase.findMany({ where: { profileId, ...familyId ? { familyId } : {}, status: "active", expiresAt: { lte: now } }, select: { id: true, profileId: true, minutesRemaining: true }, take: 100 });
  for (const p of stale) {
    const claimed = await tx.packagePurchase.updateMany({ where: { id: p.id, status: "active", minutesRemaining: p.minutesRemaining }, data: { status: "expired", minutesRemaining: 0 } });
    if (!claimed.count) continue;
    if (p.minutesRemaining > 0) await write(tx, { profileId: p.profileId, purchaseId: p.id, kind: "expire", minutes: -p.minutesRemaining, note: "Package expired" });
  }
}
async function coveringPurchase(tx, input) {
  await expirePurchases(tx, input.profileId, input.familyId);
  const rows = await tx.packagePurchase.findMany({
    where: { profileId: input.profileId, familyId: input.familyId, status: "active", minutesRemaining: { gte: input.minutes }, OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }] },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    take: 20
  });
  return rows.find((p) => {
    const ids = (p.appliesToIds || "").split(",").map((s) => s.trim()).filter(Boolean);
    return !ids.length || ids.includes(input.sessionTypeId);
  }) ?? null;
}
async function holdMinutes(tx, purchase, sessionId, minutes) {
  const done = await tx.packagePurchase.updateMany({
    where: { id: purchase.id, status: "active", minutesRemaining: { gte: minutes }, OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }] },
    data: { minutesRemaining: { decrement: minutes } }
  });
  if (!done.count) throw new CommandError("Not enough time left on this package.");
  await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, sessionId, kind: "hold", minutes: -minutes, heldChange: minutes });
  await markUsedUp(tx, purchase.id);
}
async function markUsedUp(tx, purchaseId) {
  await tx.packagePurchase.updateMany({ where: { id: purchaseId, status: "active", minutesRemaining: 0 }, data: { status: "used_up" } });
}
async function giveBack(tx, profileId, purchaseId, sessionId, kind, minutes, heldChange, note) {
  if (minutes <= 0) return;
  await tx.packagePurchase.updateMany({ where: { id: purchaseId }, data: { minutesRemaining: { increment: minutes } } });
  await tx.packagePurchase.updateMany({ where: { id: purchaseId, status: "used_up", minutesRemaining: { gt: 0 } }, data: { status: "active" } });
  await write(tx, { profileId, purchaseId, sessionId, kind, minutes, heldChange, note });
  const p = await tx.packagePurchase.findUnique({ where: { id: purchaseId }, select: { status: true, expiresAt: true } });
  const closed = p && (["expired", "refunded", "cancelled"].includes(p.status) || p.expiresAt && p.expiresAt <= /* @__PURE__ */ new Date());
  if (closed) {
    await tx.packagePurchase.updateMany({ where: { id: purchaseId }, data: { minutesRemaining: { decrement: minutes } } });
    await write(tx, { profileId, purchaseId, kind: "expire", minutes: -minutes, note: "Returned after the package closed" });
  }
}
async function settleHold(tx, profileId, sessionId, chargeMinutes, note) {
  const { purchaseId, held } = await heldFor(tx, sessionId);
  if (!purchaseId || held <= 0) return { charged: 0, released: 0 };
  const charge = Math.max(0, Math.min(held, Math.floor(chargeMinutes)));
  if (charge > 0) await write(tx, { profileId, purchaseId, sessionId, kind: "debit", minutes: 0, heldChange: -charge, note });
  if (held - charge > 0) await giveBack(tx, profileId, purchaseId, sessionId, "release", held - charge, -(held - charge), note);
  return { charged: charge, released: held - charge };
}
async function reverseCharge(tx, profileId, sessionId, note) {
  const { purchaseId, charged } = await heldFor(tx, sessionId);
  if (!purchaseId || charged <= 0) return 0;
  await giveBack(tx, profileId, purchaseId, sessionId, "reversal", charged, 0, note);
  return charged;
}
async function reopenDebit(tx, profileId, sessionId) {
  const { purchaseId, charged } = await heldFor(tx, sessionId);
  if (!purchaseId || charged <= 0) return 0;
  await write(tx, { profileId, purchaseId, sessionId, kind: "hold", minutes: 0, heldChange: charged, note: "Session reopened" });
  return charged;
}
async function grantMinutes(tx, purchase) {
  await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, kind: "grant", minutes: purchase.minutesGranted, note: "Package paid" });
}
async function refundRemaining(tx, purchase, note) {
  const done = await tx.packagePurchase.updateMany({ where: { id: purchase.id, minutesRemaining: purchase.minutesRemaining, status: { in: ["active", "used_up", "expired"] } }, data: { minutesRemaining: 0, status: "refunded" } });
  if (!done.count) throw new CommandError("This package changed. Refresh and try again.");
  if (purchase.minutesRemaining > 0) await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, kind: "refund", minutes: -purchase.minutesRemaining, note });
}
async function adjustMinutes(tx, purchase, minutes, note) {
  if (!Number.isSafeInteger(minutes) || minutes === 0) throw new CommandError("Enter the minutes to add or take away.");
  if (!note.trim()) throw new CommandError("Give a reason for the change.");
  const where = minutes < 0 ? { id: purchase.id, status: { in: ["active"] }, minutesRemaining: { gte: -minutes } } : { id: purchase.id, status: { in: ["active", "used_up"] } };
  const done = await tx.packagePurchase.updateMany({ where, data: { minutesRemaining: { increment: minutes } } });
  if (!done.count) throw new CommandError(minutes < 0 ? "Not enough time left on this package." : "Only an active package can be changed.");
  await tx.packagePurchase.updateMany({ where: { id: purchase.id, status: "used_up", minutesRemaining: { gt: 0 } }, data: { status: "active" } });
  await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, kind: "adjustment", minutes, note });
  await markUsedUp(tx, purchase.id);
}
async function checkPurchase(tx, purchaseId) {
  const [p, sum] = await Promise.all([
    tx.packagePurchase.findUnique({ where: { id: purchaseId }, select: { minutesRemaining: true } }),
    tx.creditEntry.aggregate({ where: { purchaseId }, _sum: { minutes: true } })
  ]);
  return { stored: p?.minutesRemaining ?? 0, ledger: sum._sum.minutes ?? 0, ok: Boolean(p) && p.minutesRemaining === (sum._sum.minutes ?? 0) && p.minutesRemaining >= 0 };
}
var init_ledger = __esm({
  "features/keystone/utils/ledger.ts"() {
    "use strict";
    init_business();
  }
});

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  capturePaymentFunction: () => capturePaymentFunction,
  createPaymentFunction: () => createPaymentFunction,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  refundPaymentFunction: () => refundPaymentFunction
});
function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function asString(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
async function handleWebhookFunction() {
  throw new Error("Pay-in-person payments do not accept webhooks.");
}
async function createPaymentFunction({ amount, currency }) {
  return {
    status: "pending",
    data: {
      status: "pending",
      amount: asNumber(amount),
      currency: asString(currency, "usd").toLowerCase(),
      provider: "manual",
      settlement: "offline"
    }
  };
}
async function capturePaymentFunction() {
  throw new Error("Pay-in-person payments are not captured by a processor. Record the payment at checkout.");
}
async function refundPaymentFunction() {
  throw new Error("Pay-in-person payments are not refunded by a processor. Record a cash refund from the checkout receipt.");
}
async function getPaymentStatusFunction() {
  throw new Error("Pay-in-person payments have no processor status to check.");
}
async function generatePaymentLinkFunction() {
  return null;
}
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
  }
});

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  capturePaymentFunction: () => capturePaymentFunction2,
  createPaymentFunction: () => createPaymentFunction2,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction2,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  refundPaymentFunction: () => refundPaymentFunction2,
  stripeConfigured: () => stripeConfigured
});
function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Online card payments are not set up.");
  return key;
}
function form(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== void 0 && value !== "") body.append(key, String(value));
  return body;
}
async function stripe(path2, init = {}) {
  const response = await fetch(`${API}${path2}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
      ...init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}
    },
    body: init.body,
    redirect: "error"
  });
  const json3 = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json3.error?.message || `Stripe request failed (${response.status}).`);
  return json3;
}
function sessionStatus(session) {
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return "captured";
  if (session.status === "expired") return "expired";
  return "pending";
}
function asString2(value) {
  return typeof value === "string" ? value : "";
}
async function createPaymentFunction2({ amount, currency, successUrl, cancelUrl, description, idempotencyKey, metadata, customerEmail, expiresAt }) {
  const cents = Math.round(Number(amount));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Payment amount must be greater than zero.");
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const session = await stripe("/checkout/sessions", {
    method: "POST",
    idempotencyKey: asString2(idempotencyKey) || void 0,
    body: form({
      mode: "payment",
      // Unix seconds; Stripe accepts 30 minutes to 24 hours from now.
      expires_at: Number.isSafeInteger(expiresAt) ? Number(expiresAt) : void 0,
      success_url: asString2(successUrl),
      cancel_url: asString2(cancelUrl),
      .../^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString2(customerEmail)) ? { customer_email: asString2(customerEmail) } : {},
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": asString2(currency || "usd").toLowerCase(),
      "line_items[0][price_data][unit_amount]": cents,
      "line_items[0][price_data][product_data][name]": asString2(description) || "Tutoring",
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`metadata[${key}]`, asString2(value)]))
    })
  });
  return { status: sessionStatus(session), id: session.id, url: session.url, data: { id: session.id, url: session.url, status: session.status, amount: session.amount_total, provider: "stripe" } };
}
async function getPaymentStatusFunction2({ paymentId }) {
  const session = await stripe(`/checkout/sessions/${encodeURIComponent(asString2(paymentId))}`);
  return { status: sessionStatus(session), amount: session.amount_total, currency: session.currency, data: { id: session.id, status: session.status, paymentStatus: session.payment_status, paymentIntent: session.payment_intent, amount: session.amount_total, currency: session.currency } };
}
async function capturePaymentFunction2(args) {
  return getPaymentStatusFunction2(args);
}
async function refundPaymentFunction2({ paymentId, amount, idempotencyKey }) {
  const session = await stripe(`/checkout/sessions/${encodeURIComponent(asString2(paymentId))}`);
  if (!session.payment_intent) throw new Error("This payment has nothing to refund.");
  const refund = await stripe("/refunds", {
    method: "POST",
    idempotencyKey: asString2(idempotencyKey) || void 0,
    body: form({ payment_intent: session.payment_intent, amount: amount == null ? void 0 : Math.round(Number(amount)) })
  });
  return { status: refund.status === "succeeded" ? "refunded" : refund.status, amount: refund.amount, data: refund };
}
async function handleWebhookFunction2() {
  throw new Error("Stripe payments are confirmed from the Checkout Session, not by webhook.");
}
var API, generatePaymentLinkFunction2;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    API = "https://api.stripe.com/v1";
    generatePaymentLinkFunction2 = createPaymentFunction2;
  }
});

// features/integrations/payment/index.ts
function isPaymentProviderAdapterCode(value) {
  return Object.prototype.hasOwnProperty.call(paymentProviderAdapters, value);
}
function getPaymentProviderRegistration(code) {
  return isPaymentProviderAdapterCode(code) ? paymentProviderAdapters[code] : null;
}
var paymentProviderAdapters;
var init_payment = __esm({
  "features/integrations/payment/index.ts"() {
    "use strict";
    paymentProviderAdapters = {
      manual: {
        load: () => Promise.resolve().then(() => (init_manual(), manual_exports)),
        settlement: "offline",
        allowsPublicSettlement: false
      },
      // Online deposits through Stripe Checkout. Secret key: STRIPE_SECRET_KEY.
      stripe: {
        load: () => Promise.resolve().then(() => (init_stripe(), stripe_exports)),
        settlement: "processor",
        allowsPublicSettlement: true
      }
    };
  }
});

// features/keystone/utils/paymentProviderAdapter.ts
function adapterCodeForProvider(provider) {
  const code = provider.code.replace(/^pp_/, "");
  const registration = getPaymentProviderRegistration(code);
  if (!registration) {
    throw new Error(`Payment adapter ${code || provider.code} is not registered.`);
  }
  return code;
}
async function executeAdapterFunction({ provider, functionName, args }) {
  const adapterCode = adapterCodeForProvider(provider);
  const configuredSelector = provider[functionName];
  if (typeof configuredSelector === "string" && configuredSelector !== adapterCode) {
    throw new Error(`Payment adapter selector for ${functionName} is not registered for ${adapterCode}.`);
  }
  const registration = getPaymentProviderRegistration(adapterCode);
  if (!registration) throw new Error(`Payment adapter ${adapterCode} is not registered.`);
  const adapter2 = await registration.load();
  const fn = adapter2[functionName];
  if (!fn) {
    throw new Error(`Function ${functionName} is not available in payment adapter ${adapterCode}.`);
  }
  try {
    return await fn({ provider: { code: provider.code }, ...args });
  } catch (error) {
    throw new Error(
      `Error executing ${functionName} for payment adapter ${adapterCode}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
async function createPayment({ provider, ...args }) {
  return executeAdapterFunction({ provider, functionName: "createPaymentFunction", args });
}
async function refundPayment({ provider, ...args }) {
  return executeAdapterFunction({ provider, functionName: "refundPaymentFunction", args });
}
async function getPaymentStatus({ provider, ...args }) {
  return executeAdapterFunction({ provider, functionName: "getPaymentStatusFunction", args });
}
var init_paymentProviderAdapter = __esm({
  "features/keystone/utils/paymentProviderAdapter.ts"() {
    "use strict";
    init_payment();
  }
});

// features/keystone/utils/payments.ts
function stripeOn() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
async function cardProvider(db, profileId) {
  if (!stripeOn()) return null;
  const found = await db.paymentProvider.findFirst({ where: { profileId, code: "pp_stripe" } });
  if (found) return found.isInstalled ? found : null;
  return db.paymentProvider.create({ data: { profileId, ...STRIPE_PROVIDER } });
}
async function openCheckout(prisma, input) {
  const db = guarded(prisma);
  if (input.amountCents <= 0) throw new CommandError("There is nothing to pay.");
  const provider = await cardProvider(db, input.profile.id);
  if (!provider) throw new CommandError("Card payments are not set up. Pay your tutor directly.");
  const end = input.holdEndsAt ? input.holdEndsAt.getTime() : Date.now() + 23.5 * 36e5;
  const expiresAt = new Date(Math.min(Math.max(end, Date.now() + 31 * 6e4), Date.now() + 23.5 * 36e5));
  const join = input.backUrl.includes("?") ? "&" : "?";
  const result = await createPayment({
    provider: { code: provider.code },
    amount: input.amountCents,
    currency: input.profile.currencyCode.toLowerCase(),
    description: input.description.slice(0, 200),
    idempotencyKey: (0, import_node_crypto2.randomUUID)(),
    customerEmail: input.email ?? "",
    successUrl: `${input.backUrl}${join}paid=1`,
    cancelUrl: `${input.backUrl}${join}paid=0`,
    expiresAt: Math.floor(expiresAt.getTime() / 1e3),
    metadata: { target: input.target, targetId: input.targetId, profileId: input.profile.id }
  });
  if (!result.id || !result.url) throw new CommandError("The card page did not open. Try again.");
  await db.paymentSession.create({
    data: {
      profileId: input.profile.id,
      target: input.target,
      paymentProviderId: provider.id,
      amountCents: input.amountCents,
      currencyCode: input.profile.currencyCode,
      providerPaymentId: result.id,
      expiresAt,
      ...input.target === "session" ? { sessionId: input.targetId } : input.target === "package" ? { purchaseId: input.targetId } : { invoiceId: input.targetId }
    }
  });
  return { url: result.url, checkoutId: result.id };
}
async function settleTarget(prisma, target, targetId) {
  if (!stripeOn()) return { paid: false };
  const db = guarded(prisma);
  const where = target === "session" ? { sessionId: targetId } : target === "package" ? { purchaseId: targetId } : { invoiceId: targetId };
  const rows = await db.paymentSession.findMany({ where: { ...where, OR: [{ status: "pending" }, { status: "cancelled", expiresAt: { gt: new Date(Date.now() - 36e5) } }] }, include: { paymentProvider: { select: { code: true } } }, take: 10 });
  let paid = false;
  for (const row of rows) {
    if (await settleCheckout(prisma, row).catch((e) => {
      console.error("[tutor] settle failed", e instanceof Error ? e.message : e);
      return false;
    })) paid = true;
  }
  return { paid };
}
async function settleCheckout(prisma, row) {
  if (!row.providerPaymentId || !row.paymentProvider) return false;
  const result = await getPaymentStatus({ provider: { code: row.paymentProvider.code }, paymentId: row.providerPaymentId });
  if (result.status === "expired") {
    await guarded(prisma).paymentSession.updateMany({ where: { id: row.id, status: { in: ["pending", "cancelled"] } }, data: { status: "expired" } });
    return false;
  }
  if (result.status !== "captured") return false;
  if (Number(result.amount) !== row.amountCents || String(result.currency || "").toLowerCase() !== row.currencyCode.toLowerCase()) {
    console.error("[tutor] checkout amount or currency mismatch", row.id);
    return false;
  }
  let refundAfter = null;
  const recorded = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, row.profileId);
    await lockTutorBilling(tx, row.profileId);
    const claimed = await tx.paymentSession.updateMany({ where: { id: row.id, status: { in: ["pending", "expired", "cancelled"] } }, data: { status: "captured", capturedAt: /* @__PURE__ */ new Date() } });
    if (!claimed.count) return false;
    const base = { profileId: row.profileId, method: "stripe", status: "confirmed", amountCents: row.amountCents, currencyCode: row.currencyCode, providerReference: row.providerPaymentId, paidAt: /* @__PURE__ */ new Date(), decidedAt: /* @__PURE__ */ new Date() };
    if (row.target === "session" && row.sessionId) {
      const s = await tx.session.findUnique({ where: { id: row.sessionId }, select: { id: true, status: true, familyId: true } });
      if (!s) return false;
      const payment = await tx.payment.create({ data: { ...base, kind: "session", sessionId: s.id, familyId: s.familyId } });
      if (s.status === "pending_payment" || s.status === "scheduled" || s.status === "completed") {
        await tx.session.update({ where: { id: s.id }, data: { paymentStatus: "paid", ...s.status === "pending_payment" ? { status: "scheduled", holdEndsAt: null } : {} } });
      } else {
        await tx.session.update({ where: { id: s.id }, data: { paymentStatus: "paid" } });
        refundAfter = payment.id;
      }
      return true;
    }
    if (row.target === "package" && row.purchaseId) {
      const p = await tx.packagePurchase.findUnique({ where: { id: row.purchaseId }, include: { package: { select: { validMonths: true } } } });
      if (!p) return false;
      const payment = await tx.payment.create({ data: { ...base, kind: "package", purchaseId: p.id, familyId: p.familyId } });
      const activated = await activatePurchase(tx, p, row.amountCents);
      if (!activated) refundAfter = payment.id;
      return true;
    }
    if (row.target === "invoice" && row.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: row.invoiceId } });
      if (!inv) return false;
      const payment = await tx.payment.create({ data: { ...base, kind: "invoice", invoiceId: inv.id, familyId: inv.familyId } });
      const applied = await applyInvoicePayment(tx, inv.id, row.amountCents);
      if (!applied) refundAfter = payment.id;
      return true;
    }
    return false;
  });
  if (refundAfter) await refundPaymentRow(prisma, refundAfter, null, "Paid after it was no longer due").catch((e) => console.error("[tutor] late payment refund failed", e instanceof Error ? e.message : e));
  return recorded;
}
async function activatePurchase(tx, p, paidCents) {
  const months = p.package?.validMonths ?? 12;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);
  const done = await tx.packagePurchase.updateMany({ where: { id: p.id, status: "awaiting_payment" }, data: { status: "active", minutesRemaining: p.minutesGranted, pricePaidCents: paidCents, purchasedAt: now, expiresAt } });
  if (!done.count) return false;
  await grantMinutes(tx, p);
  return true;
}
async function applyInvoicePayment(tx, invoiceId, cents) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, status: true, totalCents: true, paidCents: true } });
  if (!inv || inv.status !== "sent" || inv.paidCents + cents > inv.totalCents) return false;
  const paid = inv.paidCents + cents;
  const done = await tx.invoice.updateMany({ where: { id: inv.id, status: "sent", paidCents: inv.paidCents }, data: { paidCents: paid, ...paid >= inv.totalCents ? { status: "paid" } : {} } });
  return done.count === 1;
}
async function refundPaymentRow(prisma, paymentId, amountCents, note) {
  const db = guarded(prisma);
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.kind === "refund") throw new CommandError("Choose a payment to refund.");
  if (!["confirmed", "partially_refunded"].includes(p.status)) throw new CommandError("Only a confirmed payment can be refunded.");
  const left = p.amountCents - p.refundedCents - p.refundPendingCents;
  const amount = amountCents == null ? left : amountCents;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new CommandError("There is nothing left to refund on this payment.");
  if (amount > left) throw new CommandError("A refund cannot be more than what was paid.");
  const n = p.refundCount + 1;
  const claimed = await db.payment.updateMany({ where: { id: p.id, refundedCents: p.refundedCents, refundPendingCents: p.refundPendingCents, refundCount: p.refundCount }, data: { refundPendingCents: { increment: amount }, refundCount: n } });
  if (!claimed.count) throw new CommandError("This payment changed. Refresh and try again.");
  let providerReference = "";
  if (p.method === "stripe") {
    try {
      const r = await refundPayment({ provider: { code: "pp_stripe" }, paymentId: p.providerReference, amount, idempotencyKey: `refund-${p.id}-${n}` });
      providerReference = r?.data?.id ?? "";
    } catch (error) {
      await db.payment.updateMany({ where: { id: p.id }, data: { refundPendingCents: { decrement: amount } } });
      console.error("[tutor] stripe refund failed", error instanceof Error ? error.message : error);
      throw new CommandError("Stripe did not accept the refund. Nothing was changed; try again.");
    }
  }
  const refunded = p.refundedCents + amount;
  await transaction(prisma, async (tx) => {
    await tx.payment.update({ where: { id: p.id }, data: { refundPendingCents: { decrement: amount }, refundedCents: { increment: amount }, status: refunded >= p.amountCents ? "refunded" : "partially_refunded" } });
    await tx.payment.create({ data: { profileId: p.profileId, familyId: p.familyId, sessionId: p.sessionId, purchaseId: p.purchaseId, invoiceId: p.invoiceId, refundOfId: p.id, kind: "refund", method: p.method, status: "confirmed", amountCents: amount, currencyCode: p.currencyCode, providerReference, paidAt: /* @__PURE__ */ new Date(), decidedAt: /* @__PURE__ */ new Date(), note: note.slice(0, 300) } });
    if (p.sessionId) await tx.session.update({ where: { id: p.sessionId }, data: { paymentStatus: refunded >= p.amountCents ? "refunded" : "part_refunded" } });
    if (p.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: p.invoiceId }, select: { paidCents: true, totalCents: true, status: true } });
      if (inv && inv.status !== "void") await tx.invoice.update({ where: { id: p.invoiceId }, data: { paidCents: Math.max(0, inv.paidCents - amount), ...inv.status === "paid" ? { status: "sent" } : {} } });
    }
  });
  return { refundedCents: amount, method: p.method };
}
async function sessionCardPayment(db, sessionId) {
  return db.payment.findFirst({ where: { sessionId, kind: "session", method: "stripe", status: { in: ["confirmed", "partially_refunded"] } }, orderBy: { createdAt: "asc" } });
}
async function expireOpenCheckouts(db, target, targetId) {
  const where = target === "session" ? { sessionId: targetId } : target === "package" ? { purchaseId: targetId } : { invoiceId: targetId };
  await db.paymentSession.updateMany({ where: { ...where, status: "pending" }, data: { status: "cancelled" } });
}
var import_node_crypto2, fns, MANUAL_PROVIDER, STRIPE_PROVIDER;
var init_payments = __esm({
  "features/keystone/utils/payments.ts"() {
    "use strict";
    import_node_crypto2 = require("node:crypto");
    init_paymentProviderAdapter();
    init_business();
    init_ledger();
    fns = (code) => ({ createPaymentFunction: code, capturePaymentFunction: code, refundPaymentFunction: code, getPaymentStatusFunction: code, generatePaymentLinkFunction: code, handleWebhookFunction: code });
    MANUAL_PROVIDER = { name: "Paid to the tutor directly", code: "pp_manual", isInstalled: true, ...fns("manual") };
    STRIPE_PROVIDER = { name: "Card (Stripe)", code: "pp_stripe", isInstalled: true, ...fns("stripe") };
  }
});

// features/keystone/utils/publicAccessToken.ts
var publicAccessToken_exports = {};
__export(publicAccessToken_exports, {
  createPublicAccessToken: () => createPublicAccessToken,
  hashPublicAccessToken: () => hashPublicAccessToken,
  publicAccessTokenMatches: () => publicAccessTokenMatches
});
function hashPublicAccessToken(token) {
  return (0, import_node_crypto3.createHash)("sha256").update(token, "utf8").digest("hex");
}
function createPublicAccessToken() {
  const token = (0, import_node_crypto3.randomBytes)(32).toString("base64url");
  return { token, hash: hashPublicAccessToken(token) };
}
function publicAccessTokenMatches(token, expectedHash) {
  if (!token || !expectedHash) return false;
  const supplied = Buffer.from(hashPublicAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return supplied.length === expected.length && (0, import_node_crypto3.timingSafeEqual)(supplied, expected);
}
var import_node_crypto3;
var init_publicAccessToken = __esm({
  "features/keystone/utils/publicAccessToken.ts"() {
    "use strict";
    import_node_crypto3 = require("node:crypto");
  }
});

// features/keystone/utils/booking.ts
var booking_exports = {};
__export(booking_exports, {
  FAMILY_SAFE_STATUSES: () => FAMILY_SAFE_STATUSES,
  book: () => book,
  bookInLock: () => bookInLock,
  cancelFutureSeriesSessions: () => cancelFutureSeriesSessions,
  cancelSession: () => cancelSession,
  cancelTerms: () => cancelTerms,
  completeInLock: () => completeInLock,
  excuseSession: () => excuseSession,
  heldFor: () => heldFor,
  insideWindow: () => insideWindow,
  markNoShow: () => markNoShow,
  releaseUnpaidHolds: () => releaseUnpaidHolds,
  reopenSession: () => reopenSession,
  rescheduleSession: () => rescheduleSession,
  slotsForDay: () => slotsForDay,
  topUpAllSeries: () => topUpAllSeries,
  topUpSeriesInLock: () => topUpSeriesInLock
});
async function busyBetween(db, profileId, start, end, excludeSessionId) {
  const [sessions, off] = await Promise.all([
    db.session.findMany({
      where: { profileId, ...holdingTime(), startsAt: { lt: new Date(end.getTime() + 864e5) }, endsAt: { gt: new Date(start.getTime() - 864e5) }, ...excludeSessionId ? { NOT: { id: excludeSessionId } } : {} },
      select: { startsAt: true, endsAt: true },
      take: 500
    }),
    db.timeOff.findMany({ where: { profileId, startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true }, take: 200 })
  ]);
  return [...sessions, ...off];
}
async function tutorDaySlots(db, profile, type, date, excludeSessionId, now = /* @__PURE__ */ new Date()) {
  const hours = await db.weeklyHours.findFirst({ where: { profileId: profile.id, dayOfWeek: dayOfWeekFor(date) } });
  const dayStart = businessWallTime(date, 0, profile.timezone);
  const dayEnd = businessWallTime(addDays(date, 1), 0, profile.timezone);
  const busy = await busyBetween(db, profile.id, dayStart, dayEnd, excludeSessionId);
  return openSlots({
    date,
    timeZone: profile.timezone,
    hours: hours ?? void 0,
    duration: type.durationMinutes,
    slotMinutes: profile.slotMinutes,
    bufferMinutes: profile.bufferMinutes,
    minNoticeHours: profile.minNoticeHours,
    maxAdvanceDays: profile.maxAdvanceDays,
    busy,
    now
  });
}
async function slotsForDay(db, profile, type, date, viewerTimeZone, excludeSessionId) {
  if (!isDateKey(date)) throw new CommandError("Choose a valid date.");
  const tz = viewerTimeZone || profile.timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new CommandError("Choose a valid timezone.");
  }
  const { days, start, end } = tutorDaysCovering(date, tz, profile.timezone);
  const all = (await Promise.all(days.map((d) => tutorDaySlots(db, profile, type, d, excludeSessionId)))).flat();
  return [...new Set(all)].filter((iso2) => {
    const t = new Date(iso2).getTime();
    return t >= start.getTime() && t < end.getTime();
  }).sort();
}
async function slotIsOpen(db, profile, type, startsAt, excludeSessionId) {
  const free = await tutorDaySlots(db, profile, type, businessDateKey(startsAt, profile.timezone), excludeSessionId);
  return free.includes(startsAt.toISOString());
}
async function tutorTimeIsFree(db, profile, startsAt, endsAt, excludeSessionId) {
  const busy = await busyBetween(db, profile.id, startsAt, endsAt, excludeSessionId);
  return !busy.some((b) => overlaps({ startsAt, endsAt }, b, profile.bufferMinutes));
}
async function releaseUnpaidHolds(prisma, profileId, sessionId) {
  const db = guarded(prisma);
  const stale = await db.session.findMany({ where: { profileId, status: "pending_payment", holdEndsAt: { lte: /* @__PURE__ */ new Date() }, ...sessionId ? { id: sessionId } : {} }, select: { id: true }, take: 50 });
  let released = 0;
  for (const s of stale) {
    if ((await settleTarget(prisma, "session", s.id).catch(() => ({ paid: false }))).paid) continue;
    const done = await db.session.updateMany({ where: { id: s.id, status: "pending_payment", paymentStatus: "unpaid" }, data: { status: "released", cancelledBy: "system", cancelledAt: /* @__PURE__ */ new Date(), cancellationReason: "Not paid before the hold ended; the time was released" } });
    if (!done.count) continue;
    released++;
    await expireOpenCheckouts(db, "session", s.id);
  }
  return released;
}
async function bookInLock(tx, input) {
  const { profile, type, family, actor } = input;
  if (!type.active) throw new CommandError("This kind of session is not offered right now.");
  if (family.status === "blocked" && actor !== "tutor") throw new CommandError("This time can\u2019t be booked online. Contact your tutor.");
  if (input.studentIds.length < 1) throw new CommandError("Choose who the session is for.");
  if (input.studentIds.length > type.maxStudents) throw new CommandError(`This session is for up to ${type.maxStudents} ${type.maxStudents === 1 ? "student" : "students"}.`);
  const students = await tx.student.count({ where: { id: { in: input.studentIds }, familyId: family.id, profileId: profile.id } });
  if (students !== new Set(input.studentIds).size) throw new CommandError("Choose your own students.");
  const endsAt = new Date(input.startsAt.getTime() + type.durationMinutes * 6e4);
  const open = actor === "tutor" || actor === "series" ? await tutorTimeIsFree(tx, profile, input.startsAt, endsAt) : await slotIsOpen(tx, profile, type, input.startsAt);
  if (!open) throw new CommandError(actor === "series" ? "clash" : "That time was just taken. Choose another.");
  const mode = input.mode === "in_person" || type.mode === "in_person" ? "in_person" : "online";
  if (type.mode !== "either" && input.mode && input.mode !== type.mode) throw new CommandError(`This session is ${type.mode === "online" ? "online" : "in person"}.`);
  let funding = "free";
  let purchase = null;
  if (type.priceCents > 0) {
    purchase = actor === "visitor" ? null : await coveringPurchase(tx, { profileId: profile.id, familyId: family.id, sessionTypeId: type.id, minutes: type.durationMinutes });
    if (purchase) funding = "package";
    else if (actor !== "visitor" && family.billingMode === "invoice") funding = "invoice";
    else if (actor !== "visitor" && family.billingMode === "flat_monthly") funding = "flat";
    else funding = "card";
  }
  const checkout = funding === "card" && (actor === "visitor" || actor === "guardian") && stripeOn();
  const access = createPublicAccessToken();
  const now = /* @__PURE__ */ new Date();
  const session = await tx.session.create({
    data: {
      profileId: profile.id,
      familyId: family.id,
      sessionTypeId: type.id,
      seriesId: input.seriesId ?? null,
      students: { connect: input.studentIds.map((id) => ({ id })) },
      startsAt: input.startsAt,
      endsAt,
      mode,
      status: checkout ? "pending_payment" : "scheduled",
      funding,
      source: actor === "visitor" || actor === "guardian" ? "online" : actor === "series" ? "series" : "tutor",
      typeNameSnapshot: type.name,
      priceCents: type.priceCents,
      paymentStatus: funding === "card" ? "unpaid" : "not_due",
      holdEndsAt: checkout ? new Date(now.getTime() + profile.unpaidHoldMinutes * 6e4) : null,
      guardianMessage: (input.message ?? "").slice(0, 1e3),
      publicAccessTokenHash: access.hash,
      locationText: mode === "in_person" ? profile.inPersonArea : ""
    }
  });
  if (purchase && funding === "package") {
    try {
      await holdMinutes(tx, purchase, session.id, type.durationMinutes);
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;
      const fallback = family.billingMode === "invoice" ? "invoice" : family.billingMode === "flat_monthly" ? "flat" : "card";
      const pay2 = fallback === "card" && actor === "guardian" && stripeOn();
      await tx.session.update({ where: { id: session.id }, data: { funding: fallback, paymentStatus: fallback === "card" ? "unpaid" : "not_due", ...pay2 ? { status: "pending_payment", holdEndsAt: new Date(now.getTime() + profile.unpaidHoldMinutes * 6e4) } : {} } });
      return { session: await tx.session.findUniqueOrThrow({ where: { id: session.id } }), token: access.token };
    }
  }
  return { session, token: access.token };
}
async function book(prisma, input) {
  await releaseUnpaidHolds(prisma, input.profileId);
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, input.profileId);
    const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: input.profileId } });
    const type = await tx.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id } });
    if (!type) throw new CommandError("Choose a kind of session.");
    const family = await tx.family.findFirst({ where: { id: input.familyId, profileId: profile.id }, select: { id: true, status: true, billingMode: true } });
    if (!family) throw new CommandError("Choose a family.");
    return bookInLock(tx, { ...input, profile, type, family });
  });
}
function insideWindow(profile, startsAt, now = /* @__PURE__ */ new Date()) {
  return now.getTime() > startsAt.getTime() - profile.cancellationWindowHours * 36e5;
}
function cancelTerms(profile, s, durationMinutes, now = /* @__PURE__ */ new Date()) {
  if (s.status === "pending_payment") return { late: false, percent: 0, text: "Nothing is charged." };
  const late = insideWindow(profile, s.startsAt, now);
  const percent = late ? profile.lateCancelPercent : 0;
  if (!late) return { late, percent, text: s.funding === "package" ? "Your package minutes come back." : s.funding === "card" ? "Anything you paid by card is refunded." : "Nothing is charged." };
  if (percent === 0 || s.funding === "free" || s.funding === "flat") return { late, percent, text: `This is inside the ${profile.cancellationWindowHours}-hour window, but nothing is charged.` };
  const what = s.funding === "package" ? `${share(durationMinutes, percent)} minutes of your package` : `${percent}% of the price`;
  return { late, percent, text: `This is inside the ${profile.cancellationWindowHours}-hour cancellation window, so ${what} is charged.` };
}
async function load(db, id, profileId) {
  const s = await db.session.findFirst({ where: { id, ...profileId ? { profileId } : {} }, include: { profile: true, sessionType: true } });
  if (!s) throw new CommandError("This session was not found.");
  return s;
}
async function chargeShare(tx, s, percent, reason) {
  const out = { chargedCents: 0, chargedMinutes: 0, billable: "no" };
  if (s.funding === "package") {
    const r = await settleHold(tx, s.profileId, s.id, share(minutesOf(s), percent), reason);
    out.chargedMinutes = r.charged;
  } else if (s.funding === "invoice") {
    out.chargedCents = share(s.priceCents, percent);
    out.billable = out.chargedCents > 0 ? "yes" : "no";
  } else if (s.funding === "card") {
    out.chargedCents = share(s.priceCents, percent);
  }
  return out;
}
async function refundCardDown(prisma, sessionId, keepCents, note) {
  const payment = await sessionCardPayment(guarded(prisma), sessionId);
  if (!payment) return 0;
  const left = payment.amountCents - payment.refundedCents;
  const give = Math.max(0, left - keepCents);
  if (give <= 0) return 0;
  await refundPaymentRow(prisma, payment.id, give, note);
  return give;
}
async function cancelSession(prisma, input) {
  const db = guarded(prisma);
  let s = await load(db, input.sessionId, input.profileId);
  if (s.status === "pending_payment") {
    await settleTarget(prisma, "session", s.id).catch(() => null);
    s = await load(db, s.id, input.profileId);
  }
  if (s.status === "pending_payment") {
    const done = await db.session.updateMany({ where: { id: s.id, status: "pending_payment" }, data: { status: "cancelled", cancelledBy: input.by, cancelledAt: /* @__PURE__ */ new Date(), cancellationReason: input.reason || "Cancelled before payment" } });
    if (!done.count) throw new CommandError("This session changed. Refresh and try again.");
    await expireOpenCheckouts(db, "session", s.id);
    return { status: "cancelled", charged: "nothing", refundedCents: 0 };
  }
  if (s.status !== "scheduled") throw new CommandError("Only a booked session can be cancelled.");
  if (input.by === "guardian" && s.startsAt.getTime() <= Date.now()) throw new CommandError("This session has started. Contact your tutor.");
  const late = input.by === "guardian" && insideWindow(s.profile, s.startsAt);
  const percent = late ? s.profile.lateCancelPercent : 0;
  const keepCents = s.funding === "card" ? share(s.priceCents, percent) : 0;
  let refundedCents = 0;
  if (s.funding === "card") {
    try {
      refundedCents = await refundCardDown(prisma, s.id, keepCents, input.by === "tutor" ? "Cancelled by the tutor" : "Cancelled by the family");
    } catch (e) {
      if (e instanceof CommandError) throw new CommandError(`The card refund did not go through, so the session is still booked. ${e.message}`);
      throw e;
    }
  }
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, s.profileId);
    const fresh = await load(tx, s.id);
    if (fresh.status !== "scheduled") throw new CommandError("This session changed. Refresh and try again.");
    const charge = late ? await chargeShare(tx, fresh, percent, "Late cancellation") : { chargedCents: 0, chargedMinutes: 0, billable: "no" };
    if (!late && fresh.funding === "package") await settleHold(tx, fresh.profileId, fresh.id, 0, input.by === "tutor" ? "Cancelled by the tutor" : "Cancelled in time");
    const done = await tx.session.updateMany({
      where: { id: fresh.id, status: "scheduled" },
      data: { status: late ? "late_cancelled" : "cancelled", cancelledBy: input.by, cancelledAt: /* @__PURE__ */ new Date(), cancellationReason: (input.reason || "").slice(0, 300), ...charge }
    });
    if (!done.count) throw new CommandError("This session changed. Refresh and try again.");
    return { status: late ? "late_cancelled" : "cancelled", charged: late && percent > 0 ? `${percent}%` : "nothing", refundedCents };
  });
}
async function rescheduleSession(prisma, input) {
  await releaseUnpaidHolds(prisma, input.profileId);
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, input.profileId);
    const s = await load(tx, input.sessionId, input.profileId);
    if (!["scheduled", "pending_payment"].includes(s.status)) throw new CommandError("Only a booked session can be moved.");
    if (!s.sessionType) throw new CommandError("This session has no session type.");
    if (input.by === "guardian") {
      if (insideWindow(s.profile, s.startsAt)) throw new CommandError(`Moving closes ${s.profile.cancellationWindowHours} hours before the session. Contact your tutor.`);
      if (s.rescheduleCount >= s.profile.reschedulesAllowed) throw new CommandError(`This session has been moved ${s.rescheduleCount} ${s.rescheduleCount === 1 ? "time" : "times"}, the most allowed. Contact your tutor.`);
    }
    const duration = minutesOf(s);
    const endsAt = new Date(input.startsAt.getTime() + duration * 6e4);
    const free = input.by === "tutor" ? await tutorTimeIsFree(tx, s.profile, input.startsAt, endsAt, s.id) : await slotIsOpen(tx, s.profile, { durationMinutes: duration }, input.startsAt, s.id);
    if (!free) throw new CommandError("That time was just taken. Choose another.");
    const done = await tx.session.updateMany({
      where: { id: s.id, status: s.status, startsAt: s.startsAt },
      data: { startsAt: input.startsAt, endsAt, rescheduledFrom: s.startsAt, reminderSentAt: null, ...input.by === "guardian" ? { rescheduleCount: { increment: 1 } } : {} }
    });
    if (!done.count) throw new CommandError("This session changed. Refresh and try again.");
    return { id: s.id, startsAt: input.startsAt.toISOString(), endsAt: endsAt.toISOString(), from: s.startsAt.toISOString() };
  });
}
async function completeInLock(tx, sessionId, profileId) {
  const s = await load(tx, sessionId, profileId);
  if (s.status !== "scheduled") throw new CommandError("Only a booked session can be completed.");
  if (s.startsAt.getTime() > Date.now()) throw new CommandError("This session has not started yet.");
  const charge = await chargeShare(tx, s, 100, "Session taught");
  const done = await tx.session.updateMany({ where: { id: s.id, status: "scheduled" }, data: { status: "completed", completedAt: /* @__PURE__ */ new Date(), ...charge } });
  if (!done.count) throw new CommandError("This session changed. Refresh and try again.");
  return s;
}
async function markNoShow(prisma, sessionId, profileId) {
  const s = await load(guarded(prisma), sessionId, profileId);
  if (s.status !== "scheduled") throw new CommandError("Only a booked session can be marked as a no-show.");
  if (s.startsAt.getTime() > Date.now()) throw new CommandError("A no-show can be marked once the session has started.");
  const percent = s.profile.noShowPercent;
  if (s.funding === "card") await refundCardDown(prisma, s.id, share(s.priceCents, percent), "No-show: charge reduced by your tutor\u2019s policy");
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId);
    const fresh = await load(tx, sessionId, profileId);
    if (fresh.status !== "scheduled") throw new CommandError("This session changed. Refresh and try again.");
    const charge = await chargeShare(tx, fresh, percent, "No-show");
    await tx.session.updateMany({ where: { id: fresh.id, status: "scheduled" }, data: { status: "no_show", cancelledBy: "none", ...charge } });
    return { status: "no_show", percent };
  });
}
async function onLiveInvoice(db, sessionId) {
  return await db.invoiceLine.count({ where: { sessionId, invoice: { status: { in: ["sent", "paid"] } } } }) > 0;
}
async function excuseSession(prisma, sessionId, profileId) {
  const db = guarded(prisma);
  const s = await load(db, sessionId, profileId);
  if (!["late_cancelled", "no_show"].includes(s.status)) throw new CommandError("Only a late cancellation or a no-show can be excused.");
  if (Date.now() - s.startsAt.getTime() > 30 * 864e5) throw new CommandError("A charge can be excused up to 30 days after the session.");
  if (await onLiveInvoice(db, s.id)) throw new CommandError("This charge is on a sent invoice. Void the invoice first.");
  if (s.funding === "card") await refundCardDown(prisma, s.id, 0, "Charge excused by your tutor");
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId);
    if (await onLiveInvoice(tx, s.id)) throw new CommandError("This charge is on a sent invoice. Void the invoice first.");
    await tx.invoiceLine.deleteMany({ where: { sessionId: s.id, invoice: { status: "draft" } } });
    if (s.funding === "package") await reverseCharge(tx, profileId, s.id, "Excused");
    const done = await tx.session.updateMany({ where: { id: s.id, status: s.status }, data: { status: "excused", chargedCents: 0, chargedMinutes: 0, billable: "no" } });
    if (!done.count) throw new CommandError("This session changed. Refresh and try again.");
    return { status: "excused" };
  });
}
async function reopenSession(prisma, sessionId, profileId) {
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId);
    const s = await load(tx, sessionId, profileId);
    if (s.status !== "completed") throw new CommandError("Only a completed session can be reopened.");
    if (!s.completedAt || Date.now() - s.completedAt.getTime() > 7 * 864e5) throw new CommandError("A session can be reopened up to 7 days after it was completed.");
    if (await onLiveInvoice(tx, s.id)) throw new CommandError("This session is on a sent invoice. Void the invoice first.");
    await tx.invoiceLine.deleteMany({ where: { sessionId: s.id, invoice: { status: "draft" } } });
    if (s.funding === "package") await reopenDebit(tx, profileId, s.id);
    await tx.session.updateMany({ where: { id: s.id, status: "completed" }, data: { status: "scheduled", completedAt: null, chargedCents: 0, chargedMinutes: 0, billable: "no" } });
    return { status: "scheduled" };
  });
}
async function topUpSeriesInLock(tx, seriesId, now = /* @__PURE__ */ new Date()) {
  const series = await tx.recurringSeries.findUnique({ where: { id: seriesId }, include: { students: { select: { id: true } } } });
  if (!series || series.status !== "active" || !series.sessionTypeId || !series.familyId) return { created: 0, skipped: [] };
  const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: series.profileId } });
  const type = await tx.sessionType.findUnique({ where: { id: series.sessionTypeId } });
  const family = await tx.family.findUnique({ where: { id: series.familyId }, select: { id: true, status: true, billingMode: true } });
  if (!type || !family) return { created: 0, skipped: [] };
  const today2 = businessDateKey(now, profile.timezone);
  const horizon = addDays(today2, WEEKS_AHEAD * 7);
  let date = series.generatedThrough ? addDays(series.generatedThrough, 1) : series.startsOn;
  if (date < today2) date = today2;
  while (dayIndexFor(date) !== series.dayOfWeek) date = addDays(date, 1);
  const skipped = [];
  let created = 0;
  let through = series.generatedThrough || addDays(series.startsOn, -1);
  for (; date <= horizon && (!series.endsOn || date <= series.endsOn); date = addDays(date, 7)) {
    through = date;
    let startsAt;
    try {
      startsAt = businessWallTime(date, series.startMinute, profile.timezone);
    } catch {
      skipped.push(date);
      continue;
    }
    if (startsAt.getTime() <= now.getTime()) continue;
    try {
      await bookInLock(tx, { profile, type, family, studentIds: series.students.map((s) => s.id), startsAt, actor: "series", mode: series.mode, seriesId: series.id });
      created++;
    } catch (e) {
      if (e instanceof CommandError) {
        skipped.push(date);
        continue;
      }
      throw e;
    }
  }
  if (series.endsOn && horizon >= series.endsOn) through = series.endsOn > through ? series.endsOn : through;
  const known = new Set((series.skippedDates || "").split("\n").filter(Boolean));
  skipped.forEach((d) => known.add(d));
  await tx.recurringSeries.update({ where: { id: series.id }, data: { generatedThrough: through, skippedDates: [...known].sort().join("\n") } });
  return { created, skipped };
}
async function topUpAllSeries(prisma, profileId) {
  const db = guarded(prisma);
  const profile = await db.tutorProfile.findUnique({ where: { id: profileId }, select: { timezone: true } });
  if (!profile) return;
  const horizon = addDays(businessDateKey(/* @__PURE__ */ new Date(), profile.timezone), WEEKS_AHEAD * 7 - 7);
  const due = await db.recurringSeries.findMany({ where: { profileId, status: "active", OR: [{ generatedThrough: "" }, { generatedThrough: { lt: horizon } }] }, select: { id: true, endsOn: true, generatedThrough: true }, take: 50 });
  for (const s of due) {
    if (s.endsOn && s.generatedThrough && s.generatedThrough >= s.endsOn) continue;
    await transaction(prisma, async (tx) => {
      await lockTutorBooking(tx, profileId);
      await topUpSeriesInLock(tx, s.id);
    });
  }
}
async function cancelFutureSeriesSessions(prisma, seriesId, profileId) {
  const db = guarded(prisma);
  const future = await db.session.findMany({ where: { seriesId, profileId, status: "scheduled", startsAt: { gt: /* @__PURE__ */ new Date() } }, select: { id: true }, take: 200 });
  let cancelled = 0;
  for (const s of future) {
    await cancelSession(prisma, { sessionId: s.id, by: "tutor", profileId, reason: "Weekly series paused or ended" }).then(() => cancelled++).catch((e) => console.error("[tutor] series cancel failed", e instanceof Error ? e.message : e));
  }
  return cancelled;
}
var holdingTime, FAMILY_SAFE_STATUSES, minutesOf, WEEKS_AHEAD;
var init_booking = __esm({
  "features/keystone/utils/booking.ts"() {
    "use strict";
    init_availability();
    init_business();
    init_ledger();
    init_payments();
    init_publicAccessToken();
    holdingTime = (now = /* @__PURE__ */ new Date()) => ({
      OR: [
        { status: { in: ["scheduled", "completed", "no_show"] } },
        { status: "pending_payment", holdEndsAt: { gt: now } }
      ]
    });
    FAMILY_SAFE_STATUSES = ["scheduled", "pending_payment"];
    minutesOf = (s) => Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 6e4);
    WEEKS_AHEAD = 8;
  }
});

// features/keystone/utils/family.ts
var family_exports = {};
__export(family_exports, {
  calendarFeedToken: () => calendarFeedToken,
  claimFamilyAccount: () => claimFamilyAccount,
  cleanVisitor: () => cleanVisitor,
  familyForVisitor: () => familyForVisitor,
  handInHomework: () => handInHomework,
  hashPublicAccessToken: () => hashPublicAccessToken,
  inviteFamily: () => inviteFamily,
  requireFamily: () => requireFamily,
  resolveCalendarFeed: () => resolveCalendarFeed,
  saveStudent: () => saveStudent,
  submitReview: () => submitReview,
  updateMyContact: () => updateMyContact
});
async function requireFamily(db, session) {
  if (!session?.itemId) throw new CommandError("Sign in to your family account.");
  const family = await db.family.findFirst({ where: { userId: session.itemId }, include: { profile: true } });
  if (!family) throw new CommandError("This account is not linked to a family. Use the link your tutor sent you.");
  return family;
}
async function familyForVisitor(tx, profileId, input) {
  const email = input.email;
  const phone = input.phone;
  let family = await tx.family.findFirst({ where: { profileId, OR: [...email ? [{ email: { equals: email, mode: "insensitive" } }] : [], ...phone ? [{ phone }] : []] } });
  if (family?.status === "blocked") throw new CommandError("This time can\u2019t be booked online. Contact your tutor.");
  family ??= await tx.family.create({ data: { profileId, guardianName: input.guardianName, email, phone, timezone: input.timezone || "", status: "lead" } });
  const [first, ...rest] = input.studentName.split(/\s+/);
  let student = await tx.student.findFirst({ where: { familyId: family.id, firstName: { equals: first, mode: "insensitive" } } });
  student ??= await tx.student.create({ data: { profileId, familyId: family.id, firstName: first, lastName: rest.join(" "), level: input.studentLevel, goals: input.needs ?? "" } });
  return { family, student };
}
function cleanVisitor(input) {
  const guardianName = cleanText(input.guardianName, 120);
  const email = cleanEmail(input.email);
  const phone = cleanText(input.phone, 40);
  const studentName = cleanText(input.studentName, 120);
  if (!guardianName) throw new CommandError("Enter your name.");
  if (!email && !phone) throw new CommandError("Enter an email or a phone number so your tutor can reach you.");
  if (!studentName) throw new CommandError("Enter the student\u2019s name.");
  return { guardianName, email, phone, studentName, studentLevel: cleanText(input.studentLevel, 80), needs: cleanText(input.needs, 1e3) };
}
async function inviteFamily(db, profileId, familyId) {
  const family = await db.family.findFirst({ where: { id: familyId, profileId }, select: { id: true, userId: true, email: true, guardianName: true } });
  if (!family) throw new CommandError("Choose a family.");
  if (family.userId) throw new CommandError("This family already has an account. They can reset their password from the sign-in page.");
  const access = createPublicAccessToken();
  await db.family.update({ where: { id: family.id }, data: { inviteTokenHash: access.hash } });
  return { familyId: family.id, token: access.token, email: family.email, guardianName: family.guardianName };
}
async function claimFamilyAccount(prisma, context, input) {
  const db = guarded(prisma);
  let familyId = null;
  if (input.familyId && input.token) {
    const f = await db.family.findUnique({ where: { id: input.familyId }, select: { id: true, inviteTokenHash: true } });
    if (f && publicAccessTokenMatches(input.token, f.inviteTokenHash)) familyId = f.id;
  } else if (input.bookingId && input.bookingToken) {
    const s = await db.session.findUnique({ where: { id: input.bookingId }, select: { familyId: true, publicAccessTokenHash: true } });
    if (s && publicAccessTokenMatches(input.bookingToken, s.publicAccessTokenHash)) familyId = s.familyId;
  }
  if (!familyId) throw new CommandError("This link is not valid. Ask your tutor for a new invite.");
  const password2 = String(input.password || "");
  if (password2.length < 8) throw new CommandError("Choose a password of at least 8 characters.");
  const { FAMILY_ROLE: FAMILY_ROLE2 } = await Promise.resolve().then(() => (init_access(), access_exports));
  return transaction(prisma, async (tx) => {
    await lockFamily(tx, familyId);
    const family = await tx.family.findUniqueOrThrow({ where: { id: familyId } });
    if (family.userId) throw new CommandError("This family already has an account. Sign in, or reset your password.");
    if (family.status === "blocked") throw new CommandError("Contact your tutor.");
    const email = cleanEmail(input.email || family.email);
    if (!email) throw new CommandError("Enter your email. You sign in with it.");
    if (await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) throw new CommandError("An account with this email already exists. Sign in instead.");
    const sudo = context.sudo();
    const role = (await sudo.db.Role.findMany({ where: { name: { equals: FAMILY_ROLE2.name } }, take: 1 }))[0] ?? await sudo.db.Role.createOne({ data: { ...FAMILY_ROLE2 } });
    const user = await sudo.db.User.createOne({ data: { name: cleanText(input.name, 120) || family.guardianName, email, password: password2, role: { connect: { id: role.id } }, onboardingStatus: "done" } });
    const linked = await tx.family.updateMany({ where: { id: family.id, userId: null }, data: { userId: user.id, inviteTokenHash: "", email, status: family.status === "lead" ? "active" : family.status } });
    if (!linked.count) throw new CommandError("This family already has an account.");
    return { email };
  });
}
async function updateMyContact(db, familyId, input) {
  const data = {};
  if (input.guardianName !== void 0) {
    data.guardianName = cleanText(input.guardianName, 120);
    if (!data.guardianName) throw new CommandError("Enter your name.");
  }
  if (input.phone !== void 0) data.phone = cleanText(input.phone, 40);
  if (input.secondContactName !== void 0) data.secondContactName = cleanText(input.secondContactName, 120);
  if (input.secondContactPhone !== void 0) data.secondContactPhone = cleanText(input.secondContactPhone, 40);
  if (input.address !== void 0) data.address = cleanText(input.address, 500);
  if (input.timezone !== void 0) data.timezone = validTimeZone(input.timezone);
  await db.family.update({ where: { id: familyId }, data });
  return { saved: true };
}
async function saveStudent(db, family, input) {
  const firstName = cleanText(input.firstName, 80);
  if (!firstName) throw new CommandError("Enter the student\u2019s first name.");
  const birth = input.birthYear == null || input.birthYear === "" ? null : Number(input.birthYear);
  if (birth !== null && (!Number.isInteger(birth) || birth < 1900 || birth > 2100)) throw new CommandError("Enter a valid birth year.");
  const data = { firstName, lastName: cleanText(input.lastName, 80), level: cleanText(input.level, 80), school: cleanText(input.school, 120), goals: cleanText(input.goals, 1e3), birthYear: birth };
  if (input.id) {
    const done = await db.student.updateMany({ where: { id: input.id, familyId: family.id }, data });
    if (!done.count) throw new CommandError("Student not found.");
    return { id: input.id };
  }
  if (await db.student.count({ where: { familyId: family.id } }) >= 12) throw new CommandError("Ask your tutor to add more students.");
  const s = await db.student.create({ data: { ...data, profileId: family.profileId, familyId: family.id } });
  return { id: s.id };
}
async function handInHomework(db, familyId, input) {
  const url = cleanUrl(input.url);
  const done = await db.homework.updateMany({ where: { id: input.id, student: { familyId }, status: "assigned" }, data: { status: "handed_in", handedInAt: /* @__PURE__ */ new Date(), guardianComment: cleanText(input.comment, 1e3), handInUrl: url } });
  if (!done.count) throw new CommandError("This homework is not open to hand in.");
  return { id: input.id, status: "handed_in" };
}
async function submitReview(prisma, family, input) {
  const rating = Math.floor(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) throw new CommandError("Choose 1 to 5 stars.");
  return transaction(prisma, async (tx) => {
    await lockFamily(tx, family.id);
    const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: family.profileId }, select: { reviewsEnabled: true } });
    if (!profile.reviewsEnabled) throw new CommandError("Reviews are turned off.");
    if (await tx.session.count({ where: { familyId: family.id, status: "completed" } }) < REVIEW_AFTER) throw new CommandError(`You can write a review after ${REVIEW_AFTER} sessions.`);
    if (await tx.review.count({ where: { familyId: family.id } })) throw new CommandError("You already wrote a review. Thank you!");
    const r = await tx.review.create({ data: { profileId: family.profileId, familyId: family.id, rating, body: cleanText(input.body, 2e3), displayName: cleanText(input.displayName, 80) || "A parent", status: "pending" } });
    return { id: r.id, status: "pending" };
  });
}
async function calendarFeedToken(db, who) {
  const access = createPublicAccessToken();
  if (who.kind === "family") await db.family.update({ where: { id: who.id }, data: { calendarTokenHash: access.hash } });
  else await db.tutorProfile.update({ where: { id: who.id }, data: { calendarTokenHash: access.hash } });
  return `${who.kind === "family" ? "f" : "t"}.${who.id}.${access.token}`;
}
async function resolveCalendarFeed(db, raw) {
  const [kind, id, token] = raw.replace(/\.ics$/, "").split(".");
  if (!id || !token) return null;
  if (kind === "f") {
    const f = await db.family.findUnique({ where: { id }, select: { id: true, calendarTokenHash: true, profileId: true, guardianName: true } });
    return f && publicAccessTokenMatches(token, f.calendarTokenHash) ? { kind: "family", familyId: f.id, profileId: f.profileId, name: f.guardianName } : null;
  }
  if (kind === "t") {
    const p = await db.tutorProfile.findUnique({ where: { id }, select: { id: true, calendarTokenHash: true, businessName: true } });
    return p && publicAccessTokenMatches(token, p.calendarTokenHash) ? { kind: "tutor", profileId: p.id, name: p.businessName } : null;
  }
  return null;
}
var REVIEW_AFTER;
var init_family = __esm({
  "features/keystone/utils/family.ts"() {
    "use strict";
    init_business();
    init_publicAccessToken();
    REVIEW_AFTER = 3;
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core12 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields = require("@keystone-6/core/fields");
init_access();
var User = (0, import_core.list)({
  access: {
    operation: {
      ...(0, import_access.allOperations)(isSignedIn),
      // Families get accounts through `claimFamilyAccount`; open sign-up is the starter's opt-in.
      create: (args) => process.env.PUBLIC_SIGNUPS_ALLOWED === "true" || permissions.canManagePeople(args),
      delete: permissions.canManagePeople
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePeople(args),
    hideDelete: (args) => !permissions.canManagePeople(args),
    listView: { initialColumns: ["name", "email", "role"] },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople) return "edit";
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  hooks: {
    resolveInput: async ({ operation, resolvedData, context }) => {
      const session = context.session;
      if (operation !== "create" || session?.data?.role?.canManagePeople) return resolvedData;
      const sudo = context.sudo();
      if (await sudo.db.User.count({}) === 0) return resolvedData;
      const found = (await sudo.db.Role.findMany({ where: { name: { equals: FAMILY_ROLE.name } }, take: 1 }))[0];
      const role = found ?? await sudo.db.Role.createOne({ data: { ...FAMILY_ROLE } });
      return { ...resolvedData, role: { connect: { id: role.id } } };
    }
  },
  fields: {
    name: (0, import_fields.text)({ validation: { isRequired: true } }),
    email: (0, import_fields.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: { isRequired: true }
    }),
    password: (0, import_fields.password)({
      access: {
        read: import_access.denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: permissions.canManagePeople,
        update: permissions.canManagePeople
      },
      ui: { itemView: { fieldMode: (args) => permissions.canManagePeople(args) ? "edit" : "read" } }
    }),
    tutorProfile: (0, import_fields.relationship)({ ref: "TutorProfile.owner", access: { create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    family: (0, import_fields.relationship)({ ref: "Family.user", access: { create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    onboardingStatus: (0, import_fields.select)({
      type: "enum",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "Done", value: "done" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      access: { update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id }
    })
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");
init_access();
var Role = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access3.allOperations)(permissions.canManageRoles),
      query: isSignedIn
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: { initialColumns: ["name", "assignedTo"] },
    itemView: { defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read" }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    canSeeOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields2.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManageBusiness: (0, import_fields2.checkbox)({ defaultValue: false, ui: { description: "Business details, session types, packages, hours, time off." } }),
    canManageFamilies: (0, import_fields2.checkbox)({ defaultValue: false, ui: { description: "Families, students, inquiries, reviews, package balances." } }),
    canManageSessions: (0, import_fields2.checkbox)({ defaultValue: false, ui: { description: "Sessions, notes, homework, marks, resources, series." } }),
    canManagePayments: (0, import_fields2.checkbox)({ defaultValue: false }),
    canViewEarnings: (0, import_fields2.checkbox)({ defaultValue: false }),
    assignedTo: (0, import_fields2.relationship)({ ref: "User.role", many: true, ui: { itemView: { fieldMode: "read" } } })
  }
});

// features/keystone/models/OAuthApp.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
init_access();

// features/keystone/models/trackingFields.ts
var import_fields3 = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields3.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields3.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/mcp-oauth/core.ts
var import_node_crypto = __toESM(require("node:crypto"));
var MCP_SCOPES = ["mcp:read", "mcp:write"];
var MCP_ACCESS_PREFIX = "mcp_at_";
var ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
var REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1e3;
var CONSENT_TICKET_TTL_MS = 10 * 60 * 1e3;
var DEVELOPMENT_SECRET = "this secret should only be used in testing";
function secret() {
  return process.env.SESSION_SECRET || DEVELOPMENT_SECRET;
}
function randomToken(prefix, bytes = 32) {
  return `${prefix}${import_node_crypto.default.randomBytes(bytes).toString("base64url")}`;
}
function digestToken(token, purpose = "mcp-oauth-token") {
  return import_node_crypto.default.createHmac("sha256", secret()).update(`${purpose}\0${token}`, "utf8").digest("hex");
}
function bearerToken(header) {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return match ? match[1] : null;
}
function isMcpAccessToken(token) {
  return typeof token === "string" && token.startsWith(MCP_ACCESS_PREFIX) && token.length > MCP_ACCESS_PREFIX.length;
}
function storedScopes(value) {
  return Array.isArray(value) ? MCP_SCOPES.filter((scope) => value.includes(scope)) : [];
}

// features/keystone/models/OAuthApp.ts
var OAuthApp = (0, import_core3.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    name: (0, import_fields4.text)({
      validation: {
        isRequired: true
      }
    }),
    clientId: (0, import_fields4.text)({
      isIndexed: "unique",
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation === "create" && !resolvedData.clientId) {
            return randomToken("mcp_cl_", 18);
          }
          return resolvedData.clientId;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Auto-generated unique identifier for your application."
      }
    }),
    clientSecret: (0, import_fields4.text)({
      access: {
        read: () => false
      },
      hooks: {
        resolveInput: ({ resolvedData }) => {
          if (resolvedData.clientSecret) {
            return digestToken(resolvedData.clientSecret, "oauth-client-secret");
          }
          return void 0;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        description: "Stored only as a digest. Public MCP clients have no secret."
      }
    }),
    tokenEndpointAuthMethod: (0, import_fields4.select)({
      options: [
        { label: "Client secret (POST)", value: "client_secret_post" },
        { label: "Client secret (Basic)", value: "client_secret_basic" },
        { label: "None (public PKCE client)", value: "none" }
      ],
      defaultValue: "client_secret_post",
      ui: {
        description: "How the app authenticates at the token endpoint. MCP clients are public (none)."
      }
    }),
    redirectUris: (0, import_fields4.json)({
      defaultValue: [],
      ui: {
        description: "Array of allowed redirect URIs for OAuth callbacks"
      }
    }),
    scopes: (0, import_fields4.json)({
      defaultValue: [...MCP_SCOPES],
      ui: {
        description: "Array of allowed OAuth scopes. MCP scopes only narrow the signed-in user's own access."
      }
    }),
    webhookUrl: (0, import_fields4.text)({
      ui: {
        description: "URL to receive webhook notifications"
      }
    }),
    status: (0, import_fields4.select)({
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Pending", value: "pending" }
      ],
      defaultValue: "active"
    }),
    installUrl: (0, import_fields4.text)({
      ui: {
        description: "URL where users can install this app"
      }
    }),
    uninstallUrl: (0, import_fields4.text)({
      ui: {
        description: "URL to handle app uninstallation"
      }
    }),
    description: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    metadata: (0, import_fields4.json)({
      defaultValue: {},
      ui: {
        description: "Additional app-specific configuration and settings"
      }
    }),
    developerEmail: (0, import_fields4.text)(),
    privacyPolicyUrl: (0, import_fields4.text)(),
    termsOfServiceUrl: (0, import_fields4.text)(),
    supportUrl: (0, import_fields4.text)(),
    ...trackingFields
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "clientId", "status", "createdAt"]
    }
  }
});

// features/keystone/models/OAuthToken.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
init_access();
var digestTokenInput = {
  resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] ? digestToken(resolvedData[fieldKey]) : resolvedData[fieldKey]
};
var OAuthToken = (0, import_core5.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    tokenType: (0, import_fields5.select)({
      options: [
        { label: "Authorization Code", value: "authorization_code" },
        { label: "Access Token", value: "access_token" },
        { label: "Refresh Token", value: "refresh_token" }
      ],
      validation: {
        isRequired: true
      }
    }),
    token: (0, import_fields5.text)({
      access: { read: () => false },
      validation: {
        isRequired: true
      },
      isIndexed: "unique",
      hooks: digestTokenInput
    }),
    clientId: (0, import_fields5.text)({
      validation: {
        isRequired: true
      },
      isIndexed: true
    }),
    user: (0, import_fields5.relationship)({
      ref: "User",
      ui: {
        description: "The user who authorized this token"
      }
    }),
    scopes: (0, import_fields5.json)({
      defaultValue: [],
      ui: {
        description: "Array of granted scopes"
      }
    }),
    redirectUri: (0, import_fields5.text)({
      ui: {
        description: "The redirect URI used during authorization"
      }
    }),
    resource: (0, import_fields5.text)({
      ui: {
        description: "The MCP endpoint (RFC 8707 resource) this grant is for"
      }
    }),
    expiresAt: (0, import_fields5.timestamp)({
      ui: {
        description: "When this token expires"
      }
    }),
    isRevoked: (0, import_fields5.select)({
      options: [
        { label: "Active", value: "false" },
        { label: "Revoked", value: "true" }
      ],
      defaultValue: "false"
    }),
    authorizationCode: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "The authorization code that was exchanged for this token (for access tokens)"
      }
    }),
    refreshToken: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated refresh token (for access tokens)"
      }
    }),
    accessToken: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated access token (for refresh tokens)"
      }
    }),
    state: (0, import_fields5.text)({
      ui: {
        description: "OAuth state parameter for CSRF protection"
      }
    }),
    codeChallenge: (0, import_fields5.text)({
      ui: {
        description: "PKCE code challenge"
      }
    }),
    codeChallengeMethod: (0, import_fields5.select)({
      options: [
        { label: "Plain", value: "plain" },
        { label: "SHA256", value: "S256" }
      ],
      ui: {
        description: "PKCE code challenge method"
      }
    }),
    ...trackingFields
  },
  ui: {
    labelField: "clientId",
    listView: {
      initialColumns: ["tokenType", "clientId", "user", "scopes", "expiresAt", "isRevoked"]
    }
  }
});

// features/keystone/models/business.ts
var import_core7 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
init_access();

// features/keystone/utils/ownership.ts
function ownProfileFilter({ session }) {
  if (!session) return false;
  return { profile: { owner: { id: { equals: session.itemId } } } };
}
function ownerFilter({ session }) {
  if (!session) return false;
  return { owner: { id: { equals: session.itemId } } };
}
async function attachOwnProfile({ operation, resolvedData, context }) {
  if (operation !== "create") return resolvedData;
  const userId = context.session?.itemId;
  if (!userId) throw new Error("Sign in first.");
  const [profile] = await context.sudo().query.TutorProfile.findMany({ where: { owner: { id: { equals: userId } } }, take: 1, query: "id" });
  if (!profile) throw new Error("Set up your business first.");
  return { ...resolvedData, profile: { connect: { id: profile.id } } };
}

// features/keystone/models/fields.ts
var import_fields6 = require("@keystone-6/core/fields");
init_access();
var no = () => false;
var fieldKit = {
  get commandOnly() {
    return {
      access: { create: no, update: no },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
    };
  },
  /** Never readable or writable through the generic API. */
  get secret() {
    return {
      access: { read: no, create: no, update: no },
      ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } }
    };
  }
};
function profileField(backRef) {
  return (0, import_fields6.relationship)({
    ref: `TutorProfile.${backRef}`,
    db: { foreignKey: true, extendPrismaSchema: (schema) => schema.replaceAll("?", "") },
    access: { create: no, update: no },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
  });
}
var ownedMany = (ref) => (0, import_fields6.relationship)({ ref, many: true, access: { create: no, update: no }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" } } });
function ownCrud(perm, opts = {}) {
  return {
    operation: { query: perm, create: perm, update: perm, delete: opts.delete === false ? no : perm },
    filter: { query: ownProfileFilter, update: ownProfileFilter, delete: ownProfileFilter }
  };
}
function ownReadOnly(perm = permissions.canReadPayments) {
  return {
    operation: { query: perm, create: no, update: no, delete: no },
    filter: { query: ownProfileFilter }
  };
}
var attachProfileHook = { resolveInput: attachOwnProfile };
function sameProfileHooks(checks) {
  return {
    resolveInput: attachOwnProfile,
    validateInput: async ({ resolvedData, context, addValidationError }) => {
      const userId = context.session?.itemId;
      if (!userId) return;
      for (const { field, list: list9 } of checks) {
        const value = resolvedData[field];
        if (!value) continue;
        const raw = [value.connect, value.set].flat().filter(Boolean);
        const ids = raw.map((v) => v.id).filter((v) => typeof v === "string");
        if (!ids.length) continue;
        const count = await context.sudo().db[list9].count({ where: { id: { in: ids }, profile: { owner: { id: { equals: userId } } } } });
        if (count !== new Set(ids).size) addValidationError(`${field}: choose from your own records.`);
      }
    }
  };
}

// features/keystone/models/business.ts
var no2 = () => false;
var textarea = { ui: { displayMode: "textarea" } };
var TutorProfile = (0, import_core7.list)({
  access: {
    operation: { query: permissions.canManageBusiness, create: no2, update: permissions.canManageBusiness, delete: no2 },
    filter: { query: ownerFilter, update: ownerFilter }
  },
  ui: { labelField: "businessName", listView: { initialColumns: ["businessName", "slug", "timezone", "bookingOpen"] } },
  fields: {
    owner: (0, import_fields7.relationship)({ ref: "User.tutorProfile", ...fieldKit.commandOnly }),
    businessName: (0, import_fields7.text)({ validation: { isRequired: true } }),
    tutorName: (0, import_fields7.text)({ ui: { description: "Your own name as families see it." } }),
    slug: (0, import_fields7.text)({
      isIndexed: "unique",
      validation: { isRequired: true, match: { regex: /^[a-z0-9][a-z0-9-]{1,40}$/, explanation: "Use lowercase letters, numbers and hyphens (2 to 41 characters)." } },
      ui: { description: "Your page address: /t/<this>." }
    }),
    headline: (0, import_fields7.text)(),
    bio: (0, import_fields7.text)(textarea),
    photoUrl: (0, import_fields7.text)({ ui: { description: "Your profile photo: an image address, e.g. /storefront/tutor.webp or https://\u2026" } }),
    heroImageUrl: (0, import_fields7.text)({ ui: { description: "The large picture at the top of your page: an image address (https://\u2026 or /storefront/\u2026)." } }),
    qualifications: (0, import_fields7.text)(textarea),
    phone: (0, import_fields7.text)(),
    email: (0, import_fields7.text)(),
    city: (0, import_fields7.text)(),
    country: (0, import_fields7.text)({ ui: { description: "Two-letter country code, e.g. US, PK, GB." } }),
    timezone: (0, import_fields7.text)({ defaultValue: "America/New_York", validation: { isRequired: true } }),
    currencyCode: (0, import_fields7.text)({ defaultValue: "USD", validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "A three-letter currency code, e.g. USD." } } }),
    teachesOnline: (0, import_fields7.checkbox)({ defaultValue: true }),
    teachesInPerson: (0, import_fields7.checkbox)({ defaultValue: false }),
    inPersonArea: (0, import_fields7.text)({ ui: { description: 'Where you teach in person, e.g. "North Austin and Round Rock".' } }),
    defaultMeetingUrl: (0, import_fields7.text)({ ui: { description: "Your Zoom room, Google Meet or any lesson link." } }),
    bookingOpen: (0, import_fields7.checkbox)({ defaultValue: true, ui: { description: "Families can book from your page." } }),
    slotMinutes: (0, import_fields7.integer)({ defaultValue: 30, validation: { isRequired: true, min: 5, max: 120 } }),
    bufferMinutes: (0, import_fields7.integer)({ defaultValue: 10, validation: { isRequired: true, min: 0, max: 120 } }),
    minNoticeHours: (0, import_fields7.integer)({ defaultValue: 12, validation: { isRequired: true, min: 0, max: 720 } }),
    maxAdvanceDays: (0, import_fields7.integer)({ defaultValue: 60, validation: { isRequired: true, min: 1, max: 365 } }),
    cancellationWindowHours: (0, import_fields7.integer)({ defaultValue: 24, validation: { isRequired: true, min: 0, max: 168 } }),
    lateCancelPercent: (0, import_fields7.integer)({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 100 } }),
    noShowPercent: (0, import_fields7.integer)({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 100 } }),
    unpaidHoldMinutes: (0, import_fields7.integer)({ defaultValue: 60, validation: { isRequired: true, min: 30, max: 1440 }, ui: { description: "How long an online booking waiting for card payment keeps its time (30 to 1440 minutes)." } }),
    reschedulesAllowed: (0, import_fields7.integer)({ defaultValue: 2, validation: { isRequired: true, min: 0, max: 10 } }),
    paymentInstructions: (0, import_fields7.text)({ ui: { displayMode: "textarea", description: "How families pay you directly: bank transfer, Zelle, JazzCash, M-Pesa\u2026" } }),
    policiesText: (0, import_fields7.text)(textarea),
    invoiceDueDays: (0, import_fields7.integer)({ defaultValue: 7, validation: { isRequired: true, min: 0, max: 90 } }),
    invoiceCounter: (0, import_fields7.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    reviewsEnabled: (0, import_fields7.checkbox)({ defaultValue: true }),
    calendarTokenHash: (0, import_fields7.text)(fieldKit.secret),
    subjects: ownedMany("Subject.profile"),
    sessionTypes: ownedMany("SessionType.profile"),
    weeklyHours: ownedMany("WeeklyHours.profile"),
    timeOff: ownedMany("TimeOff.profile"),
    packages: ownedMany("Package.profile"),
    families: ownedMany("Family.profile"),
    students: ownedMany("Student.profile"),
    inquiries: ownedMany("Inquiry.profile"),
    reviews: ownedMany("Review.profile"),
    sessions: ownedMany("Session.profile"),
    sessionNotes: ownedMany("SessionNote.profile"),
    homework: ownedMany("Homework.profile"),
    progressMarks: ownedMany("ProgressMark.profile"),
    resources: ownedMany("Resource.profile"),
    series: ownedMany("RecurringSeries.profile"),
    purchases: ownedMany("PackagePurchase.profile"),
    creditEntries: ownedMany("CreditEntry.profile"),
    invoices: ownedMany("Invoice.profile"),
    invoiceLines: ownedMany("InvoiceLine.profile"),
    payments: ownedMany("Payment.profile"),
    paymentProviders: ownedMany("PaymentProvider.profile"),
    paymentSessions: ownedMany("PaymentSession.profile"),
    expenses: ownedMany("Expense.profile"),
    notifications: ownedMany("NotificationLog.profile"),
    ...trackingFields
  }
});
var Subject = (0, import_core7.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ["name", "levels", "active", "sortOrder"] } },
  fields: {
    profile: profileField("subjects"),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    levels: (0, import_fields7.text)({ ui: { description: 'e.g. "Grades 6 to 12", "IGCSE and A level".' } }),
    description: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    imageUrl: (0, import_fields7.text)({ ui: { description: "Optional picture for this subject: an image address." } }),
    sortOrder: (0, import_fields7.integer)({ defaultValue: 0 }),
    active: (0, import_fields7.checkbox)({ defaultValue: true }),
    sessionTypes: (0, import_fields7.relationship)({ ref: "SessionType.subjects", many: true }),
    students: (0, import_fields7.relationship)({ ref: "Student.subjects", many: true }),
    ...trackingFields
  }
});
var SessionType = (0, import_core7.list)({
  hooks: sameProfileHooks([{ field: "subjects", list: "Subject" }]),
  access: ownCrud(permissions.canManageBusiness, { delete: false }),
  ui: { listView: { initialColumns: ["name", "durationMinutes", "priceCents", "mode", "openToNewFamilies", "active"] } },
  fields: {
    profile: profileField("sessionTypes"),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    description: (0, import_fields7.text)(textarea),
    durationMinutes: (0, import_fields7.integer)({ defaultValue: 60, validation: { isRequired: true, min: 10, max: 480 } }),
    priceCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 1e7 }, ui: { description: "Price in minor units (cents). 0 is free." } }),
    mode: (0, import_fields7.select)({ type: "enum", options: [{ label: "Online", value: "online" }, { label: "In person", value: "in_person" }, { label: "Either", value: "either" }], defaultValue: "online", validation: { isRequired: true } }),
    openToNewFamilies: (0, import_fields7.checkbox)({ defaultValue: false, ui: { description: "New families may book this type from your page." } }),
    maxStudents: (0, import_fields7.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 4 }, ui: { description: "Siblings from one family in one session (1 to 4)." } }),
    subjects: (0, import_fields7.relationship)({ ref: "Subject.sessionTypes", many: true }),
    packages: (0, import_fields7.relationship)({ ref: "Package.appliesTo", many: true, ...fieldKit.commandOnly }),
    active: (0, import_fields7.checkbox)({ defaultValue: true }),
    sortOrder: (0, import_fields7.integer)({ defaultValue: 0 }),
    sessions: (0, import_fields7.relationship)({ ref: "Session.sessionType", many: true, ...fieldKit.commandOnly }),
    series: (0, import_fields7.relationship)({ ref: "RecurringSeries.sessionType", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});
var WeeklyHours = (0, import_core7.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  graphql: { plural: "WeeklyHoursRows" },
  ui: { listView: { initialColumns: ["dayOfWeek", "isWorking", "startMinute", "endMinute"] } },
  fields: {
    profile: profileField("weeklyHours"),
    dayOfWeek: (0, import_fields7.select)({
      type: "enum",
      options: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value })),
      validation: { isRequired: true }
    }),
    isWorking: (0, import_fields7.checkbox)({ defaultValue: true }),
    startMinute: (0, import_fields7.integer)({ defaultValue: 900, validation: { isRequired: true, min: 0, max: 1439 }, ui: { description: "Minutes after midnight (900 = 3:00 PM)." } }),
    endMinute: (0, import_fields7.integer)({ defaultValue: 1200, validation: { isRequired: true, min: 1, max: 1440 }, ui: { description: "Minutes after midnight (1200 = 8:00 PM)." } }),
    breakStartMinute: (0, import_fields7.integer)({ validation: { min: 0, max: 1439 } }),
    breakEndMinute: (0, import_fields7.integer)({ validation: { min: 1, max: 1440 } }),
    ...trackingFields
  }
});
var TimeOff = (0, import_core7.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ["startsAt", "endsAt", "reason"] } },
  fields: {
    profile: profileField("timeOff"),
    startsAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    reason: (0, import_fields7.text)(),
    ...trackingFields
  }
});
var Package = (0, import_core7.list)({
  hooks: sameProfileHooks([{ field: "appliesTo", list: "SessionType" }]),
  access: ownCrud(permissions.canManageBusiness, { delete: false }),
  ui: { listView: { initialColumns: ["name", "minutes", "priceCents", "validMonths", "active"] } },
  fields: {
    profile: profileField("packages"),
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    description: (0, import_fields7.text)(textarea),
    minutes: (0, import_fields7.integer)({ validation: { isRequired: true, min: 30, max: 6e4 }, ui: { description: "Prepaid minutes (600 = 10 hours)." } }),
    priceCents: (0, import_fields7.integer)({ validation: { isRequired: true, min: 0, max: 1e8 } }),
    validMonths: (0, import_fields7.integer)({ defaultValue: 12, validation: { isRequired: true, min: 1, max: 60 } }),
    appliesTo: (0, import_fields7.relationship)({ ref: "SessionType.packages", many: true, ui: { description: "Leave empty to use on any session type." } }),
    active: (0, import_fields7.checkbox)({ defaultValue: true }),
    sortOrder: (0, import_fields7.integer)({ defaultValue: 0 }),
    purchases: (0, import_fields7.relationship)({ ref: "PackagePurchase.package", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});

// features/keystone/models/people.ts
var import_core8 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
init_access();
var textarea2 = { ui: { displayMode: "textarea" } };
var opt = (...values) => values.map((value) => ({ label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value }));
var Family = (0, import_core8.list)({
  hooks: sameProfileHooks([]),
  access: ownCrud(permissions.canManageFamilies, { delete: false }),
  ui: { labelField: "guardianName", listView: { initialColumns: ["guardianName", "email", "phone", "status", "billingMode"] } },
  fields: {
    profile: profileField("families"),
    guardianName: (0, import_fields9.text)({ validation: { isRequired: true } }),
    email: (0, import_fields9.text)({ isIndexed: true }),
    phone: (0, import_fields9.text)(),
    secondContactName: (0, import_fields9.text)(),
    secondContactPhone: (0, import_fields9.text)(),
    status: (0, import_fields9.select)({ type: "enum", options: opt("lead", "active", "paused", "former", "blocked"), defaultValue: "lead", validation: { isRequired: true } }),
    billingMode: (0, import_fields9.select)({ type: "enum", options: opt("pay_as_you_book", "invoice", "flat_monthly"), defaultValue: "pay_as_you_book", validation: { isRequired: true } }),
    monthlyFeeCents: (0, import_fields9.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 1e8 }, ui: { description: "Fixed monthly fee in minor units (flat monthly billing only)." } }),
    address: (0, import_fields9.text)({ ui: { displayMode: "textarea", description: "For in-person lessons." } }),
    timezone: (0, import_fields9.text)(),
    howTheyFoundMe: (0, import_fields9.text)(),
    privateNotes: (0, import_fields9.text)({ ui: { displayMode: "textarea", description: "Only you see this." } }),
    user: (0, import_fields9.relationship)({ ref: "User.family", ...fieldKit.commandOnly }),
    inviteTokenHash: (0, import_fields9.text)(fieldKit.secret),
    calendarTokenHash: (0, import_fields9.text)(fieldKit.secret),
    students: (0, import_fields9.relationship)({ ref: "Student.family", many: true, ...fieldKit.commandOnly }),
    sessions: (0, import_fields9.relationship)({ ref: "Session.family", many: true, ...fieldKit.commandOnly }),
    series: (0, import_fields9.relationship)({ ref: "RecurringSeries.family", many: true, ...fieldKit.commandOnly }),
    purchases: (0, import_fields9.relationship)({ ref: "PackagePurchase.family", many: true, ...fieldKit.commandOnly }),
    invoices: (0, import_fields9.relationship)({ ref: "Invoice.family", many: true, ...fieldKit.commandOnly }),
    payments: (0, import_fields9.relationship)({ ref: "Payment.family", many: true, ...fieldKit.commandOnly }),
    reviews: (0, import_fields9.relationship)({ ref: "Review.family", many: true, ...fieldKit.commandOnly }),
    inquiries: (0, import_fields9.relationship)({ ref: "Inquiry.family", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});
var Student = (0, import_core8.list)({
  hooks: sameProfileHooks([{ field: "family", list: "Family" }, { field: "subjects", list: "Subject" }]),
  access: ownCrud(permissions.canManageFamilies, { delete: false }),
  ui: { labelField: "firstName", listView: { initialColumns: ["firstName", "lastName", "family", "level", "status"] } },
  fields: {
    profile: profileField("students"),
    family: (0, import_fields9.relationship)({ ref: "Family.students", db: { foreignKey: true } }),
    firstName: (0, import_fields9.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields9.text)(),
    level: (0, import_fields9.text)({ ui: { description: 'Grade or year, e.g. "Grade 10", "Year 11".' } }),
    school: (0, import_fields9.text)(),
    birthYear: (0, import_fields9.integer)({ validation: { min: 1900, max: 2100 } }),
    goals: (0, import_fields9.text)(textarea2),
    needs: (0, import_fields9.text)({ ui: { displayMode: "textarea", description: "What to watch for. Only you see this." } }),
    meetingUrl: (0, import_fields9.text)({ ui: { description: "Overrides your default lesson link for this student." } }),
    status: (0, import_fields9.select)({ type: "enum", options: opt("active", "paused", "finished"), defaultValue: "active", validation: { isRequired: true } }),
    subjects: (0, import_fields9.relationship)({ ref: "Subject.students", many: true }),
    sessions: (0, import_fields9.relationship)({ ref: "Session.students", many: true, ...fieldKit.commandOnly }),
    series: (0, import_fields9.relationship)({ ref: "RecurringSeries.students", many: true, ...fieldKit.commandOnly }),
    homework: (0, import_fields9.relationship)({ ref: "Homework.student", many: true, ...fieldKit.commandOnly }),
    marks: (0, import_fields9.relationship)({ ref: "ProgressMark.student", many: true, ...fieldKit.commandOnly }),
    resources: (0, import_fields9.relationship)({ ref: "Resource.students", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});
var Inquiry = (0, import_core8.list)({
  access: {
    // Created by the public `sendInquiry` command only.
    operation: { query: permissions.canManageFamilies, create: () => false, update: permissions.canManageFamilies, delete: () => false },
    filter: { query: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false, update: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false }
  },
  ui: { listView: { initialColumns: ["name", "email", "studentLevel", "subject", "status", "createdAt"] } },
  fields: {
    profile: profileField("inquiries"),
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    email: (0, import_fields9.text)(),
    phone: (0, import_fields9.text)(),
    studentLevel: (0, import_fields9.text)(),
    subject: (0, import_fields9.text)(),
    message: (0, import_fields9.text)(textarea2),
    status: (0, import_fields9.select)({ type: "enum", options: opt("new", "contacted", "converted", "closed"), defaultValue: "new", validation: { isRequired: true }, ...fieldKit.commandOnly }),
    family: (0, import_fields9.relationship)({ ref: "Family.inquiries", ...fieldKit.commandOnly }),
    ...trackingFields
  }
});
var Review = (0, import_core8.list)({
  access: {
    // Written by `submitReview`; published or hidden by `moderateReview`.
    operation: { query: permissions.canManageFamilies, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false }
  },
  ui: { listView: { initialColumns: ["displayName", "rating", "status", "createdAt"] } },
  fields: {
    profile: profileField("reviews"),
    // One per family, enforced by `submitReview` under the family lock.
    family: (0, import_fields9.relationship)({ ref: "Family.reviews", ...fieldKit.commandOnly }),
    displayName: (0, import_fields9.text)({ validation: { isRequired: true } }),
    rating: (0, import_fields9.integer)({ validation: { isRequired: true, min: 1, max: 5 } }),
    body: (0, import_fields9.text)(textarea2),
    status: (0, import_fields9.select)({ type: "enum", options: opt("pending", "published", "hidden"), defaultValue: "pending", validation: { isRequired: true } }),
    ...trackingFields
  }
});

// features/keystone/models/teaching.ts
var import_core9 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
init_access();
var co = (ui = {}, extra = {}) => ({ ...extra, access: fieldKit.commandOnly.access, ui: { ...fieldKit.commandOnly.ui, ...ui } });
var no3 = () => false;
var textarea3 = { ui: { displayMode: "textarea" } };
var opt2 = (...values) => values.map((value) => ({ label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value }));
var readonlyEnum = (values, defaultValue) => (0, import_fields11.select)({ type: "enum", options: opt2(...values), defaultValue, validation: { isRequired: true }, ...fieldKit.commandOnly });
var SESSION_STATUSES = ["pending_payment", "scheduled", "completed", "cancelled", "late_cancelled", "no_show", "excused", "released"];
var FUNDINGS = ["package", "card", "invoice", "flat", "free"];
var Session = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canManageSessions, create: no3, update: permissions.canManageSessions, delete: no3 },
    filter: { query: ownProfileFilter, update: ownProfileFilter }
  },
  ui: { labelField: "typeNameSnapshot", listView: { initialColumns: ["startsAt", "family", "typeNameSnapshot", "status", "funding", "paymentStatus"] } },
  fields: {
    profile: profileField("sessions"),
    family: (0, import_fields11.relationship)({ ref: "Family.sessions", ...fieldKit.commandOnly }),
    students: (0, import_fields11.relationship)({ ref: "Student.sessions", many: true, ...fieldKit.commandOnly }),
    sessionType: (0, import_fields11.relationship)({ ref: "SessionType.sessions", ...fieldKit.commandOnly }),
    series: (0, import_fields11.relationship)({ ref: "RecurringSeries.sessions", ...fieldKit.commandOnly }),
    startsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true }, ...fieldKit.commandOnly }),
    endsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true }, ...fieldKit.commandOnly }),
    mode: (0, import_fields11.select)({ type: "enum", options: opt2("online", "in_person"), defaultValue: "online", validation: { isRequired: true } }),
    meetingUrl: (0, import_fields11.text)({ ui: { description: "Overrides the student and default lesson link for this session." } }),
    locationText: (0, import_fields11.text)(),
    status: readonlyEnum([...SESSION_STATUSES], "scheduled"),
    funding: readonlyEnum([...FUNDINGS], "free"),
    source: readonlyEnum(["online", "tutor", "series"], "tutor"),
    typeNameSnapshot: (0, import_fields11.text)(fieldKit.commandOnly),
    priceCents: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    chargedCents: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    chargedMinutes: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    billable: (0, import_fields11.select)({ type: "enum", options: opt2("no", "yes"), defaultValue: "no", validation: { isRequired: true }, ...fieldKit.commandOnly }),
    paymentStatus: readonlyEnum(["not_due", "unpaid", "paid", "refunded", "part_refunded"], "not_due"),
    holdEndsAt: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    guardianMessage: (0, import_fields11.text)(co({ displayMode: "textarea" })),
    cancellationReason: (0, import_fields11.text)(fieldKit.commandOnly),
    cancelledBy: readonlyEnum(["none", "guardian", "tutor", "system"], "none"),
    cancelledAt: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    completedAt: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    rescheduleCount: (0, import_fields11.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    rescheduledFrom: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    reminderSentAt: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    publicAccessTokenHash: (0, import_fields11.text)(fieldKit.secret),
    note: (0, import_fields11.relationship)({ ref: "SessionNote.session", ...fieldKit.commandOnly }),
    homework: (0, import_fields11.relationship)({ ref: "Homework.session", many: true, ...fieldKit.commandOnly }),
    creditEntries: (0, import_fields11.relationship)({ ref: "CreditEntry.session", many: true, ...fieldKit.commandOnly }),
    payments: (0, import_fields11.relationship)({ ref: "Payment.session", many: true, ...fieldKit.commandOnly }),
    paymentSessions: (0, import_fields11.relationship)({ ref: "PaymentSession.session", many: true, ...fieldKit.commandOnly }),
    invoiceLines: (0, import_fields11.relationship)({ ref: "InvoiceLine.session", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});
var SessionNote = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canManageSessions, create: no3, update: permissions.canManageSessions, delete: no3 },
    filter: { query: ownProfileFilter, update: ownProfileFilter }
  },
  ui: { listView: { initialColumns: ["session", "covered", "workOnNext", "sharedAt"] } },
  fields: {
    profile: profileField("sessionNotes"),
    session: (0, import_fields11.relationship)({ ref: "Session.note", db: { foreignKey: true }, ...fieldKit.commandOnly }),
    covered: (0, import_fields11.text)(textarea3),
    wentWell: (0, import_fields11.text)(textarea3),
    workOnNext: (0, import_fields11.text)(textarea3),
    effort: (0, import_fields11.integer)({ validation: { min: 1, max: 5 } }),
    privateNote: (0, import_fields11.text)({ ui: { displayMode: "textarea", description: "Only you see this." } }),
    sharedAt: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    ...trackingFields
  }
});
var Homework = (0, import_core9.list)({
  hooks: sameProfileHooks([{ field: "student", list: "Student" }]),
  access: ownCrud(permissions.canManageSessions),
  graphql: { plural: "HomeworkItems" },
  ui: { listView: { initialColumns: ["title", "student", "dueAt", "status"] } },
  fields: {
    profile: profileField("homework"),
    student: (0, import_fields11.relationship)({ ref: "Student.homework" }),
    session: (0, import_fields11.relationship)({ ref: "Session.homework", ...fieldKit.commandOnly }),
    title: (0, import_fields11.text)({ validation: { isRequired: true } }),
    instructions: (0, import_fields11.text)(textarea3),
    dueAt: (0, import_fields11.timestamp)(),
    linkUrl: (0, import_fields11.text)(),
    file: (0, import_fields11.file)({ storage: "tutor_files" }),
    status: readonlyEnum(["assigned", "handed_in", "reviewed"], "assigned"),
    handedInAt: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    guardianComment: (0, import_fields11.text)(co({ displayMode: "textarea" })),
    handInUrl: (0, import_fields11.text)(fieldKit.commandOnly),
    feedback: (0, import_fields11.text)(co({ displayMode: "textarea" })),
    reviewedAt: (0, import_fields11.timestamp)(fieldKit.commandOnly),
    ...trackingFields
  }
});
var ProgressMark = (0, import_core9.list)({
  hooks: sameProfileHooks([{ field: "student", list: "Student" }]),
  access: ownCrud(permissions.canManageSessions),
  ui: { listView: { initialColumns: ["student", "label", "takenOn", "score", "outOf"] } },
  fields: {
    profile: profileField("progressMarks"),
    student: (0, import_fields11.relationship)({ ref: "Student.marks" }),
    label: (0, import_fields11.text)({ validation: { isRequired: true }, ui: { description: 'e.g. "Unit 3 test", "SAT practice 4".' } }),
    takenOn: (0, import_fields11.timestamp)({ validation: { isRequired: true } }),
    score: (0, import_fields11.integer)({ validation: { isRequired: true, min: 0 } }),
    outOf: (0, import_fields11.integer)({ validation: { isRequired: true, min: 1 } }),
    note: (0, import_fields11.text)(),
    ...trackingFields
  }
});
var Resource = (0, import_core9.list)({
  hooks: sameProfileHooks([{ field: "students", list: "Student" }]),
  access: ownCrud(permissions.canManageSessions),
  ui: { listView: { initialColumns: ["title", "linkUrl", "students"] } },
  fields: {
    profile: profileField("resources"),
    title: (0, import_fields11.text)({ validation: { isRequired: true } }),
    linkUrl: (0, import_fields11.text)(),
    file: (0, import_fields11.file)({ storage: "tutor_files" }),
    students: (0, import_fields11.relationship)({ ref: "Student.resources", many: true, ui: { description: "Leave empty to share with every active student." } }),
    note: (0, import_fields11.text)(textarea3),
    ...trackingFields
  }
});
var RecurringSeries = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canManageSessions, create: no3, update: no3, delete: no3 },
    filter: { query: ownProfileFilter }
  },
  graphql: { plural: "RecurringSeriesItems" },
  ui: { listView: { initialColumns: ["family", "sessionType", "dayOfWeek", "startMinute", "status"] } },
  fields: {
    profile: profileField("series"),
    family: (0, import_fields11.relationship)({ ref: "Family.series", ...fieldKit.commandOnly }),
    students: (0, import_fields11.relationship)({ ref: "Student.series", many: true, ...fieldKit.commandOnly }),
    sessionType: (0, import_fields11.relationship)({ ref: "SessionType.series", ...fieldKit.commandOnly }),
    dayOfWeek: (0, import_fields11.integer)(co({ description: "0 = Sunday \u2026 6 = Saturday, in your timezone." }, { validation: { isRequired: true, min: 0, max: 6 } })),
    startMinute: (0, import_fields11.integer)({ validation: { isRequired: true, min: 0, max: 1439 }, ...fieldKit.commandOnly }),
    mode: (0, import_fields11.select)({ type: "enum", options: opt2("online", "in_person"), defaultValue: "online", validation: { isRequired: true }, ...fieldKit.commandOnly }),
    startsOn: (0, import_fields11.text)(co({ description: "YYYY-MM-DD" }, { validation: { isRequired: true } })),
    endsOn: (0, import_fields11.text)(fieldKit.commandOnly),
    status: readonlyEnum(["active", "paused", "ended"], "active"),
    generatedThrough: (0, import_fields11.text)(fieldKit.commandOnly),
    skippedDates: (0, import_fields11.text)(co({ displayMode: "textarea", description: "Weeks that could not be booked (one YYYY-MM-DD per line)." })),
    sessions: (0, import_fields11.relationship)({ ref: "Session.series", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});

// features/keystone/models/money.ts
var import_core10 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
init_access();
var co2 = (ui = {}, extra = {}) => ({ ...extra, access: fieldKit.commandOnly.access, ui: { ...fieldKit.commandOnly.ui, ...ui } });
var no4 = () => false;
var opt3 = (...values) => values.map((value) => ({ label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value }));
var readonlyEnum2 = (values, defaultValue) => (0, import_fields13.select)({ type: "enum", options: opt3(...values), defaultValue, validation: { isRequired: true }, ...fieldKit.commandOnly });
var ro = (extra = {}) => ({ ...fieldKit.commandOnly, ...extra });
var PackagePurchase = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManageFamilies),
  ui: { labelField: "nameSnapshot", listView: { initialColumns: ["family", "nameSnapshot", "minutesRemaining", "status", "expiresAt"] } },
  fields: {
    profile: profileField("purchases"),
    family: (0, import_fields13.relationship)({ ref: "Family.purchases", ...fieldKit.commandOnly }),
    package: (0, import_fields13.relationship)({ ref: "Package.purchases", ...fieldKit.commandOnly }),
    nameSnapshot: (0, import_fields13.text)(fieldKit.commandOnly),
    appliesToIds: (0, import_fields13.text)(co2({ description: "Session type ids this package covers, copied when bought (empty = any)." })),
    minutesGranted: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    minutesRemaining: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    pricePaidCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundedCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    status: readonlyEnum2(["awaiting_payment", "active", "used_up", "expired", "refunded", "cancelled"], "awaiting_payment"),
    purchasedAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    expiresAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    entries: (0, import_fields13.relationship)({ ref: "CreditEntry.purchase", many: true, ...fieldKit.commandOnly }),
    payments: (0, import_fields13.relationship)({ ref: "Payment.purchase", many: true, ...fieldKit.commandOnly }),
    paymentSessions: (0, import_fields13.relationship)({ ref: "PaymentSession.purchase", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});
var CreditEntry = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManageFamilies),
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["purchase", "kind", "minutes", "session", "createdAt"] } },
  fields: {
    profile: profileField("creditEntries"),
    purchase: (0, import_fields13.relationship)({ ref: "PackagePurchase.entries", ...fieldKit.commandOnly }),
    session: (0, import_fields13.relationship)({ ref: "Session.creditEntries", ...fieldKit.commandOnly }),
    kind: readonlyEnum2(["grant", "hold", "release", "debit", "reversal", "expire", "refund", "adjustment"], "grant"),
    minutes: (0, import_fields13.integer)(ro({ validation: { isRequired: true } })),
    heldChange: (0, import_fields13.integer)(co2({ description: "Change in the minutes held for this entry's session: + when a hold opens, \u2212 when a release or debit closes it." }, { defaultValue: 0, validation: { isRequired: true } })),
    note: (0, import_fields13.text)(fieldKit.commandOnly),
    key: (0, import_fields13.text)({ ...fieldKit.secret, isIndexed: "unique" }),
    ...trackingFields
  }
});
var Invoice = (0, import_core10.list)({
  db: { extendPrismaSchema: (schema) => schema.replace(/\n}\s*$/, "\n  @@unique([profileId, number])\n}") },
  access: ownReadOnly(permissions.canManagePayments),
  ui: { labelField: "number", listView: { initialColumns: ["number", "family", "status", "totalCents", "paidCents", "dueAt"] } },
  fields: {
    profile: profileField("invoices"),
    family: (0, import_fields13.relationship)({ ref: "Family.invoices", ...fieldKit.commandOnly }),
    number: (0, import_fields13.text)(ro({ validation: { isRequired: true } })),
    status: readonlyEnum2(["draft", "sent", "paid", "void"], "draft"),
    issuedAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    dueAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    periodMonth: (0, import_fields13.text)(co2({ description: "YYYY-MM of a flat monthly fee on this invoice." })),
    subtotalCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    totalCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    paidCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    note: (0, import_fields13.text)(fieldKit.commandOnly),
    voidedAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    lines: (0, import_fields13.relationship)({ ref: "InvoiceLine.invoice", many: true, ...fieldKit.commandOnly }),
    payments: (0, import_fields13.relationship)({ ref: "Payment.invoice", many: true, ...fieldKit.commandOnly }),
    paymentSessions: (0, import_fields13.relationship)({ ref: "PaymentSession.invoice", many: true, ...fieldKit.commandOnly }),
    publicAccessTokenHash: (0, import_fields13.text)(fieldKit.secret),
    ...trackingFields
  }
});
var InvoiceLine = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManagePayments),
  ui: { listView: { initialColumns: ["invoice", "description", "quantity", "unitCents", "totalCents"] } },
  fields: {
    profile: profileField("invoiceLines"),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice.lines", ...fieldKit.commandOnly }),
    session: (0, import_fields13.relationship)({ ref: "Session.invoiceLines", ...fieldKit.commandOnly }),
    description: (0, import_fields13.text)(ro({ validation: { isRequired: true } })),
    quantity: (0, import_fields13.integer)(ro({ defaultValue: 1, validation: { isRequired: true, min: 1 } })),
    unitCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    totalCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    sortOrder: (0, import_fields13.integer)(ro({ defaultValue: 0 })),
    ...trackingFields
  }
});
var Payment = (0, import_core10.list)({
  access: ownReadOnly(permissions.canReadPayments),
  ui: { listView: { initialColumns: ["family", "kind", "method", "status", "amountCents", "paidAt"] } },
  fields: {
    profile: profileField("payments"),
    family: (0, import_fields13.relationship)({ ref: "Family.payments", ...fieldKit.commandOnly }),
    session: (0, import_fields13.relationship)({ ref: "Session.payments", ...fieldKit.commandOnly }),
    purchase: (0, import_fields13.relationship)({ ref: "PackagePurchase.payments", ...fieldKit.commandOnly }),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice.payments", ...fieldKit.commandOnly }),
    refundOf: (0, import_fields13.relationship)({ ref: "Payment.refunds", ...fieldKit.commandOnly }),
    refunds: (0, import_fields13.relationship)({ ref: "Payment.refundOf", many: true, ...fieldKit.commandOnly }),
    kind: readonlyEnum2(["session", "package", "invoice", "refund"], "session"),
    method: readonlyEnum2(["stripe", "cash", "bank_transfer", "mobile_money", "other"], "cash"),
    status: readonlyEnum2(["reported", "confirmed", "rejected", "refunded", "partially_refunded"], "confirmed"),
    amountCents: (0, import_fields13.integer)(ro({ validation: { isRequired: true, min: 0 } })),
    refundedCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundCount: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundPendingCents: (0, import_fields13.integer)(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    currencyCode: (0, import_fields13.text)(ro({ defaultValue: "USD" })),
    reference: (0, import_fields13.text)(fieldKit.commandOnly),
    providerReference: (0, import_fields13.text)(fieldKit.commandOnly),
    paidAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    reportedByGuardian: (0, import_fields13.checkbox)({ defaultValue: false, ...fieldKit.commandOnly }),
    decidedAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    note: (0, import_fields13.text)(fieldKit.commandOnly),
    ...trackingFields
  }
});
var adapter = { validation: { isRequired: true }, defaultValue: "manual", ui: { description: "Name of the payment adapter this operation uses." } };
var PaymentProvider = (0, import_core10.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManagePayments),
  ui: { listView: { initialColumns: ["name", "code", "isInstalled"] } },
  fields: {
    profile: profileField("paymentProviders"),
    name: (0, import_fields13.text)({ validation: { isRequired: true } }),
    code: (0, import_fields13.text)({ validation: { isRequired: true, match: { regex: /^pp_(manual|stripe)$/, explanation: "Provider code is pp_manual or pp_stripe." } } }),
    isInstalled: (0, import_fields13.checkbox)({ defaultValue: true }),
    createPaymentFunction: (0, import_fields13.text)(adapter),
    capturePaymentFunction: (0, import_fields13.text)(adapter),
    refundPaymentFunction: (0, import_fields13.text)(adapter),
    getPaymentStatusFunction: (0, import_fields13.text)(adapter),
    generatePaymentLinkFunction: (0, import_fields13.text)(adapter),
    handleWebhookFunction: (0, import_fields13.text)(adapter),
    paymentSessions: (0, import_fields13.relationship)({ ref: "PaymentSession.paymentProvider", many: true, ...fieldKit.commandOnly }),
    ...trackingFields
  }
});
var PaymentSession = (0, import_core10.list)({
  access: ownReadOnly(permissions.canReadPayments),
  ui: { listView: { initialColumns: ["target", "status", "amountCents", "expiresAt"] } },
  fields: {
    profile: profileField("paymentSessions"),
    target: readonlyEnum2(["session", "package", "invoice"], "session"),
    session: (0, import_fields13.relationship)({ ref: "Session.paymentSessions", ...fieldKit.commandOnly }),
    purchase: (0, import_fields13.relationship)({ ref: "PackagePurchase.paymentSessions", ...fieldKit.commandOnly }),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice.paymentSessions", ...fieldKit.commandOnly }),
    paymentProvider: (0, import_fields13.relationship)({ ref: "PaymentProvider.paymentSessions", ...fieldKit.commandOnly }),
    status: readonlyEnum2(["pending", "captured", "expired", "cancelled", "refunded"], "pending"),
    amountCents: (0, import_fields13.integer)(ro({ validation: { isRequired: true, min: 0 } })),
    currencyCode: (0, import_fields13.text)(ro({ defaultValue: "USD" })),
    providerPaymentId: (0, import_fields13.text)({ ...fieldKit.commandOnly, isIndexed: true }),
    expiresAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    capturedAt: (0, import_fields13.timestamp)(fieldKit.commandOnly),
    ...trackingFields
  }
});
var PaymentWebhookEvent = (0, import_core10.list)({
  access: { operation: { query: no4, create: no4, update: no4, delete: no4 } },
  ui: { isHidden: true },
  fields: {
    replayKey: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    providerCode: (0, import_fields13.text)({ validation: { isRequired: true } }),
    providerEventId: (0, import_fields13.text)({ validation: { isRequired: true } }),
    eventType: (0, import_fields13.text)({ validation: { isRequired: true } }),
    payloadHash: (0, import_fields13.text)({ validation: { isRequired: true } }),
    processedAt: (0, import_fields13.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Expense = (0, import_core10.list)({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canViewEarnings),
  ui: { listView: { initialColumns: ["spentOn", "category", "amountCents", "note"] } },
  fields: {
    profile: profileField("expenses"),
    spentOn: (0, import_fields13.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } }),
    category: (0, import_fields13.select)({ type: "enum", options: opt3("travel", "materials", "software", "room", "other"), defaultValue: "other", validation: { isRequired: true } }),
    amountCents: (0, import_fields13.integer)({ validation: { isRequired: true, min: 0, max: 1e8 } }),
    note: (0, import_fields13.text)(),
    ...trackingFields
  }
});
var NotificationLog = (0, import_core10.list)({
  access: ownReadOnly(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ["kind", "to", "subject", "status", "createdAt"] } },
  fields: {
    profile: profileField("notifications"),
    kind: (0, import_fields13.text)(ro({ validation: { isRequired: true } })),
    to: (0, import_fields13.text)(fieldKit.commandOnly),
    subject: (0, import_fields13.text)(fieldKit.commandOnly),
    link: (0, import_fields13.text)(fieldKit.commandOnly),
    status: readonlyEnum2(["sent", "failed", "skipped"], "skipped"),
    error: (0, import_fields13.text)(fieldKit.commandOnly),
    session: (0, import_fields13.relationship)({ ref: "Session", ...fieldKit.commandOnly }),
    invoice: (0, import_fields13.relationship)({ ref: "Invoice", ...fieldKit.commandOnly }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  OAuthApp,
  OAuthToken,
  TutorProfile,
  Subject,
  SessionType,
  WeeklyHours,
  TimeOff,
  Package,
  Family,
  Student,
  Inquiry,
  Review,
  Session,
  SessionNote,
  Homework,
  ProgressMark,
  Resource,
  RecurringSeries,
  PackagePurchase,
  CreditEntry,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentProvider,
  PaymentSession,
  PaymentWebhookEvent,
  Expense,
  NotificationLog
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/index.ts
init_business();

// features/shared/trusted-origin.ts
function trustedOrigin(env = process.env) {
  const configured = env.APP_ORIGIN || env.NEXT_PUBLIC_APP_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : "");
  if (configured) {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("APP_ORIGIN must be an HTTP(S) origin without credentials or path.");
    if (env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("APP_ORIGIN must use HTTPS in production.");
    return url.origin;
  }
  if (env.NODE_ENV === "production") throw new Error("Set APP_ORIGIN (or RAILWAY_PUBLIC_DOMAIN) before starting production.");
  const port = env.PORT || "3000";
  if (!/^\d{1,5}$/.test(port)) throw new Error("Invalid local application port.");
  return `http://127.0.0.1:${port}`;
}

// features/keystone/utils/publicOps.ts
init_availability();
init_booking();

// features/keystone/utils/billing.ts
init_business();
init_ledger();
init_payments();
init_publicAccessToken();
var monthKey = (d, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
async function readyToInvoice(db, profileId, familyId) {
  const profile = await db.tutorProfile.findUniqueOrThrow({ where: { id: profileId } });
  const sessions = await db.session.findMany({
    where: { profileId, ...familyId ? { familyId } : {}, funding: "invoice", billable: "yes", chargedCents: { gt: 0 }, invoiceLines: { none: { invoice: { status: { in: ["draft", "sent", "paid"] } } } } },
    select: { id: true, familyId: true, startsAt: true, typeNameSnapshot: true, chargedCents: true, status: true },
    orderBy: { startsAt: "asc" },
    take: 500
  });
  const flat = await db.family.findMany({ where: { profileId, ...familyId ? { id: familyId } : {}, billingMode: "flat_monthly", monthlyFeeCents: { gt: 0 }, status: { in: ["active", "paused"] } }, select: { id: true, monthlyFeeCents: true }, take: 500 });
  const month = monthKey(/* @__PURE__ */ new Date(), profile.timezone);
  const billedFlat = new Set((await db.invoice.findMany({ where: { profileId, periodMonth: month, status: { in: ["draft", "sent", "paid"] } }, select: { familyId: true }, take: 1e3 })).map((i) => i.familyId));
  const families = /* @__PURE__ */ new Map();
  const entry = (id) => {
    if (!families.has(id)) families.set(id, { familyId: id, sessions: [], flatMonth: null, flatCents: 0, totalCents: 0 });
    return families.get(id);
  };
  for (const s of sessions) if (s.familyId) {
    const e = entry(s.familyId);
    e.sessions.push(s);
    e.totalCents += s.chargedCents;
  }
  for (const f of flat) if (!billedFlat.has(f.id)) {
    const e = entry(f.id);
    e.flatMonth = month;
    e.flatCents = f.monthlyFeeCents;
    e.totalCents += f.monthlyFeeCents;
  }
  const names = await db.family.findMany({ where: { id: { in: [...families.keys()] } }, select: { id: true, guardianName: true, billingMode: true } });
  return [...families.values()].map((e) => ({ ...e, guardianName: names.find((n) => n.id === e.familyId)?.guardianName ?? "", billingMode: names.find((n) => n.id === e.familyId)?.billingMode ?? "", sessions: e.sessions.map((s) => ({ ...s, startsAt: s.startsAt.toISOString() })) }));
}
async function recomputeTotals(tx, invoiceId) {
  const lines = await tx.invoiceLine.aggregate({ where: { invoiceId }, _sum: { totalCents: true } });
  const total = lines._sum.totalCents ?? 0;
  await tx.invoice.updateMany({ where: { id: invoiceId, status: "draft" }, data: { subtotalCents: total, totalCents: total } });
}
async function createInvoice(prisma, profileId, input) {
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId);
    await lockTutorBilling(tx, profileId);
    const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: profileId } });
    const family = await tx.family.findFirst({ where: { id: input.familyId, profileId } });
    if (!family) throw new CommandError("Choose a family.");
    const ready = (await readyToInvoice(tx, profileId, family.id))[0];
    const wanted = input.sessionIds?.length ? new Set(input.sessionIds) : null;
    const sessions = (ready?.sessions ?? []).filter((s) => !wanted || wanted.has(s.id));
    if (wanted && sessions.length !== wanted.size) throw new CommandError("One of those sessions is already on an invoice or is not charged.");
    const flat = input.includeFlatFee !== false && ready?.flatMonth ? { month: ready.flatMonth, cents: ready.flatCents } : null;
    const extras = (input.extraLines ?? []).map((l) => {
      const description = cleanText(l.description, 200);
      if (!description) throw new CommandError("Each extra line needs a description.");
      const quantity = Math.floor(Number(l.quantity ?? 1));
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1e3) throw new CommandError("Quantity must be 1 or more.");
      const unit = wholeCents(l.unitCents, "Line price");
      return { description, quantity, unitCents: unit, totalCents: unit * quantity };
    });
    if (!sessions.length && !flat && !extras.length) throw new CommandError("There is nothing to invoice for this family.");
    const counter = profile.invoiceCounter + 1;
    const bumped = await tx.tutorProfile.updateMany({ where: { id: profileId, invoiceCounter: profile.invoiceCounter }, data: { invoiceCounter: counter } });
    if (!bumped.count) throw new CommandError("Try again.");
    const dueDays = input.dueDays == null ? profile.invoiceDueDays : Math.max(0, Math.min(90, Math.floor(input.dueDays)));
    const access = createPublicAccessToken();
    const invoice = await tx.invoice.create({
      data: {
        profileId,
        familyId: family.id,
        number: `INV-${String(counter).padStart(4, "0")}`,
        status: "draft",
        dueAt: new Date(Date.now() + dueDays * 864e5),
        periodMonth: flat?.month ?? "",
        note: cleanText(input.note, 1e3),
        publicAccessTokenHash: access.hash
      }
    });
    let order = 0;
    const fmt2 = (d) => new Intl.DateTimeFormat("en-US", { timeZone: profile.timezone, dateStyle: "medium" }).format(new Date(d));
    for (const s of sessions) {
      await tx.invoiceLine.create({ data: { profileId, invoiceId: invoice.id, sessionId: s.id, description: `${s.typeNameSnapshot} \xB7 ${fmt2(s.startsAt)}${s.status !== "completed" ? ` (${s.status === "no_show" ? "no-show" : "late cancellation"})` : ""}`, quantity: 1, unitCents: s.chargedCents, totalCents: s.chargedCents, sortOrder: order++ } });
    }
    if (flat) await tx.invoiceLine.create({ data: { profileId, invoiceId: invoice.id, description: `Monthly tutoring fee \xB7 ${flat.month}`, quantity: 1, unitCents: flat.cents, totalCents: flat.cents, sortOrder: order++ } });
    for (const l of extras) await tx.invoiceLine.create({ data: { profileId, invoiceId: invoice.id, ...l, sortOrder: order++ } });
    if (sessions.length) {
      const twice = await tx.invoiceLine.groupBy({ by: ["sessionId"], where: { sessionId: { in: sessions.map((s) => s.id) }, invoice: { status: { in: ["draft", "sent", "paid"] } } }, _count: { _all: true } });
      if (twice.some((g) => g._count._all > 1)) throw new CommandError("One of those sessions is already on an invoice.");
    }
    await recomputeTotals(tx, invoice.id);
    return { id: invoice.id, number: invoice.number, token: access.token };
  });
}
async function addInvoiceLine(prisma, profileId, invoiceId, line) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId);
    const inv = await tx.invoice.findFirst({ where: { id: invoiceId, profileId } });
    if (!inv) throw new CommandError("Invoice not found.");
    if (inv.status !== "draft") throw new CommandError("A sent invoice cannot be changed. Void it and issue a new one.");
    const description = cleanText(line.description, 200);
    if (!description) throw new CommandError("Enter a description.");
    const quantity = Math.max(1, Math.floor(Number(line.quantity ?? 1)));
    const unit = wholeCents(line.unitCents, "Line price");
    const order = await tx.invoiceLine.count({ where: { invoiceId } });
    await tx.invoiceLine.create({ data: { profileId, invoiceId, description, quantity, unitCents: unit, totalCents: unit * quantity, sortOrder: order } });
    await recomputeTotals(tx, invoiceId);
    return { id: invoiceId };
  });
}
async function removeInvoiceLine(prisma, profileId, lineId) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId);
    const line = await tx.invoiceLine.findFirst({ where: { id: lineId, profileId }, include: { invoice: { select: { id: true, status: true } } } });
    if (!line?.invoice) throw new CommandError("Line not found.");
    if (line.invoice.status !== "draft") throw new CommandError("A sent invoice cannot be changed. Void it and issue a new one.");
    await tx.invoiceLine.delete({ where: { id: line.id } });
    await recomputeTotals(tx, line.invoice.id);
    return { id: line.invoice.id };
  });
}
async function sendInvoice(prisma, profileId, invoiceId) {
  const access = createPublicAccessToken();
  const inv = await transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId);
    const inv2 = await tx.invoice.findFirst({ where: { id: invoiceId, profileId } });
    if (!inv2) throw new CommandError("Invoice not found.");
    if (inv2.status !== "draft") throw new CommandError("This invoice was already sent.");
    if (inv2.totalCents <= 0) throw new CommandError("An invoice must be for more than zero.");
    await tx.invoice.updateMany({ where: { id: inv2.id, status: "draft" }, data: { status: "sent", issuedAt: /* @__PURE__ */ new Date(), publicAccessTokenHash: access.hash } });
    return inv2;
  });
  return { ...inv, token: access.token };
}
async function voidInvoice(prisma, profileId, invoiceId) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId);
    const inv = await tx.invoice.findFirst({ where: { id: invoiceId, profileId } });
    if (!inv) throw new CommandError("Invoice not found.");
    if (!["draft", "sent"].includes(inv.status)) throw new CommandError("Only an unpaid invoice can be voided.");
    if (inv.paidCents > 0) throw new CommandError("This invoice has payments on it. Refund them first.");
    await tx.invoice.updateMany({ where: { id: inv.id, status: inv.status }, data: { status: "void", voidedAt: /* @__PURE__ */ new Date() } });
    await tx.payment.updateMany({ where: { invoiceId: inv.id, status: "reported" }, data: { status: "rejected", decidedAt: /* @__PURE__ */ new Date(), note: "Invoice voided" } });
    return { id: inv.id, status: "void" };
  });
}
var METHODS = ["cash", "bank_transfer", "mobile_money", "other"];
function offlineMethod(value) {
  if (!METHODS.includes(value)) throw new CommandError("Choose how it was paid: cash, bank transfer, mobile money or other.");
  return value;
}
async function targetFor(tx, profileId, familyId, t) {
  if (t.kind === "invoice") {
    const inv = await tx.invoice.findFirst({ where: { id: t.id, profileId, ...familyId ? { familyId } : {} } });
    if (!inv || inv.status !== "sent") throw new CommandError("This invoice is not open for payment.");
    return { familyId: inv.familyId, invoiceId: inv.id, due: inv.totalCents - inv.paidCents };
  }
  if (t.kind === "package") {
    const p = await tx.packagePurchase.findFirst({ where: { id: t.id, profileId, ...familyId ? { familyId } : {} } });
    if (!p || p.status !== "awaiting_payment") throw new CommandError("This package is not waiting for payment.");
    return { familyId: p.familyId, purchaseId: p.id, due: p.pricePaidCents };
  }
  const s = await tx.session.findFirst({ where: { id: t.id, profileId, ...familyId ? { familyId } : {} } });
  if (!s || s.funding !== "card" || s.paymentStatus !== "unpaid" || !["scheduled", "completed", "late_cancelled", "no_show"].includes(s.status)) throw new CommandError("This session has nothing to pay.");
  const due = ["late_cancelled", "no_show"].includes(s.status) ? s.chargedCents : s.priceCents;
  if (due <= 0) throw new CommandError("This session has nothing to pay.");
  return { familyId: s.familyId, sessionId: s.id, due };
}
async function reportPayment(prisma, profileId, familyId, input) {
  const method = offlineMethod(input.method);
  const amount = wholeCents(input.amountCents, "Amount");
  if (amount <= 0) throw new CommandError("Enter the amount you paid.");
  const reference = cleanText(input.reference, 120);
  if (!reference) throw new CommandError("Enter the reference from your bank or app so your tutor can find it.");
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId);
    const t = await targetFor(tx, profileId, familyId, input.target);
    if (amount > t.due) throw new CommandError("That is more than what is owed.");
    const open = await tx.payment.count({ where: { profileId, familyId, status: "reported", ...t.invoiceId ? { invoiceId: t.invoiceId } : t.purchaseId ? { purchaseId: t.purchaseId } : { sessionId: t.sessionId } } });
    if (open >= 3) throw new CommandError("Your tutor has not yet checked your earlier reports.");
    const kind = input.target.kind;
    const p = await tx.payment.create({ data: { profileId, familyId, invoiceId: t.invoiceId ?? null, purchaseId: t.purchaseId ?? null, sessionId: t.sessionId ?? null, kind, method, status: "reported", amountCents: amount, reference, reportedByGuardian: true, paidAt: /* @__PURE__ */ new Date() } });
    return { id: p.id, status: "reported" };
  });
}
async function applyConfirmed(tx, p) {
  if (p.invoiceId) {
    if (!await applyInvoicePayment(tx, p.invoiceId, p.amountCents)) throw new CommandError("That is more than what is owed on this invoice, or it is no longer open.");
  } else if (p.purchaseId) {
    const purchase = await tx.packagePurchase.findUnique({ where: { id: p.purchaseId }, include: { package: { select: { validMonths: true } } } });
    if (!purchase || p.amountCents < purchase.pricePaidCents) throw new CommandError("A package is activated when its full price is paid.");
    if (!await activatePurchase(tx, purchase, p.amountCents)) throw new CommandError("This package is not waiting for payment.");
  } else if (p.sessionId) {
    await tx.session.update({ where: { id: p.sessionId }, data: { paymentStatus: "paid" } });
  }
}
async function confirmPayment(prisma, profileId, paymentId) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId);
    const p = await tx.payment.findFirst({ where: { id: paymentId, profileId } });
    if (!p || p.status !== "reported") throw new CommandError("This payment is not waiting for you.");
    const done = await tx.payment.updateMany({ where: { id: p.id, status: "reported" }, data: { status: "confirmed", decidedAt: /* @__PURE__ */ new Date() } });
    if (!done.count) throw new CommandError("Already handled.");
    await applyConfirmed(tx, p);
    return { id: p.id, status: "confirmed" };
  });
}
async function rejectPayment(prisma, profileId, paymentId, note) {
  const db = guarded(prisma);
  const done = await db.payment.updateMany({ where: { id: paymentId, profileId, status: "reported" }, data: { status: "rejected", decidedAt: /* @__PURE__ */ new Date(), note: cleanText(note, 300) } });
  if (!done.count) throw new CommandError("This payment is not waiting for you.");
  return { id: paymentId, status: "rejected" };
}
async function recordPayment(prisma, profileId, input) {
  const method = offlineMethod(input.method);
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId);
    const t = await targetFor(tx, profileId, null, input.target);
    const amount = input.amountCents == null ? t.due : wholeCents(input.amountCents, "Amount");
    if (amount <= 0 || amount > t.due) throw new CommandError("Enter an amount up to what is owed.");
    const p = await tx.payment.create({ data: { profileId, familyId: t.familyId, invoiceId: t.invoiceId ?? null, purchaseId: t.purchaseId ?? null, sessionId: t.sessionId ?? null, kind: input.target.kind, method, status: "confirmed", amountCents: amount, reference: cleanText(input.reference, 120), paidAt: /* @__PURE__ */ new Date(), decidedAt: /* @__PURE__ */ new Date() } });
    await applyConfirmed(tx, p);
    return { id: p.id, status: "confirmed", amountCents: amount };
  });
}
async function startPurchase(prisma, profileId, familyId, packageId) {
  return transaction(prisma, async (tx) => {
    const pkg = await tx.package.findFirst({ where: { id: packageId, profileId, active: true }, include: { appliesTo: { select: { id: true } } } });
    if (!pkg) throw new CommandError("Choose a package.");
    const family = await tx.family.findFirst({ where: { id: familyId, profileId } });
    if (!family) throw new CommandError("Choose a family.");
    if (family.status === "blocked") throw new CommandError("Contact your tutor to buy a package.");
    const waiting = await tx.packagePurchase.count({ where: { familyId, status: "awaiting_payment" } });
    if (waiting >= 3) throw new CommandError("You have packages waiting for payment. Pay or ask your tutor to cancel them first.");
    return tx.packagePurchase.create({ data: { profileId, familyId, packageId: pkg.id, nameSnapshot: pkg.name, appliesToIds: pkg.appliesTo.map((t) => t.id).join(","), minutesGranted: pkg.minutes, minutesRemaining: 0, pricePaidCents: pkg.priceCents, status: "awaiting_payment" } });
  });
}
async function sellPackage(prisma, profileId, input) {
  offlineMethod(input.method);
  const purchase = await startPurchase(prisma, profileId, input.familyId, input.packageId);
  if (purchase.pricePaidCents === 0) {
    await transaction(prisma, async (tx) => {
      await lockTutorBilling(tx, profileId);
      await activatePurchase(tx, { ...purchase, package: await tx.package.findUnique({ where: { id: input.packageId }, select: { validMonths: true } }) }, 0);
    });
    return { purchaseId: purchase.id };
  }
  await recordPayment(prisma, profileId, { target: { kind: "package", id: purchase.id }, method: input.method, reference: input.reference });
  return { purchaseId: purchase.id };
}
async function cancelPurchase(prisma, profileId, purchaseId) {
  const db = guarded(prisma);
  const done = await db.packagePurchase.updateMany({ where: { id: purchaseId, profileId, status: "awaiting_payment" }, data: { status: "cancelled" } });
  if (!done.count) throw new CommandError("Only a package waiting for payment can be cancelled.");
  await db.payment.updateMany({ where: { purchaseId, status: "reported" }, data: { status: "rejected", decidedAt: /* @__PURE__ */ new Date(), note: "Package cancelled" } });
  await db.paymentSession.updateMany({ where: { purchaseId, status: "pending" }, data: { status: "cancelled" } });
  return { id: purchaseId };
}
async function refundPackage(prisma, profileId, purchaseId) {
  const claim = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId);
    const p2 = await tx.packagePurchase.findFirst({ where: { id: purchaseId, profileId } });
    if (!p2 || !["active", "used_up", "expired"].includes(p2.status)) throw new CommandError("Only a paid package can be refunded.");
    const held = await tx.creditEntry.aggregate({ where: { purchaseId, sessionId: { not: null } }, _sum: { heldChange: true } });
    if ((held._sum.heldChange ?? 0) > 0) throw new CommandError("Some of these minutes are booked. Cancel or complete those sessions first.");
    const refundCents2 = p2.minutesGranted > 0 ? Math.floor((p2.pricePaidCents - p2.refundedCents) * p2.minutesRemaining / p2.minutesGranted) : 0;
    await refundRemaining(tx, p2, "Unused minutes refunded");
    return { p: p2, refundCents: refundCents2 };
  });
  const { p, refundCents } = claim;
  const payments = await guarded(prisma).payment.findMany({ where: { purchaseId, kind: "package", status: { in: ["confirmed", "partially_refunded"] } }, orderBy: { createdAt: "asc" }, take: 10 });
  let left = refundCents;
  try {
    for (const pay2 of payments) {
      if (left <= 0) break;
      const amount = Math.min(pay2.amountCents - pay2.refundedCents - pay2.refundPendingCents, left);
      if (amount <= 0) continue;
      await refundPaymentRow(prisma, pay2.id, amount, `Unused package minutes (${p.minutesRemaining} of ${p.minutesGranted})`);
      left -= amount;
    }
  } catch (error) {
    if (left === refundCents) {
      await transaction(prisma, async (tx) => {
        await lockTutorBooking(tx, profileId);
        await tx.packagePurchase.update({ where: { id: purchaseId }, data: { status: p.status, minutesRemaining: { increment: p.minutesRemaining } } });
        if (p.minutesRemaining > 0) await tx.creditEntry.create({ data: { profileId, purchaseId, kind: "adjustment", minutes: p.minutesRemaining, note: "Refund did not go through; minutes restored", key: `${purchaseId}:restore:${Date.now()}` } });
      });
    }
    throw error;
  }
  await guarded(prisma).packagePurchase.update({ where: { id: purchaseId }, data: { refundedCents: { increment: refundCents - left } } });
  return { refundedCents: refundCents - left, minutes: p.minutesRemaining };
}

// features/keystone/utils/publicOps.ts
init_business();
init_family();
init_payments();

// features/keystone/utils/notify.ts
var import_nodemailer = require("nodemailer");
var transport = null;
function mailConfigured(env = process.env) {
  return Boolean(env.SMTP_HOST);
}
function mailer() {
  transport ??= (0, import_nodemailer.createTransport)({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : void 0
  });
  return transport;
}
var esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function notify(db, input) {
  const to = (input.to || "").trim();
  let status = "skipped";
  let error = "";
  if (!to) error = "No email address on file.";
  else if (!mailConfigured()) error = "Email is not set up on this site (SMTP_HOST).";
  else {
    try {
      const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">${input.lines.map((l) => `<p>${esc(l)}</p>`).join("")}${input.link ? `<p><a href="${esc(input.link)}" style="display:inline-block;background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${esc(input.linkLabel || "Open")}</a></p><p style="color:#666;font-size:13px">${esc(input.link)}</p>` : ""}</div>`;
      const text9 = [...input.lines, input.link ? `${input.linkLabel || "Open"}: ${input.link}` : ""].filter(Boolean).join("\n\n");
      await mailer().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, replyTo: input.replyTo || void 0, subject: input.subject, text: text9, html });
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message.slice(0, 300) : "Send failed";
    }
  }
  try {
    await db.notificationLog.create({ data: { profileId: input.profileId, kind: input.kind, to, subject: input.subject.slice(0, 200), link: input.link ?? "", status, error, sessionId: input.sessionId ?? null, invoiceId: input.invoiceId ?? null } });
  } catch (e) {
    console.error("[tutor] notification log failed", e instanceof Error ? e.message : e);
  }
  return { status, error };
}

// features/keystone/utils/publicOps.ts
init_publicAccessToken();

// features/keystone/utils/views.ts
var familySessionSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  mode: true,
  meetingUrl: true,
  locationText: true,
  status: true,
  funding: true,
  typeNameSnapshot: true,
  priceCents: true,
  chargedCents: true,
  chargedMinutes: true,
  paymentStatus: true,
  holdEndsAt: true,
  cancellationReason: true,
  cancelledBy: true,
  rescheduleCount: true,
  rescheduledFrom: true,
  sessionTypeId: true,
  students: { select: { id: true, firstName: true, meetingUrl: true } },
  note: { select: { covered: true, wentWell: true, workOnNext: true, effort: true, sharedAt: true } },
  homework: { select: { id: true, title: true, dueAt: true, status: true } }
};
var familyStudentSelect = {
  id: true,
  firstName: true,
  lastName: true,
  level: true,
  school: true,
  birthYear: true,
  goals: true,
  status: true,
  subjects: { select: { id: true, name: true } }
};
var familyHomeworkSelect = {
  id: true,
  title: true,
  instructions: true,
  dueAt: true,
  linkUrl: true,
  file_filename: true,
  file_filesize: true,
  // fileUrl = /api/files/homework/<id> when file_filename is set
  status: true,
  handedInAt: true,
  guardianComment: true,
  handInUrl: true,
  feedback: true,
  reviewedAt: true,
  createdAt: true,
  student: { select: { id: true, firstName: true } }
};
var familyPurchaseSelect = {
  id: true,
  nameSnapshot: true,
  minutesGranted: true,
  minutesRemaining: true,
  pricePaidCents: true,
  refundedCents: true,
  status: true,
  purchasedAt: true,
  expiresAt: true,
  createdAt: true,
  entries: { select: { kind: true, minutes: true, createdAt: true, note: true, session: { select: { startsAt: true, typeNameSnapshot: true } } }, orderBy: { createdAt: "desc" }, take: 100 }
};
var familyInvoiceSelect = {
  id: true,
  number: true,
  status: true,
  issuedAt: true,
  dueAt: true,
  subtotalCents: true,
  totalCents: true,
  paidCents: true,
  note: true,
  createdAt: true,
  lines: { select: { description: true, quantity: true, unitCents: true, totalCents: true }, orderBy: { sortOrder: "asc" } },
  payments: { select: { id: true, method: true, status: true, amountCents: true, reference: true, paidAt: true, kind: true }, orderBy: { createdAt: "asc" } }
};
var isOverdue = (i) => i.status === "sent" && Boolean(i.dueAt && i.dueAt.getTime() < Date.now()) && i.paidCents < i.totalCents;
function iso(value) {
  return JSON.parse(JSON.stringify(value));
}

// features/keystone/utils/publicOps.ts
init_ledger();
var origin = () => trustedOrigin();
var bookingLink = (id, token) => `${origin()}/booking/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;
var invoiceLink = (id, token) => `${origin()}/invoice/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;
var fmtWhen = (d, tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "short", timeZoneName: "short" }).format(d);
async function profileBySlug(db, slug) {
  const p = await db.tutorProfile.findUnique({ where: { slug: cleanText(slug, 60).toLowerCase() } });
  if (!p) throw new CommandError("This tutor page was not found.");
  return p;
}
async function publicTutor(prisma, slug) {
  const db = guarded(prisma);
  const p = await db.tutorProfile.findUnique({
    where: { slug: cleanText(slug, 60).toLowerCase() },
    include: {
      subjects: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, levels: true, description: true, imageUrl: true } },
      sessionTypes: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }], select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true, mode: true, openToNewFamilies: true, maxStudents: true, subjects: { select: { id: true } } } },
      packages: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { minutes: "asc" }], select: { id: true, name: true, description: true, minutes: true, priceCents: true, validMonths: true, appliesTo: { select: { id: true, name: true } } } },
      weeklyHours: { select: { dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } },
      reviews: { where: { status: "published" }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, displayName: true, rating: true, body: true, createdAt: true } }
    }
  });
  if (!p) return null;
  const ratings = p.reviews.map((r) => r.rating);
  return iso({
    slug: p.slug,
    businessName: p.businessName,
    tutorName: p.tutorName,
    headline: p.headline,
    bio: p.bio,
    qualifications: p.qualifications,
    photoUrl: p.photoUrl,
    heroImageUrl: p.heroImageUrl,
    phone: p.phone,
    email: p.email,
    city: p.city,
    country: p.country,
    timezone: p.timezone,
    currencyCode: p.currencyCode,
    teachesOnline: p.teachesOnline,
    teachesInPerson: p.teachesInPerson,
    inPersonArea: p.inPersonArea,
    bookingOpen: p.bookingOpen,
    minNoticeHours: p.minNoticeHours,
    maxAdvanceDays: p.maxAdvanceDays,
    cancellationWindowHours: p.cancellationWindowHours,
    lateCancelPercent: p.lateCancelPercent,
    noShowPercent: p.noShowPercent,
    unpaidHoldMinutes: p.unpaidHoldMinutes,
    reschedulesAllowed: p.reschedulesAllowed,
    policiesText: p.policiesText,
    cardPayments: stripeOn() && Boolean(await cardProvider(db, p.id)),
    reviewsEnabled: p.reviewsEnabled,
    subjects: p.subjects,
    sessionTypes: p.sessionTypes.map((t) => ({ ...t, subjectIds: t.subjects.map((s) => s.id), subjects: void 0 })),
    packages: p.packages,
    hours: p.weeklyHours,
    reviews: p.reviewsEnabled ? p.reviews : [],
    rating: ratings.length ? { average: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10, count: ratings.length } : null
  });
}
async function homeTutor(prisma) {
  const first = await guarded(prisma).tutorProfile.findFirst({ where: { bookingOpen: true }, orderBy: { createdAt: "asc" }, select: { slug: true } }) ?? await guarded(prisma).tutorProfile.findFirst({ orderBy: { createdAt: "asc" }, select: { slug: true } });
  return first ? publicTutor(prisma, first.slug) : null;
}
async function publicSlots(prisma, input, session) {
  const db = guarded(prisma);
  const profile = await profileBySlug(db, input.slug);
  await releaseUnpaidHolds(prisma, profile.id).catch((e) => console.error("[tutor] hold release failed", e instanceof Error ? e.message : e));
  if (!profile.bookingOpen) throw new CommandError("Online booking is closed. Send your tutor a message instead.");
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id, active: true } });
  if (!type) throw new CommandError("Choose a kind of session.");
  let exclude = null;
  if (input.excludeSessionId) {
    const s = await db.session.findFirst({ where: { id: input.excludeSessionId, profileId: profile.id }, select: { id: true, publicAccessTokenHash: true, family: { select: { userId: true } }, startsAt: true, endsAt: true } });
    const mine = s && (input.token && publicAccessTokenMatches(input.token, s.publicAccessTokenHash) || session?.itemId && s.family?.userId === session.itemId);
    if (!mine) throw new CommandError("This booking link is not valid.");
    exclude = s.id;
    const duration = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 6e4);
    return { date: input.date, timezone: input.timezone || profile.timezone, tutorTimezone: profile.timezone, slots: await slotsForDay(db, profile, { durationMinutes: duration }, input.date, input.timezone, exclude) };
  }
  return { date: input.date, timezone: input.timezone || profile.timezone, tutorTimezone: profile.timezone, slots: await slotsForDay(db, profile, type, input.date, input.timezone) };
}
async function bookFirstSession(prisma, input) {
  const db = guarded(prisma);
  const visitor = cleanVisitor({ ...input, needs: input.message });
  const timezone = validTimeZone(input.timezone);
  const startsAt = parseInstant(input.startsAt);
  const profile = await profileBySlug(db, input.slug);
  if (!profile.bookingOpen) throw new CommandError("Online booking is closed. Send your tutor a message instead.");
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id, active: true } });
  if (!type) throw new CommandError("Choose a kind of session.");
  if (!type.openToNewFamilies) throw new CommandError("This kind of session is for current families. Book a first session or consultation instead.");
  await releaseUnpaidHolds(prisma, profile.id);
  const result = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profile.id);
    const { family, student } = await familyForVisitor(tx, profile.id, { ...visitor, timezone });
    const { bookInLock: bookInLock2 } = await Promise.resolve().then(() => (init_booking(), booking_exports));
    const fresh = await tx.tutorProfile.findUniqueOrThrow({ where: { id: profile.id } });
    return bookInLock2(tx, { profile: fresh, type, family, studentIds: [student.id], startsAt, actor: "visitor", mode: input.mode, message: visitor.needs });
  });
  const s = result.session;
  const link = bookingLink(s.id, result.token);
  const tz = timezone || profile.timezone;
  void notify(prisma, { profileId: profile.id, kind: "booking_confirmed", to: visitor.email, subject: s.status === "pending_payment" ? `Finish booking: ${type.name}` : `Booked: ${type.name} with ${profile.businessName}`, lines: [`Hi ${visitor.guardianName},`, s.status === "pending_payment" ? `Your time is held until ${fmtWhen(s.holdEndsAt, tz)}. Pay to confirm it.` : `${type.name} for ${visitor.studentName} is booked for ${fmtWhen(s.startsAt, tz)}.`, "Open your booking to see the lesson link, add it to your calendar, pay, move or cancel it."], link, linkLabel: "Open your booking", replyTo: profile.email, sessionId: s.id });
  void notify(prisma, { profileId: profile.id, kind: "tutor_new_booking", to: profile.email, subject: `New booking: ${visitor.guardianName}, ${fmtWhen(s.startsAt, profile.timezone)}`, lines: [`${visitor.guardianName} booked ${type.name} for ${visitor.studentName} (${visitor.studentLevel || "level not given"}).`, visitor.needs ? `They wrote: ${visitor.needs}` : ""].filter(Boolean), link: `${origin()}/dashboard/platform/sessions/${s.id}`, linkLabel: "Open in your dashboard", sessionId: s.id });
  return { bookingId: s.id, token: result.token, status: s.status, funding: s.funding, needsPayment: s.status === "pending_payment", holdEndsAt: s.holdEndsAt?.toISOString() ?? null, bookingUrl: link };
}
async function bookingByToken(db, id, token) {
  const s = await db.session.findUnique({ where: { id }, select: { id: true, profileId: true, publicAccessTokenHash: true } });
  if (!s || !publicAccessTokenMatches(token, s.publicAccessTokenHash)) throw new CommandError("This booking link is not valid.");
  return s;
}
async function sessionView(prisma, id) {
  const db = guarded(prisma);
  const s = await db.session.findUniqueOrThrow({ where: { id }, select: { ...familySessionSelect, profileId: true, familyId: true, family: { select: { guardianName: true, email: true, timezone: true, userId: true } }, sessionType: { select: { durationMinutes: true } } } });
  const p = await db.tutorProfile.findUniqueOrThrow({ where: { id: s.profileId } });
  const known = s.family?.userId || s.status !== "pending_payment";
  const meetingUrl = s.mode === "online" ? s.meetingUrl || s.students.find((x) => x.meetingUrl)?.meetingUrl || p.defaultMeetingUrl : "";
  const payable = s.funding === "card" && s.paymentStatus === "unpaid" && ["pending_payment", "scheduled", "completed"].includes(s.status);
  const card = payable && stripeOn() && Boolean(await cardProvider(db, p.id));
  const duration = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 6e4);
  const terms = ["scheduled", "pending_payment"].includes(s.status) ? cancelTerms(p, s, duration) : null;
  const canMove = s.status === "scheduled" && !insideWindow(p, s.startsAt) && s.rescheduleCount < p.reschedulesAllowed;
  const reported = await db.payment.findMany({ where: { sessionId: s.id, kind: "session" }, select: { id: true, method: true, status: true, amountCents: true, reference: true, paidAt: true }, take: 20 });
  return iso({
    id: s.id,
    status: s.status,
    funding: s.funding,
    paymentStatus: s.paymentStatus,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    durationMinutes: duration,
    sessionName: s.typeNameSnapshot,
    sessionTypeId: s.sessionTypeId,
    priceCents: s.priceCents,
    chargedCents: s.chargedCents,
    chargedMinutes: s.chargedMinutes,
    currencyCode: p.currencyCode,
    mode: s.mode,
    meetingUrl: known ? meetingUrl : "",
    locationText: s.mode === "in_person" ? s.locationText || p.inPersonArea : "",
    holdEndsAt: s.status === "pending_payment" ? s.holdEndsAt : null,
    released: s.status === "released",
    cancellationReason: s.cancellationReason,
    cancelledBy: s.cancelledBy,
    rescheduleCount: s.rescheduleCount,
    rescheduledFrom: s.rescheduledFrom,
    students: s.students.map((x) => ({ id: x.id, firstName: x.firstName })),
    note: s.note?.sharedAt ? { covered: s.note.covered, wentWell: s.note.wentWell, workOnNext: s.note.workOnNext, effort: s.note.effort, sharedAt: s.note.sharedAt } : null,
    homework: s.homework,
    payments: reported,
    tutor: { slug: p.slug, businessName: p.businessName, tutorName: p.tutorName, photoUrl: p.photoUrl, phone: p.phone, email: p.email, timezone: p.timezone },
    familyTimezone: s.family?.timezone || "",
    guardianName: s.family?.guardianName ?? "",
    hasAccount: Boolean(s.family?.userId),
    canPayByCard: card,
    payDirectly: payable && !card,
    paymentInstructions: payable || s.funding === "invoice" ? p.paymentInstructions : "",
    canCancel: Boolean(terms) && s.startsAt.getTime() > Date.now(),
    cancelTerms: terms?.text ?? null,
    cancelIsLate: terms?.late ?? false,
    canReschedule: canMove,
    rescheduleClosedReason: s.status === "scheduled" && !canMove ? insideWindow(p, s.startsAt) ? `Moving closes ${p.cancellationWindowHours} hours before the session. Contact your tutor.` : "This session has been moved the most times allowed. Contact your tutor." : null,
    calendarUrl: `/api/calendar/session/${s.id}`
  });
}
async function publicBooking(prisma, id, token) {
  const db = guarded(prisma);
  const s = await bookingByToken(db, id, token);
  await settleTarget(prisma, "session", s.id).catch(() => null);
  await releaseUnpaidHolds(prisma, s.profileId, s.id).catch(() => null);
  const view = await sessionView(prisma, s.id);
  return { ...view, calendarUrl: `/api/calendar/session/${s.id}?t=${encodeURIComponent(token)}` };
}
async function payForSessionRow(prisma, sessionId, backUrl) {
  const db = guarded(prisma);
  await settleTarget(prisma, "session", sessionId).catch(() => null);
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { profile: true, family: { select: { email: true } } } });
  if (s.status === "pending_payment" && s.holdEndsAt && s.holdEndsAt <= /* @__PURE__ */ new Date()) {
    await releaseUnpaidHolds(prisma, s.profileId, s.id);
    throw new CommandError("The time was not paid for before the hold ended, so it was released. Book again.");
  }
  if (s.status === "released") throw new CommandError("The time was not paid for before the hold ended, so it was released. Book again.");
  if (s.funding !== "card" || s.paymentStatus !== "unpaid" || !["pending_payment", "scheduled", "completed"].includes(s.status)) throw new CommandError("This session has nothing to pay.");
  return openCheckout(prisma, { profile: s.profile, target: "session", targetId: s.id, amountCents: s.priceCents, description: `${s.typeNameSnapshot} \xB7 ${s.profile.businessName}`, email: s.family?.email, backUrl, holdEndsAt: s.status === "pending_payment" ? s.holdEndsAt : null });
}
async function payForBooking(prisma, id, token) {
  const s = await bookingByToken(guarded(prisma), id, token);
  return payForSessionRow(prisma, s.id, bookingLink(s.id, token));
}
async function confirmBookingPayment(prisma, id, token) {
  const s = await bookingByToken(guarded(prisma), id, token);
  const r = await settleTarget(prisma, "session", s.id);
  return { paid: r.paid || (await guarded(prisma).session.findUniqueOrThrow({ where: { id: s.id }, select: { paymentStatus: true } })).paymentStatus === "paid" };
}
async function afterChange(prisma, sessionId, kind, link) {
  const s = await guarded(prisma).session.findUnique({ where: { id: sessionId }, include: { profile: true, family: { select: { email: true, guardianName: true, timezone: true } } } });
  if (!s) return;
  const tz = s.family?.timezone || s.profile.timezone;
  const what = kind === "cancelled" ? `${s.typeNameSnapshot} on ${fmtWhen(s.startsAt, tz)} is cancelled.` : `${s.typeNameSnapshot} is now on ${fmtWhen(s.startsAt, tz)}.`;
  void notify(prisma, { profileId: s.profileId, kind: kind === "cancelled" ? "session_cancelled" : "session_moved", to: s.family?.email, subject: kind === "cancelled" ? "Session cancelled" : "Session moved", lines: [`Hi ${s.family?.guardianName ?? ""},`, what], link: link ?? `${origin()}/account/sessions/${s.id}`, linkLabel: "Open the session", replyTo: s.profile.email, sessionId: s.id });
  void notify(prisma, { profileId: s.profileId, kind: kind === "cancelled" ? "tutor_session_cancelled" : "tutor_session_moved", to: s.profile.email, subject: `${s.family?.guardianName ?? "A family"}: ${kind === "cancelled" ? "cancelled" : "moved"} a session`, lines: [what], link: `${origin()}/dashboard/platform/sessions/${s.id}`, linkLabel: "Open in your dashboard", sessionId: s.id });
}
async function cancelMyBooking(prisma, id, token, reason) {
  const s = await bookingByToken(guarded(prisma), id, token);
  const r = await cancelSession(prisma, { sessionId: s.id, by: "guardian", profileId: s.profileId, reason: cleanText(reason, 300) });
  void afterChange(prisma, s.id, "cancelled", bookingLink(s.id, token));
  return r;
}
async function rescheduleMyBooking(prisma, id, token, startsAt) {
  const s = await bookingByToken(guarded(prisma), id, token);
  const r = await rescheduleSession(prisma, { sessionId: s.id, by: "guardian", profileId: s.profileId, startsAt: parseInstant(startsAt) });
  void afterChange(prisma, s.id, "moved", bookingLink(s.id, token));
  return r;
}
async function sendInquiry(prisma, input) {
  const db = guarded(prisma);
  const profile = await profileBySlug(db, input.slug);
  const name = cleanText(input.name, 120);
  const email = cleanText(input.email, 200).toLowerCase();
  const phone = cleanText(input.phone, 40);
  if (!name) throw new CommandError("Enter your name.");
  if (!email && !phone) throw new CommandError("Enter an email or a phone number so your tutor can reply.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommandError("Enter a valid email.");
  const recent = await db.inquiry.count({ where: { profileId: profile.id, createdAt: { gt: new Date(Date.now() - 36e5) }, OR: [...email ? [{ email }] : [], ...phone ? [{ phone }] : []] } });
  if (recent >= 3) throw new CommandError("Your message was already sent. Your tutor will reply soon.");
  const q2 = await db.inquiry.create({ data: { profileId: profile.id, name, email, phone, studentLevel: cleanText(input.studentLevel, 80), subject: cleanText(input.subject, 120), message: cleanText(input.message, 3e3), status: "new" } });
  void notify(prisma, { profileId: profile.id, kind: "tutor_new_inquiry", to: profile.email, subject: `New message from ${name}`, lines: [`${name} (${[email, phone].filter(Boolean).join(", ")}) asked about tutoring${q2.subject ? ` in ${q2.subject}` : ""}${q2.studentLevel ? ` for ${q2.studentLevel}` : ""}.`, q2.message], link: `${origin()}/dashboard/platform/inquiries`, linkLabel: "Open inquiries" });
  return { id: q2.id, sent: true };
}
async function publicInvoice(prisma, id, token) {
  const db = guarded(prisma);
  const inv = await db.invoice.findUnique({ where: { id }, select: { id: true, publicAccessTokenHash: true, status: true } });
  if (!inv || inv.status === "draft" || !publicAccessTokenMatches(token, inv.publicAccessTokenHash)) throw new CommandError("This invoice link is not valid.");
  await settleTarget(prisma, "invoice", inv.id).catch(() => null);
  return invoiceView(prisma, inv.id);
}
async function invoiceView(prisma, id) {
  const db = guarded(prisma);
  const inv = await db.invoice.findUniqueOrThrow({ where: { id }, select: { ...familyInvoiceSelect, profileId: true, family: { select: { guardianName: true } } } });
  const p = await db.tutorProfile.findUniqueOrThrow({ where: { id: inv.profileId } });
  const open = inv.status === "sent" && inv.paidCents < inv.totalCents;
  const card = open && stripeOn() && Boolean(await cardProvider(db, p.id));
  return iso({
    ...inv,
    profileId: void 0,
    family: void 0,
    guardianName: inv.family?.guardianName ?? "",
    overdue: isOverdue(inv),
    balanceCents: inv.totalCents - inv.paidCents,
    currencyCode: p.currencyCode,
    tutor: { businessName: p.businessName, email: p.email, phone: p.phone, slug: p.slug },
    canPayByCard: card,
    paymentInstructions: open ? p.paymentInstructions : ""
  });
}
async function payInvoiceByToken(prisma, id, token) {
  const db = guarded(prisma);
  const inv = await db.invoice.findUnique({ where: { id }, select: { id: true, publicAccessTokenHash: true } });
  if (!inv || !publicAccessTokenMatches(token, inv.publicAccessTokenHash)) throw new CommandError("This invoice link is not valid.");
  return payInvoiceRow(prisma, inv.id, invoiceLink(inv.id, token));
}
async function payInvoiceRow(prisma, invoiceId, backUrl) {
  await settleTarget(prisma, "invoice", invoiceId).catch(() => null);
  const inv = await guarded(prisma).invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { profile: true, family: { select: { email: true } } } });
  if (inv.status !== "sent" || inv.paidCents >= inv.totalCents) throw new CommandError("This invoice has nothing left to pay.");
  await guarded(prisma).paymentSession.updateMany({ where: { invoiceId, status: "pending" }, data: { status: "cancelled" } });
  return openCheckout(prisma, { profile: inv.profile, target: "invoice", targetId: inv.id, amountCents: inv.totalCents - inv.paidCents, description: `Invoice ${inv.number} \xB7 ${inv.profile.businessName}`, email: inv.family?.email, backUrl });
}
async function myFamily(prisma, session) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  await releaseUnpaidHolds(prisma, f.profileId).catch(() => null);
  await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, f.profileId);
    await expirePurchases(tx, f.profileId, f.id);
  }).catch(() => null);
  const now = /* @__PURE__ */ new Date();
  const [upcoming, purchases, invoices, homework, notes, students, completed, review] = await Promise.all([
    db.session.findMany({ where: { familyId: f.id, status: { in: ["scheduled", "pending_payment"] }, endsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 5, select: familySessionSelect }),
    db.packagePurchase.findMany({ where: { familyId: f.id, status: { in: ["active", "awaiting_payment"] } }, select: { id: true, nameSnapshot: true, minutesRemaining: true, minutesGranted: true, status: true, expiresAt: true }, take: 20 }),
    db.invoice.findMany({ where: { familyId: f.id, status: "sent" }, select: { id: true, number: true, totalCents: true, paidCents: true, dueAt: true, status: true }, take: 50 }),
    db.homework.findMany({ where: { student: { familyId: f.id }, status: "assigned" }, orderBy: { dueAt: "asc" }, take: 10, select: { id: true, title: true, dueAt: true, student: { select: { firstName: true } } } }),
    db.sessionNote.findMany({ where: { session: { familyId: f.id }, sharedAt: { not: null, gt: new Date(now.getTime() - 14 * 864e5) } }, orderBy: { sharedAt: "desc" }, take: 5, select: { workOnNext: true, covered: true, sharedAt: true, session: { select: { id: true, startsAt: true, typeNameSnapshot: true } } } }),
    db.student.findMany({ where: { familyId: f.id }, select: familyStudentSelect, take: 20 }),
    db.session.count({ where: { familyId: f.id, status: "completed" } }),
    db.review.count({ where: { familyId: f.id } })
  ]);
  const unpaidSessions = await db.session.aggregate({ where: { familyId: f.id, funding: "card", paymentStatus: "unpaid", status: { in: ["scheduled", "completed"] } }, _sum: { priceCents: true } });
  const minutesLeft = purchases.filter((p) => p.status === "active").reduce((a, p) => a + p.minutesRemaining, 0);
  const shortest = await db.sessionType.findFirst({ where: { profileId: f.profileId, active: true, priceCents: { gt: 0 } }, orderBy: { durationMinutes: "asc" }, select: { durationMinutes: true } });
  const owing = invoices.reduce((a, i) => a + i.totalCents - i.paidCents, 0) + (unpaidSessions._sum.priceCents ?? 0);
  return iso({
    family: { id: f.id, guardianName: f.guardianName, email: f.email, phone: f.phone, secondContactName: f.secondContactName, secondContactPhone: f.secondContactPhone, address: f.address, timezone: f.timezone, billingMode: f.billingMode, status: f.status, monthlyFeeCents: f.monthlyFeeCents },
    tutor: { slug: f.profile.slug, businessName: f.profile.businessName, tutorName: f.profile.tutorName, photoUrl: f.profile.photoUrl, email: f.profile.email, phone: f.profile.phone, timezone: f.profile.timezone, currencyCode: f.profile.currencyCode, paymentInstructions: f.profile.paymentInstructions, cancellationWindowHours: f.profile.cancellationWindowHours, lateCancelPercent: f.profile.lateCancelPercent, noShowPercent: f.profile.noShowPercent, policiesText: f.profile.policiesText, cardPayments: stripeOn() && Boolean(await cardProvider(db, f.profileId)) },
    upcoming,
    students,
    packages: purchases,
    minutesLeft,
    lowBalance: purchases.some((p) => p.status === "active") && minutesLeft < (shortest?.durationMinutes ?? 60),
    owingCents: owing,
    overdueInvoices: invoices.filter(isOverdue).length,
    openInvoices: invoices,
    homeworkDue: homework,
    newNotes: notes,
    canReview: f.profile.reviewsEnabled && completed >= 3 && review === 0
  });
}
var RANGE = { upcoming: "upcoming", past: "past", all: "all" };
async function mySessions(prisma, session, range) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const now = /* @__PURE__ */ new Date();
  const r = RANGE[range || "upcoming"] ?? "upcoming";
  const where = r === "upcoming" ? { endsAt: { gt: now }, status: { in: ["scheduled", "pending_payment"] } } : r === "past" ? { OR: [{ endsAt: { lte: now } }, { status: { notIn: ["scheduled", "pending_payment"] } }] } : {};
  const rows = await db.session.findMany({ where: { familyId: f.id, ...where }, orderBy: { startsAt: r === "upcoming" ? "asc" : "desc" }, take: 200, select: familySessionSelect });
  return iso({ range: r, timezone: f.timezone || f.profile.timezone, currencyCode: f.profile.currencyCode, sessions: rows });
}
async function mySession(prisma, session, id) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const s = await db.session.findFirst({ where: { id, familyId: f.id }, select: { id: true } });
  if (!s) throw new CommandError("Session not found.");
  await settleTarget(prisma, "session", s.id).catch(() => null);
  await releaseUnpaidHolds(prisma, f.profileId, s.id).catch(() => null);
  return sessionView(prisma, s.id);
}
async function ownSession(prisma, session, id) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const s = await db.session.findFirst({ where: { id, familyId: f.id }, select: { id: true, profileId: true } });
  if (!s) throw new CommandError("Session not found.");
  return { f, s };
}
async function bookSession(prisma, session, input) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  if (!f.profile.bookingOpen) throw new CommandError("Online booking is closed. Contact your tutor.");
  const r = await book(prisma, { profileId: f.profileId, familyId: f.id, sessionTypeId: input.sessionTypeId, studentIds: input.studentIds, startsAt: parseInstant(input.startsAt), actor: "guardian", message: cleanText(input.message, 1e3), mode: input.mode });
  const s = r.session;
  let packageLeft = null;
  if (s.funding === "package") {
    const entry = await db.creditEntry.findFirst({ where: { sessionId: s.id }, select: { purchase: { select: { minutesRemaining: true, nameSnapshot: true } } } });
    packageLeft = entry?.purchase?.minutesRemaining ?? null;
  }
  void notify(prisma, { profileId: f.profileId, kind: "tutor_new_booking", to: f.profile.email, subject: `${f.guardianName} booked ${s.typeNameSnapshot}`, lines: [`${f.guardianName} booked ${s.typeNameSnapshot} for ${fmtWhen(s.startsAt, f.profile.timezone)}.`], link: `${origin()}/dashboard/platform/sessions/${s.id}`, linkLabel: "Open in your dashboard", sessionId: s.id });
  return { sessionId: s.id, status: s.status, funding: s.funding, needsPayment: s.status === "pending_payment", holdEndsAt: s.holdEndsAt?.toISOString() ?? null, packageMinutesLeft: packageLeft, priceCents: s.priceCents };
}
async function cancelMySession(prisma, session, id, reason) {
  const { s } = await ownSession(prisma, session, id);
  const r = await cancelSession(prisma, { sessionId: s.id, by: "guardian", profileId: s.profileId, reason: cleanText(reason, 300) });
  void afterChange(prisma, s.id, "cancelled", null);
  return r;
}
async function rescheduleMySession(prisma, session, id, startsAt) {
  const { s } = await ownSession(prisma, session, id);
  const r = await rescheduleSession(prisma, { sessionId: s.id, by: "guardian", profileId: s.profileId, startsAt: parseInstant(startsAt) });
  void afterChange(prisma, s.id, "moved", null);
  return r;
}
async function payForSession(prisma, session, id) {
  const { s } = await ownSession(prisma, session, id);
  return payForSessionRow(prisma, s.id, `${origin()}/account/sessions/${encodeURIComponent(s.id)}`);
}
async function confirmSessionPayment(prisma, session, id) {
  const { s } = await ownSession(prisma, session, id);
  const r = await settleTarget(prisma, "session", s.id);
  return { paid: r.paid || (await guarded(prisma).session.findUniqueOrThrow({ where: { id: s.id }, select: { paymentStatus: true } })).paymentStatus === "paid" };
}
async function myStudents(prisma, session) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  return iso({ students: await db.student.findMany({ where: { familyId: f.id }, select: familyStudentSelect, orderBy: { createdAt: "asc" }, take: 50 }) });
}
async function myHomework(prisma, session, status) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const st = ["assigned", "handed_in", "reviewed"].includes(status || "") ? { status } : {};
  return iso({ homework: await db.homework.findMany({ where: { student: { familyId: f.id }, ...st }, select: familyHomeworkSelect, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 200 }) });
}
async function myPackages(prisma, session) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  for (const p of await db.packagePurchase.findMany({ where: { familyId: f.id, status: "awaiting_payment" }, select: { id: true }, take: 10 })) await settleTarget(prisma, "package", p.id).catch(() => null);
  await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, f.profileId);
    await expirePurchases(tx, f.profileId, f.id);
  }).catch(() => null);
  const [purchases, offered] = await Promise.all([
    db.packagePurchase.findMany({ where: { familyId: f.id, status: { not: "cancelled" } }, select: { ...familyPurchaseSelect, payments: { select: { id: true, method: true, status: true, amountCents: true, reference: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.package.findMany({ where: { profileId: f.profileId, active: true }, select: { id: true, name: true, description: true, minutes: true, priceCents: true, validMonths: true, appliesTo: { select: { id: true, name: true } } }, orderBy: [{ sortOrder: "asc" }, { minutes: "asc" }] })
  ]);
  return iso({ currencyCode: f.profile.currencyCode, cardPayments: stripeOn() && Boolean(await cardProvider(db, f.profileId)), paymentInstructions: f.profile.paymentInstructions, purchases, packages: offered });
}
async function buyPackage(prisma, session, packageId, method) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  if (!["card", "direct"].includes(method)) throw new CommandError("Choose card or pay your tutor directly.");
  if (method === "card" && !(stripeOn() && await cardProvider(db, f.profileId))) throw new CommandError("Card payments are not set up. Pay your tutor directly.");
  const purchase = await startPurchase(prisma, f.profileId, f.id, packageId);
  if (method === "direct") {
    void notify(prisma, { profileId: f.profileId, kind: "tutor_package_requested", to: f.profile.email, subject: `${f.guardianName} wants ${purchase.nameSnapshot}`, lines: [`${f.guardianName} chose to pay you directly for ${purchase.nameSnapshot}. Confirm the payment when it arrives to make the minutes usable.`], link: `${origin()}/dashboard/platform/families/${f.id}`, linkLabel: "Open the family" });
    return { purchaseId: purchase.id, status: purchase.status, paymentInstructions: f.profile.paymentInstructions, checkoutUrl: null };
  }
  const checkout = await openCheckout(prisma, { profile: f.profile, target: "package", targetId: purchase.id, amountCents: purchase.pricePaidCents, description: `${purchase.nameSnapshot} \xB7 ${f.profile.businessName}`, email: f.email, backUrl: `${origin()}/account/packages?purchase=${encodeURIComponent(purchase.id)}` });
  return { purchaseId: purchase.id, status: purchase.status, paymentInstructions: "", checkoutUrl: checkout.url };
}
async function confirmPackagePayment(prisma, session, purchaseId) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const p = await db.packagePurchase.findFirst({ where: { id: purchaseId, familyId: f.id }, select: { id: true } });
  if (!p) throw new CommandError("Package not found.");
  await settleTarget(prisma, "package", p.id);
  const fresh = await db.packagePurchase.findUniqueOrThrow({ where: { id: p.id }, select: { status: true, minutesRemaining: true } });
  return { paid: fresh.status !== "awaiting_payment" && fresh.status !== "cancelled", status: fresh.status, minutesRemaining: fresh.minutesRemaining };
}
async function myInvoices(prisma, session) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const rows = await db.invoice.findMany({ where: { familyId: f.id, status: { in: ["sent", "paid", "void"] } }, select: { id: true, number: true, status: true, issuedAt: true, dueAt: true, totalCents: true, paidCents: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return iso({ currencyCode: f.profile.currencyCode, invoices: rows.map((i) => ({ ...i, overdue: isOverdue(i), balanceCents: i.status === "void" ? 0 : i.totalCents - i.paidCents })) });
}
async function myInvoice(prisma, session, id) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const inv = await db.invoice.findFirst({ where: { id, familyId: f.id, status: { in: ["sent", "paid", "void"] } }, select: { id: true } });
  if (!inv) throw new CommandError("Invoice not found.");
  await settleTarget(prisma, "invoice", inv.id).catch(() => null);
  return invoiceView(prisma, inv.id);
}
async function payInvoice(prisma, session, id) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const inv = await db.invoice.findFirst({ where: { id, familyId: f.id }, select: { id: true } });
  if (!inv) throw new CommandError("Invoice not found.");
  return payInvoiceRow(prisma, inv.id, `${origin()}/account/invoices/${encodeURIComponent(inv.id)}`);
}
async function confirmInvoicePayment(prisma, session, id, token) {
  const db = guarded(prisma);
  let invoiceId;
  if (token && id) {
    const inv = await db.invoice.findUnique({ where: { id }, select: { id: true, publicAccessTokenHash: true } });
    if (!inv || !publicAccessTokenMatches(token, inv.publicAccessTokenHash)) throw new CommandError("This invoice link is not valid.");
    invoiceId = inv.id;
  } else {
    const f = await requireFamily(db, session);
    const inv = await db.invoice.findFirst({ where: { id: id ?? "", familyId: f.id }, select: { id: true } });
    if (!inv) throw new CommandError("Invoice not found.");
    invoiceId = inv.id;
  }
  await settleTarget(prisma, "invoice", invoiceId);
  const fresh = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true, paidCents: true, totalCents: true } });
  return { paid: fresh.status === "paid", status: fresh.status, balanceCents: fresh.totalCents - fresh.paidCents };
}
async function reportPayment2(prisma, session, input) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  if (!["session", "package", "invoice"].includes(input.target)) throw new CommandError("Choose what the payment is for.");
  const r = await reportPayment(prisma, f.profileId, f.id, { target: { kind: input.target, id: input.targetId }, amountCents: input.amountCents, method: input.method, reference: input.reference });
  void notify(prisma, { profileId: f.profileId, kind: "tutor_payment_reported", to: f.profile.email, subject: `${f.guardianName} reported a payment`, lines: [`${f.guardianName} says they paid ${(input.amountCents / 100).toFixed(2)} ${f.profile.currencyCode} by ${input.method.replace("_", " ")} (reference ${cleanText(input.reference, 120)}). Confirm it when you see the money.`], link: `${origin()}/dashboard/platform/billing`, linkLabel: "Open billing" });
  return r;
}
async function myResources(prisma, session) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const ids = (await db.student.findMany({ where: { familyId: f.id, status: "active" }, select: { id: true } })).map((s) => s.id);
  const rows = await db.resource.findMany({ where: { profileId: f.profileId, OR: [{ students: { some: { id: { in: ids } } } }, { students: { none: {} } }] }, select: { id: true, title: true, linkUrl: true, file_filename: true, file_filesize: true, note: true, createdAt: true, students: { where: { familyId: f.id }, select: { id: true, firstName: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return iso({ resources: rows.map((r) => ({ ...r, fileUrl: r.file_filename ? `/api/files/resource/${r.id}` : null, file_filename: void 0 })) });
}
async function myProgress(prisma, session, studentId) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const student = await db.student.findFirst({ where: { id: studentId, familyId: f.id }, select: familyStudentSelect });
  if (!student) throw new CommandError("Student not found.");
  const [marks, notes, homework] = await Promise.all([
    db.progressMark.findMany({ where: { studentId: student.id }, select: { id: true, label: true, takenOn: true, score: true, outOf: true, note: true }, orderBy: { takenOn: "asc" }, take: 300 }),
    db.sessionNote.findMany({ where: { session: { students: { some: { id: student.id } } }, sharedAt: { not: null } }, select: { covered: true, wentWell: true, workOnNext: true, effort: true, sharedAt: true, session: { select: { id: true, startsAt: true, typeNameSnapshot: true } } }, orderBy: { sharedAt: "desc" }, take: 100 }),
    db.homework.findMany({ where: { studentId: student.id }, select: familyHomeworkSelect, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  return iso({ student, marks: marks.map((m) => ({ ...m, percent: Math.round(m.score / m.outOf * 100) })), notes, homework });
}
async function myCalendarFeedUrl(prisma, session) {
  const db = guarded(prisma);
  const f = await requireFamily(db, session);
  const { calendarFeedToken: calendarFeedToken2 } = await Promise.resolve().then(() => (init_family(), family_exports));
  const token = await calendarFeedToken2(db, { kind: "family", id: f.id });
  return { url: `${origin()}/api/calendar/${token}.ics`, webcalUrl: `${origin().replace(/^https?/, "webcal")}/api/calendar/${token}.ics` };
}
async function publicOpenDays(prisma, input) {
  const db = guarded(prisma);
  const profile = await profileBySlug(db, input.slug);
  if (!profile.bookingOpen) return { days: [] };
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id, active: true } });
  if (!type) throw new CommandError("Choose a kind of session.");
  const n = Math.max(1, Math.min(42, Math.floor(input.days ?? 14)));
  const start = input.from || businessDateKey(/* @__PURE__ */ new Date(), input.timezone || profile.timezone);
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i);
    if ((await slotsForDay(db, profile, type, d, input.timezone)).length) out.push(d);
  }
  return { days: out };
}

// features/keystone/mutations/index.ts
init_family();
init_business();

// features/keystone/mutations/tutor.ts
init_business();

// features/keystone/utils/tutorOps.ts
init_availability();
init_booking();
init_business();
init_family();
init_ledger();
init_payments();

// features/keystone/utils/setup.ts
init_business();
init_payments();
var DAYS2 = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
var TYPICAL_HOURS = { sunday: null, monday: [900, 1200], tuesday: [900, 1200], wednesday: [900, 1200], thursday: [900, 1200], friday: null, saturday: [540, 780] };
function policyText(p) {
  const charge = (n) => n === 100 ? "charged in full" : n === 0 ? "not charged" : `charged ${n}% of the price`;
  return [
    `You can cancel or move a session for free up to ${p.cancellationWindowHours} hours before it starts.`,
    `A cancellation inside ${p.cancellationWindowHours} hours is ${charge(p.lateCancelPercent)}; a missed session is ${charge(p.noShowPercent)}.`,
    "If something serious comes up, tell me: I can excuse a late cancellation.",
    "Package minutes are valid for 12 months from purchase."
  ].join(" ");
}
async function setUpMyBusiness(prisma, userId, input) {
  const businessName = cleanText(input.businessName, 120);
  const slug = cleanText(input.slug, 41).toLowerCase();
  if (!businessName) throw new CommandError("Enter your business name.");
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) throw new CommandError("Page address: 2 to 41 lowercase letters, numbers or hyphens.");
  const timezone = validTimeZone(input.timezone);
  if (!timezone) throw new CommandError("Choose your timezone.");
  const currencyCode = (cleanText(input.currencyCode, 3) || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new CommandError("Choose a currency.");
  const rate = input.hourlyRateCents == null ? 6e3 : Math.floor(Number(input.hourlyRateCents));
  if (!Number.isSafeInteger(rate) || rate < 0 || rate > 1e7) throw new CommandError("Enter your hourly rate.");
  const online = input.teachesOnline !== false;
  const inPerson = Boolean(input.teachesInPerson);
  if (!online && !inPerson) throw new CommandError("Choose online, in person or both.");
  const typical = input.typicalSetup !== false;
  const subjects = (input.subjects ?? []).map((s) => cleanText(s, 80)).filter(Boolean).slice(0, 20);
  const levels = cleanText(input.levels, 120);
  const mode = online && inPerson ? "either" : online ? "online" : "in_person";
  const policy = { cancellationWindowHours: 24, lateCancelPercent: 100, noShowPercent: 100 };
  return transaction(prisma, async (tx) => {
    if (await tx.tutorProfile.findFirst({ where: { ownerId: userId } })) throw new CommandError("Your business is already set up.");
    if (await tx.tutorProfile.findUnique({ where: { slug } })) throw new CommandError("That page address is taken. Try another.");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } });
    const profile = await tx.tutorProfile.create({
      data: {
        ownerId: userId,
        businessName,
        tutorName: cleanText(input.tutorName, 120) || user.name,
        slug,
        timezone,
        currencyCode,
        country: cleanText(input.country, 2).toUpperCase(),
        email: cleanText(input.email, 200) || user.email,
        teachesOnline: online,
        teachesInPerson: inPerson,
        ...policy,
        policiesText: typical ? policyText(policy) : "",
        paymentInstructions: typical ? "Pay by bank transfer or your usual payment app and put your child\u2019s name as the reference. Tell me when it is sent." : ""
      }
    });
    for (const [i, name] of subjects.entries()) await tx.subject.create({ data: { profileId: profile.id, name, levels, sortOrder: i } });
    await tx.weeklyHours.createMany({
      data: DAYS2.map((d) => {
        const h = typical ? TYPICAL_HOURS[d] : ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(d) ? [900, 1200] : null;
        return { profileId: profile.id, dayOfWeek: d, isWorking: Boolean(h), startMinute: h?.[0] ?? 900, endMinute: h?.[1] ?? 1200 };
      })
    });
    await tx.paymentProvider.create({ data: { profileId: profile.id, ...MANUAL_PROVIDER } });
    if (stripeOn()) await tx.paymentProvider.create({ data: { profileId: profile.id, ...STRIPE_PROVIDER } });
    if (typical) {
      const per = (minutes) => Math.round(rate * minutes / 60);
      const types = [
        { name: "Free 20-minute consultation", description: "A short call to talk about goals and how I can help. No charge.", durationMinutes: 20, priceCents: 0, openToNewFamilies: true },
        { name: "First lesson", description: "A full first lesson: I find out where the student is and we start work.", durationMinutes: 60, priceCents: per(60), openToNewFamilies: true },
        { name: "60-minute lesson", description: "A regular lesson.", durationMinutes: 60, priceCents: per(60), openToNewFamilies: false },
        { name: "90-minute lesson", description: "A longer lesson for exam years or bigger topics.", durationMinutes: 90, priceCents: per(90), openToNewFamilies: false },
        { name: "Exam review session", description: "Two hours of focused review before a test or exam.", durationMinutes: 120, priceCents: per(120), openToNewFamilies: false }
      ];
      const subjectIds = (await tx.subject.findMany({ where: { profileId: profile.id }, select: { id: true } })).map((s) => s.id);
      for (const [i, t] of types.entries()) await tx.sessionType.create({ data: { ...t, profileId: profile.id, mode, sortOrder: i, subjects: { connect: subjectIds.map((id) => ({ id })) } } });
      const packs = [{ hours: 5, off: 5 }, { hours: 10, off: 10 }, { hours: 20, off: 15 }];
      for (const [i, p] of packs.entries()) {
        await tx.package.create({ data: { profileId: profile.id, name: `${p.hours} hours`, description: `${p.hours} hours of lessons, ${p.off}% off. Valid for 12 months.`, minutes: p.hours * 60, priceCents: Math.round(rate * p.hours * (100 - p.off) / 100), validMonths: 12, sortOrder: i } });
      }
    }
    await tx.user.update({ where: { id: userId }, data: { onboardingStatus: "done" } });
    return { profileId: profile.id, slug: profile.slug };
  });
}

// features/keystone/utils/tutorOps.ts
var origin2 = () => trustedOrigin();
var fmt = (d, tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(d);
async function setUpMyBusiness2(prisma, session, input) {
  if (!session?.itemId) throw new CommandError("Sign in first.");
  if (!session.data.role?.canManageBusiness) throw new CommandError("Your role does not allow this.");
  return setUpMyBusiness(prisma, session.itemId, input);
}
async function myBusiness(prisma, session) {
  if (!session?.itemId) throw new CommandError("Sign in first.");
  const p = await guarded(prisma).tutorProfile.findFirst({ where: { ownerId: session.itemId } });
  if (!p) return { setUp: false, profile: null, stripe: stripeOn(), mail: mailConfigured() };
  const provider = await cardProvider(guarded(prisma), p.id);
  return iso({ setUp: true, profile: { id: p.id, slug: p.slug, businessName: p.businessName, timezone: p.timezone, currencyCode: p.currencyCode, bookingOpen: p.bookingOpen }, stripe: Boolean(provider), mail: mailConfigured(), pageUrl: `${origin2()}/t/${p.slug}` });
}
async function housekeeping(prisma, profileId) {
  await releaseUnpaidHolds(prisma, profileId).catch((e) => console.error("[tutor] holds", e instanceof Error ? e.message : e));
  await topUpAllSeries(prisma, profileId).catch((e) => console.error("[tutor] series", e instanceof Error ? e.message : e));
  await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId);
    await expirePurchases(tx, profileId);
  }).catch((e) => console.error("[tutor] expiry", e instanceof Error ? e.message : e));
}
var tutorSessionSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  mode: true,
  meetingUrl: true,
  status: true,
  funding: true,
  paymentStatus: true,
  typeNameSnapshot: true,
  priceCents: true,
  holdEndsAt: true,
  source: true,
  seriesId: true,
  family: { select: { id: true, guardianName: true, phone: true, email: true } },
  students: { select: { id: true, firstName: true, lastName: true, level: true, meetingUrl: true } }
};
async function today(prisma, session) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  await housekeeping(prisma, p.id);
  const { start, end } = businessDayRange(businessDateKey(/* @__PURE__ */ new Date(), p.timezone), p.timezone);
  const now = /* @__PURE__ */ new Date();
  const [sessions, unclosed, reported, invoices, inquiries, reviews, handedIn, series, purchases] = await Promise.all([
    db.session.findMany({ where: { profileId: p.id, startsAt: { gte: start, lt: end }, status: { in: ["scheduled", "pending_payment", "completed", "no_show"] } }, orderBy: { startsAt: "asc" }, select: tutorSessionSelect, take: 100 }),
    db.session.findMany({ where: { profileId: p.id, status: "scheduled", endsAt: { lt: start } }, orderBy: { startsAt: "desc" }, select: tutorSessionSelect, take: 50 }),
    db.payment.findMany({ where: { profileId: p.id, status: "reported" }, select: { id: true, kind: true, method: true, amountCents: true, reference: true, paidAt: true, family: { select: { id: true, guardianName: true } }, invoiceId: true, purchaseId: true, sessionId: true }, take: 50 }),
    db.invoice.findMany({ where: { profileId: p.id, status: "sent" }, select: { id: true, number: true, dueAt: true, totalCents: true, paidCents: true, status: true, family: { select: { id: true, guardianName: true } } }, take: 200 }),
    db.inquiry.findMany({ where: { profileId: p.id, status: "new" }, select: { id: true, name: true, subject: true, studentLevel: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.review.count({ where: { profileId: p.id, status: "pending" } }),
    db.homework.findMany({ where: { profileId: p.id, status: "handed_in" }, select: { id: true, title: true, handedInAt: true, student: { select: { id: true, firstName: true } } }, take: 50 }),
    db.recurringSeries.findMany({ where: { profileId: p.id, status: "active", NOT: { skippedDates: "" } }, select: { id: true, skippedDates: true, family: { select: { guardianName: true } } }, take: 50 }),
    db.packagePurchase.findMany({ where: { profileId: p.id, status: "active" }, select: { id: true, minutesRemaining: true, nameSnapshot: true, family: { select: { id: true, guardianName: true } } }, take: 300 })
  ]);
  const studentIds = [...new Set(sessions.flatMap((s) => s.students.map((x) => x.id)))];
  const [lastNotes, due] = await Promise.all([
    Promise.all(studentIds.map((id) => db.sessionNote.findFirst({ where: { session: { students: { some: { id } }, status: "completed" } }, orderBy: { createdAt: "desc" }, select: { workOnNext: true, createdAt: true } }).then((n) => [id, n]))),
    db.homework.findMany({ where: { studentId: { in: studentIds }, status: { in: ["assigned", "handed_in"] } }, select: { id: true, title: true, dueAt: true, status: true, studentId: true }, take: 200 })
  ]);
  const notes = Object.fromEntries(lastNotes);
  const shortest = await db.sessionType.findFirst({ where: { profileId: p.id, active: true, priceCents: { gt: 0 } }, orderBy: { durationMinutes: "asc" }, select: { durationMinutes: true } });
  const byFamily = /* @__PURE__ */ new Map();
  for (const x of purchases) if (x.family) {
    const e = byFamily.get(x.family.id) ?? { familyId: x.family.id, guardianName: x.family.guardianName, minutes: 0 };
    e.minutes += x.minutesRemaining;
    byFamily.set(x.family.id, e);
  }
  const link = (s) => s.mode === "online" ? s.meetingUrl || s.students.find((x) => x.meetingUrl)?.meetingUrl || p.defaultMeetingUrl : "";
  return iso({
    date: businessDateKey(now, p.timezone),
    timezone: p.timezone,
    currencyCode: p.currencyCode,
    sessions: sessions.map((s) => ({ ...s, joinUrl: link(s), students: s.students.map((x) => ({ ...x, lastWorkOnNext: notes[x.id]?.workOnNext ?? "", homework: due.filter((h) => h.studentId === x.id) })) })),
    attention: {
      sessionsNotClosed: unclosed,
      reportedPayments: reported,
      overdueInvoices: invoices.filter(isOverdue),
      lowBalances: [...byFamily.values()].filter((f) => f.minutes < (shortest?.durationMinutes ?? 60)),
      newInquiries: inquiries,
      reviewsToApprove: reviews,
      homeworkHandedIn: handedIn,
      seriesNeedingTime: series.map((s) => ({ id: s.id, guardianName: s.family?.guardianName ?? "", dates: s.skippedDates.split("\n").filter((d) => d >= businessDateKey(now, p.timezone)) })).filter((s) => s.dates.length)
    },
    setup: { stripe: stripeOn(), mail: mailConfigured(), bookingOpen: p.bookingOpen, hasHours: await db.weeklyHours.count({ where: { profileId: p.id, isWorking: true } }) > 0, hasTypes: await db.sessionType.count({ where: { profileId: p.id, active: true } }) > 0, meetingUrl: Boolean(p.defaultMeetingUrl), pageUrl: `${origin2()}/t/${p.slug}` }
  });
}
async function calendar(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  if (!isDateKey(input.from) || !isDateKey(input.to) || input.to < input.from || addDays(input.from, 62) < input.to) throw new CommandError("Choose a date range of up to 62 days.");
  await housekeeping(prisma, p.id);
  const start = businessDayRange(input.from, p.timezone).start;
  const end = businessDayRange(input.to, p.timezone).end;
  const [sessions, off, hours, series] = await Promise.all([
    db.session.findMany({ where: { profileId: p.id, startsAt: { lt: end }, endsAt: { gt: start }, status: { notIn: ["released"] } }, orderBy: { startsAt: "asc" }, select: tutorSessionSelect, take: 1e3 }),
    db.timeOff.findMany({ where: { profileId: p.id, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true, startsAt: true, endsAt: true, reason: true }, take: 200 }),
    db.weeklyHours.findMany({ where: { profileId: p.id }, select: { dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } }),
    db.recurringSeries.findMany({ where: { profileId: p.id, status: { in: ["active", "paused"] } }, select: { id: true, status: true, dayOfWeek: true, startMinute: true, startsOn: true, endsOn: true, skippedDates: true, mode: true, family: { select: { id: true, guardianName: true } }, sessionType: { select: { id: true, name: true, durationMinutes: true } }, students: { select: { id: true, firstName: true } } }, take: 200 })
  ]);
  const clashes = sessions.filter((s) => ["scheduled", "pending_payment"].includes(s.status) && off.some((o) => s.startsAt < o.endsAt && o.startsAt < s.endsAt)).map((s) => s.id);
  return iso({ from: input.from, to: input.to, timezone: p.timezone, sessions, timeOff: off, hours, series, insideTimeOff: clashes });
}
var ownFamily = async (db, p, id) => {
  const f = await db.family.findFirst({ where: { id, profileId: p.id } });
  if (!f) throw new CommandError("Choose a family.");
  return f;
};
async function createSessionAsTutor(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  await ownFamily(db, p, input.familyId);
  const r = await book(prisma, { profileId: p.id, familyId: input.familyId, sessionTypeId: input.sessionTypeId, studentIds: input.studentIds, startsAt: parseInstant(input.startsAt), actor: "tutor", mode: input.mode });
  if (input.meetingUrl) await db.session.update({ where: { id: r.session.id }, data: { meetingUrl: cleanUrl(input.meetingUrl) } });
  const link = bookingLink(r.session.id, r.token);
  if (input.notify !== false) {
    const f = await db.family.findUniqueOrThrow({ where: { id: input.familyId }, select: { email: true, guardianName: true, timezone: true } });
    void notify(prisma, { profileId: p.id, kind: "booking_confirmed", to: f.email, subject: `Booked: ${r.session.typeNameSnapshot}`, lines: [`Hi ${f.guardianName},`, `${r.session.typeNameSnapshot} is booked for ${fmt(r.session.startsAt, f.timezone || p.timezone)}.`], link, linkLabel: "Open the booking", replyTo: p.email, sessionId: r.session.id });
  }
  return { sessionId: r.session.id, status: r.session.status, funding: r.session.funding, bookingUrl: link };
}
async function completeSession(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const effort = input.note?.effort == null ? null : Math.floor(Number(input.note.effort));
  if (effort !== null && !(effort >= 1 && effort <= 5)) throw new CommandError("Effort is 1 to 5.");
  const hw = (input.homework ?? []).map((h) => ({ title: cleanText(h.title, 200), instructions: cleanText(h.instructions, 3e3), dueAt: h.dueAt ? parseInstant(h.dueAt, "Choose a due date.") : null, linkUrl: cleanUrl(h.linkUrl), studentId: h.studentId || null })).filter((h) => h.title);
  const share2 = input.share !== false;
  const done = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, p.id);
    const s = await completeInLock(tx, input.sessionId, p.id);
    const students = await tx.student.findMany({ where: { sessions: { some: { id: s.id } } }, select: { id: true } });
    const n = input.note ?? {};
    await tx.sessionNote.create({ data: { profileId: p.id, sessionId: s.id, covered: cleanText(n.covered, 5e3), wentWell: cleanText(n.wentWell, 5e3), workOnNext: cleanText(n.workOnNext, 5e3), effort, privateNote: cleanText(n.privateNote, 5e3), sharedAt: share2 ? /* @__PURE__ */ new Date() : null } });
    for (const h of hw) {
      const targets = h.studentId ? students.filter((x) => x.id === h.studentId) : students;
      if (h.studentId && !targets.length) throw new CommandError("Homework must be for a student in this session.");
      for (const t of targets) await tx.homework.create({ data: { profileId: p.id, sessionId: s.id, studentId: t.id, title: h.title, instructions: h.instructions, dueAt: h.dueAt, linkUrl: h.linkUrl } });
    }
    return s;
  });
  if (share2) {
    const f = done.familyId ? await db.family.findUnique({ where: { id: done.familyId }, select: { email: true, guardianName: true } }) : null;
    void notify(prisma, { profileId: p.id, kind: "note_shared", to: f?.email, subject: `Notes from today\u2019s ${done.typeNameSnapshot}`, lines: [`Hi ${f?.guardianName ?? ""},`, input.note?.covered ? `We covered: ${input.note.covered}` : "Your tutor shared notes from the session.", input.note?.workOnNext ? `To work on next: ${input.note.workOnNext}` : "", hw.length ? `Homework set: ${hw.map((h) => h.title).join(", ")}` : ""].filter(Boolean), link: `${origin2()}/account/sessions/${done.id}`, linkLabel: "Read the notes", replyTo: p.email, sessionId: done.id });
  }
  return { sessionId: done.id, status: "completed", homework: hw.length, shared: share2 };
}
async function saveSessionNote(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const s = await db.session.findFirst({ where: { id: input.sessionId, profileId: p.id }, select: { id: true, status: true, note: { select: { id: true, sharedAt: true } } } });
  if (!s) throw new CommandError("Session not found.");
  const data = { covered: cleanText(input.covered, 5e3), wentWell: cleanText(input.wentWell, 5e3), workOnNext: cleanText(input.workOnNext, 5e3), effort: input.effort == null ? null : Math.max(1, Math.min(5, Math.floor(input.effort))), privateNote: cleanText(input.privateNote, 5e3), ...input.share && !s.note?.sharedAt ? { sharedAt: /* @__PURE__ */ new Date() } : {} };
  if (s.note) await db.sessionNote.update({ where: { id: s.note.id }, data });
  else await db.sessionNote.create({ data: { ...data, profileId: p.id, sessionId: s.id } });
  return { sessionId: s.id };
}
async function markNoShow2(prisma, session, sessionId) {
  const p = await requireTutor(guarded(prisma), session, "canManageSessions");
  return markNoShow(prisma, sessionId, p.id);
}
async function cancelSessionAsTutor(prisma, session, sessionId, reason, tell) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const r = await cancelSession(prisma, { sessionId, by: "tutor", profileId: p.id, reason: cleanText(reason, 300) || "Cancelled by your tutor" });
  if (tell !== false) {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, select: { startsAt: true, typeNameSnapshot: true, family: { select: { email: true, guardianName: true, timezone: true } } } });
    void notify(prisma, { profileId: p.id, kind: "session_cancelled", to: s.family?.email, subject: "Session cancelled", lines: [`Hi ${s.family?.guardianName ?? ""},`, `${s.typeNameSnapshot} on ${fmt(s.startsAt, s.family?.timezone || p.timezone)} is cancelled. You are not charged.`, reason ? `Reason: ${reason}` : ""].filter(Boolean), link: `${origin2()}/account/sessions/${sessionId}`, linkLabel: "Open the session", replyTo: p.email, sessionId });
  }
  return r;
}
async function rescheduleSessionAsTutor(prisma, session, sessionId, startsAt, tell) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const r = await rescheduleSession(prisma, { sessionId, by: "tutor", profileId: p.id, startsAt: parseInstant(startsAt) });
  if (tell !== false) {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, select: { startsAt: true, typeNameSnapshot: true, family: { select: { email: true, guardianName: true, timezone: true } } } });
    void notify(prisma, { profileId: p.id, kind: "session_moved", to: s.family?.email, subject: "Session moved", lines: [`Hi ${s.family?.guardianName ?? ""},`, `${s.typeNameSnapshot} is now on ${fmt(s.startsAt, s.family?.timezone || p.timezone)}.`], link: `${origin2()}/account/sessions/${sessionId}`, linkLabel: "Open the session", replyTo: p.email, sessionId });
  }
  return r;
}
async function excuseSession2(prisma, session, sessionId) {
  const p = await requireTutor(guarded(prisma), session, "canManageSessions");
  return excuseSession(prisma, sessionId, p.id);
}
async function reopenSession2(prisma, session, sessionId) {
  const p = await requireTutor(guarded(prisma), session, "canManageSessions");
  return reopenSession(prisma, sessionId, p.id);
}
async function tutorSession(prisma, session, id) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  await settleTarget(prisma, "session", id).catch(() => null);
  const s = await db.session.findFirst({
    where: { id, profileId: p.id },
    include: {
      family: { select: { id: true, guardianName: true, email: true, phone: true, billingMode: true } },
      students: { select: { id: true, firstName: true, lastName: true, level: true, needs: true, goals: true, meetingUrl: true } },
      note: true,
      homework: { select: { id: true, title: true, status: true, dueAt: true, student: { select: { firstName: true } } } },
      creditEntries: { select: { id: true, kind: true, minutes: true, heldChange: true, note: true, createdAt: true, purchase: { select: { id: true, nameSnapshot: true } } }, orderBy: { createdAt: "asc" } },
      payments: { select: { id: true, kind: true, method: true, status: true, amountCents: true, refundedCents: true, reference: true, paidAt: true }, orderBy: { createdAt: "asc" } },
      paymentSessions: { select: { id: true, status: true, amountCents: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: "asc" } },
      invoiceLines: { select: { invoice: { select: { id: true, number: true, status: true } } } },
      sessionType: { select: { id: true, name: true, durationMinutes: true } }
    }
  });
  if (!s) throw new CommandError("Session not found.");
  const { publicAccessTokenHash: _h, ...rest } = s;
  const joinUrl = s.mode === "online" ? s.meetingUrl || s.students.find((x) => x.meetingUrl)?.meetingUrl || p.defaultMeetingUrl : "";
  const now = Date.now();
  return iso({
    ...rest,
    joinUrl,
    timezone: p.timezone,
    currencyCode: p.currencyCode,
    can: {
      complete: s.status === "scheduled" && s.startsAt.getTime() <= now,
      noShow: s.status === "scheduled" && s.startsAt.getTime() <= now,
      cancel: ["scheduled", "pending_payment"].includes(s.status),
      move: ["scheduled", "pending_payment"].includes(s.status),
      excuse: ["late_cancelled", "no_show"].includes(s.status) && now - s.startsAt.getTime() <= 30 * 864e5,
      reopen: s.status === "completed" && Boolean(s.completedAt) && now - s.completedAt.getTime() <= 7 * 864e5,
      recordPayment: s.funding === "card" && s.paymentStatus === "unpaid" && !["cancelled", "released", "excused"].includes(s.status)
    }
  });
}
async function sessionLink(prisma, session, id) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const { createPublicAccessToken: createPublicAccessToken2 } = await Promise.resolve().then(() => (init_publicAccessToken(), publicAccessToken_exports));
  const access = createPublicAccessToken2();
  const done = await db.session.updateMany({ where: { id, profileId: p.id }, data: { publicAccessTokenHash: access.hash } });
  if (!done.count) throw new CommandError("Session not found.");
  return { url: bookingLink(id, access.token) };
}
async function saveSeries(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  await ownFamily(db, p, input.familyId);
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: p.id, active: true } });
  if (!type) throw new CommandError("Choose a kind of session.");
  const students = await db.student.count({ where: { id: { in: input.studentIds }, familyId: input.familyId } });
  if (!input.studentIds.length || students !== new Set(input.studentIds).size) throw new CommandError("Choose the family\u2019s students.");
  if (!(Number.isInteger(input.dayOfWeek) && input.dayOfWeek >= 0 && input.dayOfWeek <= 6)) throw new CommandError("Choose a day.");
  if (!(Number.isInteger(input.startMinute) && input.startMinute >= 0 && input.startMinute + type.durationMinutes <= 1440)) throw new CommandError("Choose a start time.");
  if (!isDateKey(input.startsOn)) throw new CommandError("Choose a start date.");
  if (input.endsOn && (!isDateKey(input.endsOn) || input.endsOn < input.startsOn)) throw new CommandError("The end date must be after the start date.");
  const mode = type.mode === "either" ? input.mode === "in_person" ? "in_person" : "online" : type.mode === "in_person" ? "in_person" : "online";
  if (input.id) {
    const old = await db.recurringSeries.findFirst({ where: { id: input.id, profileId: p.id } });
    if (!old) throw new CommandError("Series not found.");
    await db.recurringSeries.updateMany({ where: { id: old.id }, data: { status: "ended", endsOn: businessDateKey(/* @__PURE__ */ new Date(), p.timezone) } });
    await cancelFutureSeriesSessions(prisma, old.id, p.id);
  }
  const r = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, p.id);
    const s = await tx.recurringSeries.create({ data: { profileId: p.id, familyId: input.familyId, sessionTypeId: type.id, students: { connect: input.studentIds.map((id) => ({ id })) }, dayOfWeek: input.dayOfWeek, startMinute: input.startMinute, startsOn: input.startsOn, endsOn: input.endsOn ?? "", mode, status: "active" } });
    const g = await topUpSeriesInLock(tx, s.id);
    return { seriesId: s.id, ...g };
  });
  return r;
}
async function pauseSeries(prisma, session, id, resume) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  if (resume) {
    const done2 = await db.recurringSeries.updateMany({ where: { id, profileId: p.id, status: "paused" }, data: { status: "active", generatedThrough: businessDateKey(/* @__PURE__ */ new Date(), p.timezone) } });
    if (!done2.count) throw new CommandError("Only a paused series can be resumed.");
    await transaction(prisma, async (tx) => {
      await lockTutorBooking(tx, p.id);
      await topUpSeriesInLock(tx, id);
    });
    return { id, status: "active" };
  }
  const done = await db.recurringSeries.updateMany({ where: { id, profileId: p.id, status: "active" }, data: { status: "paused" } });
  if (!done.count) throw new CommandError("Only an active series can be paused.");
  const cancelled = await cancelFutureSeriesSessions(prisma, id, p.id);
  return { id, status: "paused", cancelled };
}
async function endSeries(prisma, session, id) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const done = await db.recurringSeries.updateMany({ where: { id, profileId: p.id, status: { in: ["active", "paused"] } }, data: { status: "ended", endsOn: businessDateKey(/* @__PURE__ */ new Date(), p.timezone) } });
  if (!done.count) throw new CommandError("This series has already ended.");
  const cancelled = await cancelFutureSeriesSessions(prisma, id, p.id);
  return { id, status: "ended", cancelled };
}
async function clearSkippedWeek(prisma, session, id, date) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const s = await db.recurringSeries.findFirst({ where: { id, profileId: p.id }, select: { skippedDates: true } });
  if (!s) throw new CommandError("Series not found.");
  await db.recurringSeries.update({ where: { id }, data: { skippedDates: s.skippedDates.split("\n").filter((d) => d && d !== date).join("\n") } });
  return { id };
}
async function familiesOverview(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  const q2 = cleanText(input.search, 80);
  const families = await db.family.findMany({
    where: { profileId: p.id, ...input.status ? { status: input.status } : {}, ...q2 ? { OR: [{ guardianName: { contains: q2, mode: "insensitive" } }, { email: { contains: q2, mode: "insensitive" } }, { phone: { contains: q2 } }, { students: { some: { firstName: { contains: q2, mode: "insensitive" } } } }] } : {} },
    select: { id: true, guardianName: true, email: true, phone: true, status: true, billingMode: true, userId: true, students: { select: { id: true, firstName: true, level: true, status: true } } },
    orderBy: { guardianName: "asc" },
    take: 500
  });
  const ids = families.map((f) => f.id);
  const now = /* @__PURE__ */ new Date();
  const [purchases, invoices, unpaid, next] = await Promise.all([
    db.packagePurchase.groupBy({ by: ["familyId"], where: { familyId: { in: ids }, status: "active" }, _sum: { minutesRemaining: true } }),
    db.invoice.findMany({ where: { familyId: { in: ids }, status: "sent" }, select: { familyId: true, totalCents: true, paidCents: true, dueAt: true, status: true } }),
    db.session.groupBy({ by: ["familyId"], where: { familyId: { in: ids }, funding: "card", paymentStatus: "unpaid", status: { in: ["scheduled", "completed"] } }, _sum: { priceCents: true } }),
    db.session.findMany({ where: { familyId: { in: ids }, status: "scheduled", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { familyId: true, startsAt: true }, take: 2e3 })
  ]);
  return iso({
    currencyCode: p.currencyCode,
    timezone: p.timezone,
    families: families.map((f) => ({
      ...f,
      hasAccount: Boolean(f.userId),
      userId: void 0,
      minutesLeft: purchases.find((x) => x.familyId === f.id)?._sum.minutesRemaining ?? 0,
      owingCents: invoices.filter((i) => i.familyId === f.id).reduce((a, i) => a + i.totalCents - i.paidCents, 0) + (unpaid.find((x) => x.familyId === f.id)?._sum.priceCents ?? 0),
      overdue: invoices.some((i) => i.familyId === f.id && isOverdue(i)),
      nextSession: next.find((s) => s.familyId === f.id)?.startsAt ?? null
    }))
  });
}
async function tutorFamily(prisma, session, id) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  await ownFamily(db, p, id);
  await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, p.id);
    await expirePurchases(tx, p.id, id);
  }).catch(() => null);
  const f = await db.family.findUniqueOrThrow({
    where: { id },
    include: {
      students: { orderBy: { createdAt: "asc" } },
      sessions: { orderBy: { startsAt: "desc" }, take: 100, select: { id: true, startsAt: true, status: true, funding: true, paymentStatus: true, typeNameSnapshot: true, priceCents: true, chargedCents: true } },
      purchases: { orderBy: { createdAt: "desc" }, include: { entries: { orderBy: { createdAt: "desc" }, take: 100, select: { id: true, kind: true, minutes: true, heldChange: true, note: true, createdAt: true, session: { select: { id: true, startsAt: true } } } } } },
      invoices: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, totalCents: true, paidCents: true, dueAt: true, issuedAt: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 100, select: { id: true, kind: true, method: true, status: true, amountCents: true, refundedCents: true, reference: true, paidAt: true, reportedByGuardian: true } },
      series: { where: { status: { in: ["active", "paused"] } }, select: { id: true, status: true, dayOfWeek: true, startMinute: true, startsOn: true, endsOn: true, skippedDates: true, sessionType: { select: { id: true, name: true } }, students: { select: { id: true, firstName: true } } } },
      inquiries: { select: { id: true, message: true, createdAt: true } }
    }
  });
  const { inviteTokenHash, calendarTokenHash, ...rest } = f;
  const ledger = await Promise.all(f.purchases.map((x) => checkPurchase(db, x.id)));
  return iso({ ...rest, hasAccount: Boolean(f.userId), inviteOpen: Boolean(inviteTokenHash), currencyCode: p.currencyCode, timezone: p.timezone, purchases: f.purchases.map((x, i) => ({ ...x, ledgerOk: ledger[i].ok })), invoices: f.invoices.map((i) => ({ ...i, overdue: isOverdue(i) })) });
}
async function inviteFamily2(prisma, session, familyId, send) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  const r = await inviteFamily(db, p.id, familyId);
  const url = `${origin2()}/account/claim?f=${encodeURIComponent(r.familyId)}&t=${encodeURIComponent(r.token)}`;
  let mail = null;
  if (send !== false) mail = await notify(prisma, { profileId: p.id, kind: "invite", to: r.email, subject: `${p.businessName}: set up your family account`, lines: [`Hi ${r.guardianName},`, "Set a password to see your sessions, notes, homework, packages and invoices in one place."], link: url, linkLabel: "Create your account", replyTo: p.email });
  return { url, mail };
}
async function saveStudentAsTutor(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  await ownFamily(db, p, input.familyId);
  const firstName = cleanText(input.firstName, 80);
  if (!firstName) throw new CommandError("Enter the student\u2019s first name.");
  const subjectIds = input.subjectIds ?? null;
  if (subjectIds && await db.subject.count({ where: { id: { in: subjectIds }, profileId: p.id } }) !== new Set(subjectIds).size) throw new CommandError("Choose your own subjects.");
  const status = ["active", "paused", "finished"].includes(input.status || "") ? input.status : void 0;
  const data = { firstName, lastName: cleanText(input.lastName, 80), level: cleanText(input.level, 80), school: cleanText(input.school, 120), goals: cleanText(input.goals, 2e3), needs: cleanText(input.needs, 2e3), meetingUrl: cleanUrl(input.meetingUrl), birthYear: input.birthYear ?? null, ...status ? { status } : {} };
  if (input.id) {
    const s2 = await db.student.findFirst({ where: { id: input.id, profileId: p.id, familyId: input.familyId } });
    if (!s2) throw new CommandError("Student not found.");
    await db.student.update({ where: { id: s2.id }, data: { ...data, ...subjectIds ? { subjects: { set: subjectIds.map((id) => ({ id })) } } : {} } });
    return { id: s2.id };
  }
  const s = await db.student.create({ data: { ...data, profileId: p.id, familyId: input.familyId, ...subjectIds ? { subjects: { connect: subjectIds.map((id) => ({ id })) } } : {} } });
  return { id: s.id };
}
async function tutorStudent(prisma, session, id) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  const s = await db.student.findFirst({
    where: { id, profileId: p.id },
    include: {
      family: { select: { id: true, guardianName: true } },
      subjects: { select: { id: true, name: true } },
      marks: { orderBy: { takenOn: "asc" } },
      homework: { orderBy: { createdAt: "desc" }, take: 100 },
      sessions: { orderBy: { startsAt: "desc" }, take: 100, select: { id: true, startsAt: true, status: true, typeNameSnapshot: true, note: true } }
    }
  });
  if (!s) throw new CommandError("Student not found.");
  return iso({ ...s, timezone: p.timezone });
}
async function convertInquiry(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  const r = await transaction(prisma, async (tx) => {
    const q2 = await tx.inquiry.findFirst({ where: { id: input.id, profileId: p.id } });
    if (!q2) throw new CommandError("Inquiry not found.");
    if (q2.status === "converted" || q2.status === "closed") throw new CommandError("This inquiry is already closed.");
    const billingMode = ["pay_as_you_book", "invoice", "flat_monthly"].includes(input.billingMode || "") ? input.billingMode : "pay_as_you_book";
    let family = await tx.family.findFirst({ where: { profileId: p.id, OR: [...q2.email ? [{ email: { equals: q2.email, mode: "insensitive" } }] : [], ...q2.phone ? [{ phone: q2.phone }] : []] } });
    family ??= await tx.family.create({ data: { profileId: p.id, guardianName: q2.name, email: q2.email, phone: q2.phone, status: "active", billingMode, howTheyFoundMe: "Message from the page" } });
    const studentName = cleanText(input.studentName, 120);
    if (studentName) {
      const [first, ...rest] = studentName.split(/\s+/);
      await tx.student.create({ data: { profileId: p.id, familyId: family.id, firstName: first, lastName: rest.join(" "), level: q2.studentLevel, goals: q2.message.slice(0, 1e3) } });
    }
    const done = await tx.inquiry.updateMany({ where: { id: q2.id, status: { in: ["new", "contacted"] } }, data: { status: "converted", familyId: family.id } });
    if (!done.count) throw new CommandError("This inquiry was already handled.");
    return { familyId: family.id };
  });
  const inv = await inviteFamily(db, p.id, r.familyId).catch(() => null);
  return { familyId: r.familyId, inviteUrl: inv ? `${origin2()}/account/claim?f=${encodeURIComponent(inv.familyId)}&t=${encodeURIComponent(inv.token)}` : null };
}
async function setInquiryStatus(prisma, session, id, status) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  const next = { contacted: ["new"], closed: ["new", "contacted"], new: ["contacted"] };
  if (!next[status]) throw new CommandError("Choose contacted or closed.");
  const done = await db.inquiry.updateMany({ where: { id, profileId: p.id, status: { in: next[status] } }, data: { status } });
  if (!done.count) throw new CommandError("This inquiry cannot move to that step.");
  return { id, status };
}
async function reviewHomework(prisma, session, id, feedback) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const done = await db.homework.updateMany({ where: { id, profileId: p.id, status: { in: ["assigned", "handed_in"] } }, data: { status: "reviewed", feedback: cleanText(feedback, 3e3), reviewedAt: /* @__PURE__ */ new Date() } });
  if (!done.count) throw new CommandError("This homework is already reviewed.");
  return { id, status: "reviewed" };
}
async function homeworkBoard(prisma, session) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const rows = await db.homework.findMany({ where: { profileId: p.id, OR: [{ status: { in: ["assigned", "handed_in"] } }, { reviewedAt: { gt: new Date(Date.now() - 30 * 864e5) } }] }, select: { id: true, title: true, instructions: true, dueAt: true, linkUrl: true, file_filename: true, status: true, handedInAt: true, guardianComment: true, handInUrl: true, feedback: true, reviewedAt: true, student: { select: { id: true, firstName: true, family: { select: { guardianName: true } } } } }, orderBy: { dueAt: "asc" }, take: 500 });
  return iso({ timezone: p.timezone, assigned: rows.filter((r) => r.status === "assigned"), handedIn: rows.filter((r) => r.status === "handed_in"), reviewed: rows.filter((r) => r.status === "reviewed") });
}
async function moderateReview(prisma, session, id, status) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageFamilies");
  if (!["published", "hidden"].includes(status)) throw new CommandError("Choose publish or hide.");
  const done = await db.review.updateMany({ where: { id, profileId: p.id }, data: { status } });
  if (!done.count) throw new CommandError("Review not found.");
  return { id, status };
}
var pay = async (prisma, session) => requireTutor(guarded(prisma), session, "canManagePayments");
async function sellPackage2(prisma, session, input) {
  const p = await pay(prisma, session);
  return sellPackage(prisma, p.id, input);
}
async function cancelPurchase2(prisma, session, id) {
  const p = await pay(prisma, session);
  return cancelPurchase(prisma, p.id, id);
}
async function refundPackage2(prisma, session, id) {
  const p = await pay(prisma, session);
  return refundPackage(prisma, p.id, id);
}
async function adjustMinutes2(prisma, session, input) {
  const p = await pay(prisma, session);
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, p.id);
    const x = await tx.packagePurchase.findFirst({ where: { id: input.purchaseId, profileId: p.id } });
    if (!x) throw new CommandError("Package not found.");
    await adjustMinutes(tx, x, Math.trunc(Number(input.minutes)), cleanText(input.reason, 300));
    return { purchaseId: x.id };
  });
}
async function confirmPayment2(prisma, session, id) {
  const p = await pay(prisma, session);
  return confirmPayment(prisma, p.id, id);
}
async function rejectPayment2(prisma, session, id, note) {
  const p = await pay(prisma, session);
  return rejectPayment(prisma, p.id, id, note ?? "");
}
async function recordPayment2(prisma, session, input) {
  const p = await pay(prisma, session);
  if (!["session", "package", "invoice"].includes(input.target)) throw new CommandError("Choose what the payment is for.");
  return recordPayment(prisma, p.id, { target: { kind: input.target, id: input.targetId }, amountCents: input.amountCents, method: input.method, reference: input.reference });
}
async function refundPayment2(prisma, session, id, amountCents, note) {
  const p = await pay(prisma, session);
  const own = await guarded(prisma).payment.count({ where: { id, profileId: p.id } });
  if (!own) throw new CommandError("Payment not found.");
  return refundPaymentRow(prisma, id, amountCents ?? null, cleanText(note, 300) || "Refunded by your tutor");
}
async function readyToInvoice2(prisma, session) {
  const p = await pay(prisma, session);
  return iso({ currencyCode: p.currencyCode, families: await readyToInvoice(guarded(prisma), p.id) });
}
async function createInvoice2(prisma, session, input) {
  const p = await pay(prisma, session);
  const r = await createInvoice(prisma, p.id, input);
  return { id: r.id, number: r.number };
}
async function addInvoiceLine2(prisma, session, invoiceId, line) {
  const p = await pay(prisma, session);
  return addInvoiceLine(prisma, p.id, invoiceId, { ...line, quantity: line.quantity ?? 1 });
}
async function removeInvoiceLine2(prisma, session, lineId) {
  const p = await pay(prisma, session);
  return removeInvoiceLine(prisma, p.id, lineId);
}
async function sendInvoice2(prisma, session, id, send) {
  const p = await pay(prisma, session);
  const inv = await sendInvoice(prisma, p.id, id);
  const url = invoiceLink(inv.id, inv.token);
  let mail = null;
  if (send !== false) {
    const f = inv.familyId ? await guarded(prisma).family.findUnique({ where: { id: inv.familyId }, select: { email: true, guardianName: true } }) : null;
    mail = await notify(prisma, { profileId: p.id, kind: "invoice_sent", to: f?.email, subject: `Invoice ${inv.number} from ${p.businessName}`, lines: [`Hi ${f?.guardianName ?? ""},`, `Invoice ${inv.number} for ${(inv.totalCents / 100).toFixed(2)} ${p.currencyCode} is ready.`], link: url, linkLabel: "View and pay", replyTo: p.email, invoiceId: inv.id });
  }
  return { id: inv.id, number: inv.number, url, mail };
}
async function invoiceLinkFor(prisma, session, id) {
  const p = await pay(prisma, session);
  const { createPublicAccessToken: createPublicAccessToken2 } = await Promise.resolve().then(() => (init_publicAccessToken(), publicAccessToken_exports));
  const access = createPublicAccessToken2();
  const done = await guarded(prisma).invoice.updateMany({ where: { id, profileId: p.id, status: { in: ["sent", "paid"] } }, data: { publicAccessTokenHash: access.hash } });
  if (!done.count) throw new CommandError("Send the invoice first.");
  return { url: invoiceLink(id, access.token) };
}
async function voidInvoice2(prisma, session, id) {
  const p = await pay(prisma, session);
  return voidInvoice(prisma, p.id, id);
}
async function tutorInvoice(prisma, session, id) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canReadPayments").catch(() => requireTutor(db, session, "canManagePayments"));
  await settleTarget(prisma, "invoice", id).catch(() => null);
  const inv = await db.invoice.findFirst({ where: { id, profileId: p.id }, include: { family: { select: { id: true, guardianName: true, email: true } }, lines: { orderBy: { sortOrder: "asc" }, include: { session: { select: { id: true, startsAt: true, status: true } } } }, payments: { orderBy: { createdAt: "asc" } } } });
  if (!inv) throw new CommandError("Invoice not found.");
  const { publicAccessTokenHash: _h, ...rest } = inv;
  return iso({ ...rest, overdue: isOverdue(inv), currencyCode: p.currencyCode, timezone: p.timezone });
}
async function myEarnings(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canViewEarnings");
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new CommandError("Choose a valid date range.");
  const paid = { profileId: p.id, status: { in: ["confirmed", "refunded", "partially_refunded"] }, paidAt: { gte: from, lt: to } };
  const [ins, refunds, byMethod, payments, taught, sold, prepaid, owed, expenses, expByCat] = await Promise.all([
    db.payment.aggregate({ where: { ...paid, kind: { not: "refund" } }, _sum: { amountCents: true } }),
    db.payment.aggregate({ where: { profileId: p.id, kind: "refund", status: "confirmed", paidAt: { gte: from, lt: to } }, _sum: { amountCents: true } }),
    db.payment.groupBy({ by: ["method"], where: { ...paid, kind: { not: "refund" } }, _sum: { amountCents: true } }),
    db.payment.findMany({ where: { ...paid, kind: { not: "refund" } }, select: { amountCents: true, paidAt: true }, take: 1e4 }),
    db.session.findMany({ where: { profileId: p.id, status: "completed", startsAt: { gte: from, lt: to } }, select: { startsAt: true, endsAt: true }, take: 1e4 }),
    db.packagePurchase.aggregate({ where: { profileId: p.id, purchasedAt: { gte: from, lt: to }, status: { notIn: ["awaiting_payment", "cancelled"] } }, _count: { _all: true }, _sum: { pricePaidCents: true } }),
    db.packagePurchase.findMany({ where: { profileId: p.id, status: "active" }, select: { minutesRemaining: true, minutesGranted: true, pricePaidCents: true } }),
    db.invoice.findMany({ where: { profileId: p.id, status: "sent" }, select: { totalCents: true, paidCents: true } }),
    db.expense.aggregate({ where: { profileId: p.id, spentOn: { gte: from, lt: to } }, _sum: { amountCents: true } }),
    db.expense.groupBy({ by: ["category"], where: { profileId: p.id, spentOn: { gte: from, lt: to } }, _sum: { amountCents: true } })
  ]);
  const month = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: p.timezone, year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
  const byMonth = {};
  for (const x of payments) if (x.paidAt) byMonth[month(x.paidAt)] = (byMonth[month(x.paidAt)] ?? 0) + x.amountCents;
  const inCents = (ins._sum.amountCents ?? 0) - (refunds._sum.amountCents ?? 0);
  const exp = expenses._sum.amountCents ?? 0;
  return iso({
    from: from.toISOString(),
    to: to.toISOString(),
    currencyCode: p.currencyCode,
    inCents,
    refundsCents: refunds._sum.amountCents ?? 0,
    byMethod: byMethod.map((r) => ({ method: r.method, cents: r._sum.amountCents ?? 0 })),
    byMonth: Object.entries(byMonth).sort().map(([m, cents]) => ({ month: m, cents })),
    sessionsTaught: taught.length,
    hoursTaught: Math.round(taught.reduce((a, s) => a + (s.endsAt.getTime() - s.startsAt.getTime()) / 36e5, 0) * 10) / 10,
    packagesSold: sold._count._all,
    packagesSoldCents: sold._sum.pricePaidCents ?? 0,
    prepaidMinutes: prepaid.reduce((a, x) => a + x.minutesRemaining, 0),
    prepaidUnearnedCents: prepaid.reduce((a, x) => a + (x.minutesGranted ? Math.floor(x.pricePaidCents * x.minutesRemaining / x.minutesGranted) : 0), 0),
    outstandingCents: owed.reduce((a, i) => a + i.totalCents - i.paidCents, 0),
    expensesCents: exp,
    expensesByCategory: expByCat.map((r) => ({ category: r.category, cents: r._sum.amountCents ?? 0 })),
    netCents: inCents - exp
  });
}
async function paymentSettings(prisma, session) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManagePayments");
  let stripe2 = { connected: false };
  if (stripeOn()) {
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, redirect: "error" });
      const json3 = await res.json();
      stripe2 = res.ok ? { connected: true, mode: json3.livemode ? "live" : "test keys" } : { connected: false, error: json3.error?.message || `Stripe answered ${res.status}` };
      if (res.ok) await cardProvider(db, p.id);
    } catch (e) {
      stripe2 = { connected: false, error: e instanceof Error ? e.message : "Stripe could not be reached" };
    }
  }
  return { stripe: stripe2, webhookUrl: `${origin2()}/api/payment-webhooks/stripe`, webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET), paymentInstructions: p.paymentInstructions, invoiceDueDays: p.invoiceDueDays, currencyCode: p.currencyCode, mail: mailConfigured() };
}
async function tutorCalendarFeedUrl(prisma, session) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canManageSessions");
  const token = await calendarFeedToken(db, { kind: "tutor", id: p.id });
  return { url: `${origin2()}/api/calendar/${token}.ics`, webcalUrl: `${origin2().replace(/^https?/, "webcal")}/api/calendar/${token}.ics` };
}
async function exportCsv(prisma, session, input) {
  const db = guarded(prisma);
  const p = await requireTutor(db, session, "canViewEarnings");
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new CommandError("Choose a valid date range.");
  const q2 = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  if (input.kind === "sessions") {
    const rows2 = await db.session.findMany({ where: { profileId: p.id, startsAt: { gte: from, lt: to } }, select: { startsAt: true, typeNameSnapshot: true, status: true, funding: true, priceCents: true, chargedCents: true, chargedMinutes: true, paymentStatus: true, family: { select: { guardianName: true } } }, orderBy: { startsAt: "asc" }, take: 2e4 });
    return { filename: "sessions.csv", csv: ["date,family,session,status,funding,price,charged,charged_minutes,payment", ...rows2.map((r) => [r.startsAt.toISOString(), r.family?.guardianName, r.typeNameSnapshot, r.status, r.funding, (r.priceCents / 100).toFixed(2), (r.chargedCents / 100).toFixed(2), r.chargedMinutes, r.paymentStatus].map(q2).join(","))].join("\n") };
  }
  const rows = await db.payment.findMany({ where: { profileId: p.id, paidAt: { gte: from, lt: to } }, select: { paidAt: true, kind: true, method: true, status: true, amountCents: true, refundedCents: true, reference: true, family: { select: { guardianName: true } } }, orderBy: { paidAt: "asc" }, take: 2e4 });
  return { filename: "payments.csv", csv: ["date,family,kind,method,status,amount,refunded,reference", ...rows.map((r) => [r.paidAt?.toISOString(), r.family?.guardianName, r.kind, r.method, r.status, (r.amountCents / 100).toFixed(2), (r.refundedCents / 100).toFixed(2), r.reference].map(q2).join(","))].join("\n") };
}

// features/keystone/mutations/tutor.ts
var run = async (work) => {
  try {
    return ok(await work());
  } catch (error) {
    if (!(error instanceof CommandError)) console.error("[tutor] command failed", error instanceof Error ? error.stack || error.message : "unknown");
    return fail(error);
  }
};
var tutorTypeDefs = {
  query: `
    myBusiness: CommandResult!
    today: CommandResult!
    calendar(from: String!, to: String!): CommandResult!
    tutorSession(id: ID!): CommandResult!
    familiesOverview(status: String, search: String): CommandResult!
    tutorFamily(id: ID!): CommandResult!
    tutorStudent(id: ID!): CommandResult!
    homeworkBoard: CommandResult!
    readyToInvoice: CommandResult!
    tutorInvoice(id: ID!): CommandResult!
    myEarnings(from: String!, to: String!): CommandResult!
    paymentSettings: CommandResult!
    tutorCalendarFeedUrl: CommandResult!
    exportCsv(kind: String!, from: String!, to: String!): CommandResult!
  `,
  mutation: `
    setUpMyBusiness(businessName: String!, tutorName: String, slug: String!, timezone: String!, currencyCode: String, country: String, subjects: [String!], levels: String, teachesOnline: Boolean, teachesInPerson: Boolean, hourlyRateCents: Int, typicalSetup: Boolean, email: String): CommandResult!
    createSessionAsTutor(familyId: ID!, sessionTypeId: ID!, startsAt: String!, studentIds: [ID!]!, mode: String, meetingUrl: String, notify: Boolean): CommandResult!
    completeSession(sessionId: ID!, note: SessionNoteInput, homework: [HomeworkInput!], share: Boolean): CommandResult!
    saveSessionNote(sessionId: ID!, covered: String, wentWell: String, workOnNext: String, effort: Int, privateNote: String, share: Boolean): CommandResult!
    markNoShow(sessionId: ID!): CommandResult!
    cancelSessionAsTutor(sessionId: ID!, reason: String, notify: Boolean): CommandResult!
    rescheduleSessionAsTutor(sessionId: ID!, startsAt: String!, notify: Boolean): CommandResult!
    excuseSession(sessionId: ID!): CommandResult!
    reopenSession(sessionId: ID!): CommandResult!
    sessionLink(sessionId: ID!): CommandResult!
    saveSeries(id: ID, familyId: ID!, sessionTypeId: ID!, studentIds: [ID!]!, dayOfWeek: Int!, startMinute: Int!, startsOn: String!, endsOn: String, mode: String): CommandResult!
    pauseSeries(id: ID!, resume: Boolean): CommandResult!
    endSeries(id: ID!): CommandResult!
    clearSkippedWeek(id: ID!, date: String!): CommandResult!
    inviteFamily(familyId: ID!, send: Boolean): CommandResult!
    saveStudentAsTutor(student: TutorStudentInput!): CommandResult!
    convertInquiry(id: ID!, studentName: String, billingMode: String): CommandResult!
    setInquiryStatus(id: ID!, status: String!): CommandResult!
    reviewHomework(id: ID!, feedback: String): CommandResult!
    moderateReview(id: ID!, status: String!): CommandResult!
    sellPackage(familyId: ID!, packageId: ID!, method: String!, reference: String): CommandResult!
    cancelPackagePurchase(purchaseId: ID!): CommandResult!
    refundPackage(purchaseId: ID!): CommandResult!
    adjustMinutes(purchaseId: ID!, minutes: Int!, reason: String!): CommandResult!
    confirmPayment(paymentId: ID!): CommandResult!
    rejectPayment(paymentId: ID!, note: String): CommandResult!
    recordPayment(target: String!, targetId: ID!, amountCents: Int, method: String!, reference: String): CommandResult!
    refundPayment(paymentId: ID!, amountCents: Int, note: String): CommandResult!
    draftInvoice(familyId: ID!, sessionIds: [ID!], includeFlatFee: Boolean, extraLines: [InvoiceLineInput!], dueDays: Int, note: String): CommandResult!
    addInvoiceLine(invoiceId: ID!, line: InvoiceLineInput!): CommandResult!
    removeInvoiceLine(lineId: ID!): CommandResult!
    sendInvoice(invoiceId: ID!, send: Boolean): CommandResult!
    invoiceLink(invoiceId: ID!): CommandResult!
    voidInvoice(invoiceId: ID!): CommandResult!
  `,
  inputs: `
    input SessionNoteInput { covered: String, wentWell: String, workOnNext: String, effort: Int, privateNote: String }
    input HomeworkInput { title: String!, instructions: String, dueAt: String, linkUrl: String, studentId: ID }
    input InvoiceLineInput { description: String!, quantity: Int, unitCents: Int! }
    input TutorStudentInput { id: ID, familyId: ID!, firstName: String!, lastName: String, level: String, school: String, goals: String, needs: String, meetingUrl: String, birthYear: Int, status: String, subjectIds: [ID!] }
  `
};
var q = (fn) => (_r, a, c) => run(() => fn(c, a));
var tutorResolvers = {
  Query: {
    myBusiness: q((c) => myBusiness(c.prisma, c.session)),
    today: q((c) => today(c.prisma, c.session)),
    calendar: q((c, a) => calendar(c.prisma, c.session, a)),
    tutorSession: q((c, a) => tutorSession(c.prisma, c.session, a.id)),
    familiesOverview: q((c, a) => familiesOverview(c.prisma, c.session, a)),
    tutorFamily: q((c, a) => tutorFamily(c.prisma, c.session, a.id)),
    tutorStudent: q((c, a) => tutorStudent(c.prisma, c.session, a.id)),
    homeworkBoard: q((c) => homeworkBoard(c.prisma, c.session)),
    readyToInvoice: q((c) => readyToInvoice2(c.prisma, c.session)),
    tutorInvoice: q((c, a) => tutorInvoice(c.prisma, c.session, a.id)),
    myEarnings: q((c, a) => myEarnings(c.prisma, c.session, a)),
    paymentSettings: q((c) => paymentSettings(c.prisma, c.session)),
    tutorCalendarFeedUrl: q((c) => tutorCalendarFeedUrl(c.prisma, c.session)),
    exportCsv: q((c, a) => exportCsv(c.prisma, c.session, a))
  },
  Mutation: {
    setUpMyBusiness: q((c, a) => setUpMyBusiness2(c.prisma, c.session, a)),
    createSessionAsTutor: q((c, a) => createSessionAsTutor(c.prisma, c.session, a)),
    completeSession: q((c, a) => completeSession(c.prisma, c.session, a)),
    saveSessionNote: q((c, a) => saveSessionNote(c.prisma, c.session, a)),
    markNoShow: q((c, a) => markNoShow2(c.prisma, c.session, a.sessionId)),
    cancelSessionAsTutor: q((c, a) => cancelSessionAsTutor(c.prisma, c.session, a.sessionId, a.reason, a.notify)),
    rescheduleSessionAsTutor: q((c, a) => rescheduleSessionAsTutor(c.prisma, c.session, a.sessionId, a.startsAt, a.notify)),
    excuseSession: q((c, a) => excuseSession2(c.prisma, c.session, a.sessionId)),
    reopenSession: q((c, a) => reopenSession2(c.prisma, c.session, a.sessionId)),
    sessionLink: q((c, a) => sessionLink(c.prisma, c.session, a.sessionId)),
    saveSeries: q((c, a) => saveSeries(c.prisma, c.session, a)),
    pauseSeries: q((c, a) => pauseSeries(c.prisma, c.session, a.id, a.resume)),
    endSeries: q((c, a) => endSeries(c.prisma, c.session, a.id)),
    clearSkippedWeek: q((c, a) => clearSkippedWeek(c.prisma, c.session, a.id, a.date)),
    inviteFamily: q((c, a) => inviteFamily2(c.prisma, c.session, a.familyId, a.send)),
    saveStudentAsTutor: q((c, a) => saveStudentAsTutor(c.prisma, c.session, a.student)),
    convertInquiry: q((c, a) => convertInquiry(c.prisma, c.session, a)),
    setInquiryStatus: q((c, a) => setInquiryStatus(c.prisma, c.session, a.id, a.status)),
    reviewHomework: q((c, a) => reviewHomework(c.prisma, c.session, a.id, a.feedback)),
    moderateReview: q((c, a) => moderateReview(c.prisma, c.session, a.id, a.status)),
    sellPackage: q((c, a) => sellPackage2(c.prisma, c.session, a)),
    cancelPackagePurchase: q((c, a) => cancelPurchase2(c.prisma, c.session, a.purchaseId)),
    refundPackage: q((c, a) => refundPackage2(c.prisma, c.session, a.purchaseId)),
    adjustMinutes: q((c, a) => adjustMinutes2(c.prisma, c.session, a)),
    confirmPayment: q((c, a) => confirmPayment2(c.prisma, c.session, a.paymentId)),
    rejectPayment: q((c, a) => rejectPayment2(c.prisma, c.session, a.paymentId, a.note)),
    recordPayment: q((c, a) => recordPayment2(c.prisma, c.session, a)),
    refundPayment: q((c, a) => refundPayment2(c.prisma, c.session, a.paymentId, a.amountCents, a.note)),
    draftInvoice: q((c, a) => createInvoice2(c.prisma, c.session, a)),
    addInvoiceLine: q((c, a) => addInvoiceLine2(c.prisma, c.session, a.invoiceId, a.line)),
    removeInvoiceLine: q((c, a) => removeInvoiceLine2(c.prisma, c.session, a.lineId)),
    sendInvoice: q((c, a) => sendInvoice2(c.prisma, c.session, a.invoiceId, a.send)),
    invoiceLink: q((c, a) => invoiceLinkFor(c.prisma, c.session, a.invoiceId)),
    voidInvoice: q((c, a) => voidInvoice2(c.prisma, c.session, a.invoiceId))
  }
};

// features/keystone/mutations/index.ts
var graphql = String.raw;
var run2 = async (work) => {
  try {
    return ok(await work());
  } catch (error) {
    if (!(error instanceof CommandError)) console.error("[tutor] command failed", error instanceof Error ? error.stack || error.message : "unknown");
    return fail(error);
  }
};
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql`
      type CommandResult { success: Boolean!, error: String, data: JSON }
      input VisitorInput { guardianName: String!, email: String, phone: String, studentName: String!, studentLevel: String, message: String, timezone: String }
      input StudentInput { id: ID, firstName: String!, lastName: String, level: String, school: String, goals: String, birthYear: Int }
      ${tutorTypeDefs.inputs}
      input ContactInput { guardianName: String, phone: String, secondContactName: String, secondContactPhone: String, address: String, timezone: String }

      type Query {
        redirectToInit: Boolean
        publicTutor(slug: String!): JSON
        homeTutor: JSON
        publicSlots(slug: String!, sessionTypeId: ID!, date: String!, timezone: String, excludeSessionId: ID, token: String): CommandResult!
        publicOpenDays(slug: String!, sessionTypeId: ID!, from: String!, days: Int, timezone: String): CommandResult!
        publicBooking(id: ID!, token: String!): CommandResult!
        publicInvoice(id: ID!, token: String!): CommandResult!
        myFamily: CommandResult!
        mySessions(range: String): CommandResult!
        mySession(id: ID!): CommandResult!
        myStudents: CommandResult!
        myHomework(status: String): CommandResult!
        myPackages: CommandResult!
        myInvoices: CommandResult!
        myInvoice(id: ID!): CommandResult!
        myResources: CommandResult!
        myProgress(studentId: ID!): CommandResult!
        myCalendarFeedUrl: CommandResult!
        ${tutorTypeDefs.query}
      }
      type Mutation {
        bookFirstSession(slug: String!, sessionTypeId: ID!, startsAt: String!, visitor: VisitorInput!, mode: String): CommandResult!
        payForBooking(id: ID!, token: String!): CommandResult!
        confirmBookingPayment(id: ID!, token: String!): CommandResult!
        cancelMyBooking(id: ID!, token: String!, reason: String): CommandResult!
        rescheduleMyBooking(id: ID!, token: String!, startsAt: String!): CommandResult!
        sendInquiry(slug: String!, name: String!, email: String, phone: String, studentLevel: String, subject: String, message: String): CommandResult!
        claimFamilyAccount(familyId: ID, token: String, bookingId: ID, bookingToken: String, email: String, name: String, password: String!): CommandResult!
        payInvoiceByLink(id: ID!, token: String!): CommandResult!
        bookSession(sessionTypeId: ID!, startsAt: String!, studentIds: [ID!]!, message: String, mode: String): CommandResult!
        cancelSession(id: ID!, reason: String): CommandResult!
        rescheduleSession(id: ID!, startsAt: String!): CommandResult!
        payForSession(id: ID!): CommandResult!
        confirmSessionPayment(id: ID!): CommandResult!
        saveStudent(student: StudentInput!): CommandResult!
        handInHomework(id: ID!, comment: String, url: String): CommandResult!
        buyPackage(packageId: ID!, method: String!): CommandResult!
        confirmPackagePayment(purchaseId: ID!): CommandResult!
        payInvoice(id: ID!): CommandResult!
        confirmInvoicePayment(id: ID!, token: String): CommandResult!
        reportPayment(target: String!, targetId: ID!, amountCents: Int!, method: String!, reference: String!): CommandResult!
        submitReview(rating: Int!, body: String, displayName: String): CommandResult!
        updateMyContact(contact: ContactInput!): CommandResult!
        ${tutorTypeDefs.mutation}
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        publicTutor: (_r, a, c) => publicTutor(c.prisma, a.slug),
        homeTutor: (_r, _a, c) => homeTutor(c.prisma),
        publicSlots: (_r, a, c) => run2(() => publicSlots(c.prisma, a, c.session)),
        publicOpenDays: (_r, a, c) => run2(() => publicOpenDays(c.prisma, a)),
        publicBooking: (_r, a, c) => run2(() => publicBooking(c.prisma, a.id, a.token)),
        publicInvoice: (_r, a, c) => run2(() => publicInvoice(c.prisma, a.id, a.token)),
        myFamily: (_r, _a, c) => run2(() => myFamily(c.prisma, c.session)),
        mySessions: (_r, a, c) => run2(() => mySessions(c.prisma, c.session, a.range)),
        mySession: (_r, a, c) => run2(() => mySession(c.prisma, c.session, a.id)),
        myStudents: (_r, _a, c) => run2(() => myStudents(c.prisma, c.session)),
        myHomework: (_r, a, c) => run2(() => myHomework(c.prisma, c.session, a.status)),
        myPackages: (_r, _a, c) => run2(() => myPackages(c.prisma, c.session)),
        myInvoices: (_r, _a, c) => run2(() => myInvoices(c.prisma, c.session)),
        myInvoice: (_r, a, c) => run2(() => myInvoice(c.prisma, c.session, a.id)),
        myResources: (_r, _a, c) => run2(() => myResources(c.prisma, c.session)),
        myProgress: (_r, a, c) => run2(() => myProgress(c.prisma, c.session, a.studentId)),
        myCalendarFeedUrl: (_r, _a, c) => run2(() => myCalendarFeedUrl(c.prisma, c.session)),
        ...tutorResolvers.Query
      },
      Mutation: {
        bookFirstSession: (_r, a, c) => run2(() => bookFirstSession(c.prisma, { slug: a.slug, sessionTypeId: a.sessionTypeId, startsAt: a.startsAt, mode: a.mode, ...a.visitor })),
        payForBooking: (_r, a, c) => run2(() => payForBooking(c.prisma, a.id, a.token)),
        confirmBookingPayment: (_r, a, c) => run2(() => confirmBookingPayment(c.prisma, a.id, a.token)),
        cancelMyBooking: (_r, a, c) => run2(() => cancelMyBooking(c.prisma, a.id, a.token, a.reason)),
        rescheduleMyBooking: (_r, a, c) => run2(() => rescheduleMyBooking(c.prisma, a.id, a.token, a.startsAt)),
        sendInquiry: (_r, a, c) => run2(() => sendInquiry(c.prisma, a)),
        // The token is the authority; Keystone's sudo db API creates the user so the password field hashes it.
        claimFamilyAccount: (_r, a, c) => run2(() => claimFamilyAccount(c.prisma, c, a)),
        payInvoiceByLink: (_r, a, c) => run2(() => payInvoiceByToken(c.prisma, a.id, a.token)),
        bookSession: (_r, a, c) => run2(() => bookSession(c.prisma, c.session, a)),
        cancelSession: (_r, a, c) => run2(() => cancelMySession(c.prisma, c.session, a.id, a.reason)),
        rescheduleSession: (_r, a, c) => run2(() => rescheduleMySession(c.prisma, c.session, a.id, a.startsAt)),
        payForSession: (_r, a, c) => run2(() => payForSession(c.prisma, c.session, a.id)),
        confirmSessionPayment: (_r, a, c) => run2(() => confirmSessionPayment(c.prisma, c.session, a.id)),
        saveStudent: (_r, a, c) => run2(async () => saveStudent(guarded(c.prisma), await requireFamily(guarded(c.prisma), c.session), a.student)),
        handInHomework: (_r, a, c) => run2(async () => handInHomework(guarded(c.prisma), (await requireFamily(guarded(c.prisma), c.session)).id, a)),
        buyPackage: (_r, a, c) => run2(() => buyPackage(c.prisma, c.session, a.packageId, a.method)),
        confirmPackagePayment: (_r, a, c) => run2(() => confirmPackagePayment(c.prisma, c.session, a.purchaseId)),
        payInvoice: (_r, a, c) => run2(() => payInvoice(c.prisma, c.session, a.id)),
        confirmInvoicePayment: (_r, a, c) => run2(() => confirmInvoicePayment(c.prisma, c.session, a.id, a.token)),
        reportPayment: (_r, a, c) => run2(() => reportPayment2(c.prisma, c.session, a)),
        submitReview: (_r, a, c) => run2(async () => submitReview(c.prisma, await requireFamily(guarded(c.prisma), c.session), a)),
        updateMyContact: (_r, a, c) => run2(async () => updateMyContact(guarded(c.prisma), (await requireFamily(guarded(c.prisma), c.session)).id, a.contact)),
        ...tutorResolvers.Mutation
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer2 = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport2 = (0, import_nodemailer2.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport2.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer2.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/mcp-oauth/session.ts
async function resolveMcpAccessToken(context, token, listKey = "User") {
  try {
    const sudo = context.sudo();
    const record = await sudo.db.OAuthToken.findOne({ where: { token: digestToken(token) } });
    if (!record || record.tokenType !== "access_token" || record.isRevoked !== "false" || !record.userId || !record.expiresAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return void 0;
    }
    const app = await sudo.db.OAuthApp.findOne({ where: { clientId: record.clientId } });
    if (!app || app.status !== "active") return void 0;
    const mcp = {
      clientId: record.clientId,
      scopes: storedScopes(record.scopes),
      tokenId: String(record.id)
    };
    return { itemId: String(record.userId), listKey, mcp };
  } catch {
    return void 0;
  }
}
function withMcpBearerSessions(strategy, listKey = "User") {
  return {
    ...strategy,
    async get({ context }) {
      const token = bearerToken(context?.req?.headers?.authorization);
      if (isMcpAccessToken(token)) return resolveMcpAccessToken(context, token, listKey);
      return strategy.get({ context });
    }
  };
}

// features/keystone/index.ts
init_access();

// features/keystone/lib/storage.ts
var import_node_path = __toESM(require("node:path"));
function fileStorage(env = process.env) {
  if (env.S3_BUCKET_NAME) {
    return {
      kind: "s3",
      type: "file",
      bucketName: env.S3_BUCKET_NAME,
      region: env.S3_REGION || "us-east-1",
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      endpoint: env.S3_ENDPOINT || void 0,
      forcePathStyle: true,
      signed: { expiry: 3600 }
    };
  }
  return {
    kind: "local",
    type: "file",
    storagePath: uploadDir(env),
    // Not a public path: the guarded route above serves the bytes.
    generateUrl: (file2) => `/api/files/stored${file2}`,
    serverRoute: null
  };
}
function uploadDir(env = process.env) {
  return import_node_path.default.resolve(env.UPLOAD_DIR || ".uploads/files");
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  secret: process.env.SESSION_SECRET || "this secret should only be used in testing"
};
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    // The first account on a deployment is the tutor who owns the business.
    itemData: { role: { create: { ...TUTOR_ROLE } } }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    onboardingStatus
    role {${ROLE_SESSION_FIELDS}
    }
  `
});
var keystone_default = withAuth(
  (0, import_core12.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    lists: models,
    storage: { tutor_files: fileStorage() },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
    },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions((0, import_session.statelessSessions)(sessionConfig)),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
