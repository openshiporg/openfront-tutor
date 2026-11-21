# THIS IS NOT A MOCK. THIS IS NOT A SANDBOX. THIS IS NOT A DEMO.

**WE ARE SELLING THIS SOFTWARE TO REAL BUSINESSES: A REAL SPORTSBOOK, A REAL BANK, A REAL HOSPITAL. THE OWNER WALKS IN, OPENS THE LIVE SITE AND PITCHES IT. EVERY CORE ACTION MUST ACTUALLY WORK ON THE LIVE DEPLOYMENT.**

Owner, 2026-11-13, verbatim: "i don't want this sandbox thing anywhere in the fucking code ... i don't want it to be a sandbox i don't want it to be mock i need it to fucking actually work ... i don't wanna go to a hospital they want to use my software it needs to work ... put in there in all caps this is not a mock this is not a sandbox we're selling this actual hospital".

- **THE MAIN THING THE PRODUCT EXISTS FOR MUST WORK ON LIVE**, signed in as a normal customer and as staff: place a wager and settle it (sportsbook), open an account and move money (bank), admit and chart a patient (hospital), book and pay (every service vertical), order and pay (every store). A 500, a 503 or "not available in this mode" on the main action is an OUTAGE: fix it before anything else.
- **NEVER build or keep a "sandbox", "mock", "demo", "simulation", "preview" or "test" MODE in the product:** no `*_SANDBOX` env flag, no `/api/sandbox/*` routes, no "sandbox"/"mock"/"simulated" wording in UI, routes, tables or copy, no code path that only works when a sandbox flag is on. If you find one, remove it and make the real path work.
- **NEVER gate a core action behind an env var that is unset on the live deployment.** If the product needs a setting to run, it has a working default or onboarding sets it.
- **NEVER fake a result** (mock provider, stubbed response, hard-coded success). Integrations are real adapters. The only "test" thing allowed is the payment provider's own test KEYS on our demo deployments (Stripe test card 4242, Authorize.net test account): same real code path, different keys.
- **A phase or fix is DONE only when you did the main action on the LIVE site** and say so in the report with the URL and the record id. "Passes locally" or "works with the flag on" is NOT done.
- Reviewers and auditors: any sandbox/mock/demo mode, or a main action that fails on live, is a BLOCKER, never a minor.
