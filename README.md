![openfront-tutor](.github/logo.svg)

Openfront Tutor is a self-hostable booking, lessons and billing application for the independent tutor: one person teaching one-to-one, online or in person, paid by the session, by a package of hours or by a monthly invoice. Families book from your own page and pay by card or by bank transfer. You keep students, lessons, notes, homework, packages, invoices and earnings in one dashboard. No marketplace takes a cut.

## What you get

- **Your booking page** at `/book/your-address`: your session types, open times from your weekly hours and time off, shown in the family's own timezone, with no double booking. New families can be limited to a free consultation or a first lesson.
- **A family account** at `/account`: one guardian, several students. Book, see upcoming and past sessions, read the notes you share, hand in homework, see package balances, pay invoices, and cancel or move a session within your policy.
- **Three ways to charge**: per session, prepaid packages of hours (5, 10 or 20 hours at a discount, valid 12 months), or a monthly invoice drafted from the month's lessons. Every hour used or refunded is a ledger row, so a balance is never a guess.
- **Card payments** through Stripe Checkout. Payment is confirmed by reading it back from Stripe, and a signed webhook settles it even if the family closes the tab. Refunds go back to the card.
- **Direct payments** for bank transfer, Wise, UPI, M-Pesa or cash: you write your payment instructions, the family reports a payment, and you confirm it.
- **Policies that run themselves**: a cancellation window (24 hours by default), late cancels and no-shows charged in full, and you can excuse any one of them.
- **Today, Calendar, Families, Students, Billing, Earnings and Settings** in the dashboard: complete a session with a note and homework, mark a no-show, sell a package, confirm a payment, draft and send an invoice, record an expense, and export payments, sessions and earnings as CSV for your accountant.
- **Calendar feeds**: an `.ics` file per session and a private iCal feed for you and for each family.

## Setup

```bash
npm install
cp .env.example .env   # DATABASE_URL and SESSION_SECRET at least
npm run dev
```

Open `/dashboard`, create your account, and the first-run page asks for your name, business name, page address, country, currency, timezone and subjects. Leave **Start with a typical setup** ticked to begin with five session types, three packages, weekly hours and a written policy you can edit. Set `STRIPE_SECRET_KEY` to take cards; without it the card buttons are hidden and families pay you directly.

Email (confirmations, reminders, invoices, shared notes) uses SMTP. Without `SMTP_HOST`, every message is logged as skipped and each link it would have carried has a copy button so you can send it by WhatsApp or text.

Reminders 24 hours before a lesson need a cron that calls the jobs endpoint:

```bash
curl -X POST -H "Authorization: Bearer $JOBS_SECRET" https://your-site/api/jobs/run
```

The Stripe webhook address is `https://your-site/api/payment-webhooks/stripe`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Build the schema, apply migrations, start Next.js |
| `npm run migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run migrate:gen` | Generate a migration after a schema change |
| `npm test` | Run the test suite against `TEST_DATABASE_URL` (its database name must end in `_test`) |
| `npm run verify` | Type check, lint, then test |
| `npm run seed:practice` | Fill one fictional tutor's practice for a public showcase deployment. Run by hand; it does nothing if the practice already exists |

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-tutor&env=DATABASE_URL%2CSESSION_SECRET)

## The Openfront Ecosystem

Every Openfront is open source and self-hostable.

| Product | For | Repository | Demo | Docs |
|---|---|---|---|---|
| Openfront E-commerce | Online store: catalog, checkout, orders, fulfillment | [openfront](https://github.com/openshiporg/openfront) | [e-commerce.openship.org](https://e-commerce.openship.org) | [Docs](https://docs.openship.org/docs/openfront/ecommerce) |
| Openfront Restaurant | Online ordering, POS and kitchen display | [openfront-restaurant](https://github.com/openshiporg/openfront-restaurant) | [restaurant.openship.org](https://restaurant.openship.org) | [Docs](https://docs.openship.org/docs/openfront/restaurant) |
| Openfront Grocery | Grocery ordering, lots, expiry and pickup | [openfront-grocery](https://github.com/openshiporg/openfront-grocery) | [grocery.openship.org](https://grocery.openship.org) | [Docs](https://docs.openship.org/docs/openfront/grocery) |
| Openfront Gym | Memberships, classes, check-in and billing | [openfront-gym](https://github.com/openshiporg/openfront-gym) | [gym.openship.org](https://gym.openship.org) | [Docs](https://docs.openship.org/docs/openfront/gym) |
| Openfront Hotel | Reservations, front desk, housekeeping, folios | [openfront-hotel](https://github.com/openshiporg/openfront-hotel) | [hotel.openship.org](https://hotel.openship.org) | [Docs](https://docs.openship.org/docs/openfront/hotel) |
| Openfront Rental | Short-term rental bookings and calendars | [openfront-rental](https://github.com/openshiporg/openfront-rental) | [rental.openship.org](https://rental.openship.org) | [Docs](https://docs.openship.org/docs/openfront/rental) |
| Openfront Salon | Appointments, stylists and services | [openfront-salon](https://github.com/openshiporg/openfront-salon) | [salon.openship.org](https://salon.openship.org) | [Docs](https://docs.openship.org/docs/openfront/salon) |
| Openfront Barbershop | Bookings, walk-ins and barbers | [openfront-barbershop](https://github.com/openshiporg/openfront-barbershop) | [barbershop.openship.org](https://barbershop.openship.org) | [Docs](https://docs.openship.org/docs/openfront/barbershop) |
| Openfront Barber | Booking, deposits and earnings for the independent barber | [openfront-barber](https://github.com/openshiporg/openfront-barber) | | |
| Openfront Financial | Accounts, portfolios and advisory | [openfront-financial](https://github.com/openshiporg/openfront-financial) | [financial.openship.org](https://financial.openship.org) | [Docs](https://docs.openship.org/docs/openfront/financial) |
| Openfront Analytics | Privacy-friendly website analytics | [analytics](https://github.com/openshiporg/analytics) | [analytics.openship.org](https://analytics.openship.org) | [Docs](https://docs.openship.org/docs/openfront/analytics) |
| Openship | Order routing from sales channels to fulfillment | [openship](https://github.com/openshiporg/openship) | [os.openship.org](https://os.openship.org) | [Docs](https://docs.openship.org/docs/openship/ecommerce) |
| Marketplace | Shop across Openfront stores | [marketplace](https://github.com/openshiporg/marketplace) | [marketplace.openship.org](https://marketplace.openship.org) | [Docs](https://docs.openship.org/docs/openfront/marketplace) |
