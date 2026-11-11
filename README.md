# MotoSetup AI

MotoSetup AI is a motocross setup and maintenance prototype. It supports 2-stroke and 4-stroke bikes, rider profiles, setup and maintenance history, gearing, and a demo mechanic.

## Stage 2 architecture

- **Supabase Auth** handles email/password registration, email confirmation, PKCE sessions, sign-in, and password reset.
- **PostgreSQL** stores accounts, riders, bikes, suspension settings, maintenance records and schedules, and gearing setups.
- **Row-level security (RLS)** restricts every account row to its authenticated owner. Related records are tied to bikes owned by the same account.
- The database creates new accounts on the Free plan. Browsers cannot update the plan. A database trigger locks the account row while enforcing one Free rider profile; Premium accounts are prepared for unlimited profiles without enabling payments.
- Rider and bike records sync through the signed-in Supabase client and Realtime. Existing browser records are namespaced by account after sign-in. Import is an explicit copy that leaves the source browser data intact and skips existing cloud IDs.
- Suspension, maintenance, and gearing tables have account isolation policies, but their application sync is a later step. They continue working locally in this version.

A Supabase project URL and `sb_publishable` key are configured in `supabase-config.js`. These are public browser values; never add a service-role/secret key or database credentials there. This publish updates the static site only; it does not apply migrations or change Supabase settings or data.

## Local database tests

Run the JavaScript tests with `node --test tests/*.test.js`. The migration and pgTAP isolation tests are in `supabase/`; with Docker and the Supabase CLI installed, run `supabase start`, `supabase db reset`, then `supabase test db`. The database tests check account isolation, owner spoofing, Free limits, signup metadata, client-side plan changes, and the Premium profile path. They use synthetic test identities and roll back their transaction.

The browser auth client loads the pinned Supabase JS library only when account features are used. Open the app from an HTTP address (for example `http://localhost:5500`) for email confirmation and password-reset redirects; direct `file://` use remains available for local-only prototype features.

## Current gaps

- The account schema migration still needs to be applied to the configured Supabase project, and Auth redirects need verification.
- Authentication emails need project redirect settings; the built-in sender is for testing only. Production email delivery needs a custom SMTP provider.
- App sync currently covers riders and bikes. Suspension, maintenance, and gearing sync need to be connected next.
- There is no subscription/payment system, and Premium entitlement changes remain server/admin controlled.
- The AI Mechanic is still a keyword demo.

## Roadmap

1. **Accounts and garage sync:** apply and test the migration, verify Auth emails and RLS, then exercise rider/bike sync.
2. **Finish cloud sync:** migrate and synchronize suspension, maintenance, and gearing data, including offline conflict and delete handling.
3. **Maintenance:** add engine-specific service intervals, due calculations, and reminders.
4. **Suspension and gearing:** build bike-aware recommendations with clear sources and confidence.
5. **AI Mechanic:** add a secure server-backed assistant with bike context and safety rules.
6. **Launch readiness:** review privacy, accessibility, performance, SMTP, backups, and subscription design. Do not enable payment processing before explicit approval.

The Supabase Free plan is $0 and currently includes 50,000 monthly active users and 500 MB database size; free projects can pause after inactivity and do not include automatic backups. Pro starts at $25/month and includes daily backups, with usage-based overages possible. Built-in Auth email is limited to 2 messages per hour and is only for testing. Verify current details at [Supabase pricing](https://supabase.com/pricing), [API key guidance](https://supabase.com/docs/guides/getting-started/api-keys), and [Auth email guidance](https://supabase.com/docs/guides/auth/auth-smtp).

## Bike catalog coverage and form behavior

The garage uses a cascading Manufacturer → Model → Year selection. The catalog includes broad historical ranges for the listed model names and only extends through documented model years (2027 at the newest). Year ranges are model-specific; historical Kawasaki four-strokes retain the `KX250F` / `KX450F` names and are distinct from the later `KX250` / `KX450` names. Engine type is filled from the selected catalog entry. Unlisted makes, models, and years remain available through “Other / custom,” with manual engine selection.

Catalog ranges (inclusive):

- **Honda:** CRF250R 2004–2027; CRF250RWE 2019–2026; CRF250R HRC WORKS EDITION 2027; CRF450R 2002–2027; CRF450RWE 2019–2026; CRF450R HRC WORKS EDITION 2027.
- **Kawasaki:** KX65 2000–2027; KX85 2001–2027; KX112 2022–2027; KX250F 2004–2020 and 2027; KX250 2021–2026; KX450F 2006–2018 and 2027; KX450 2019–2026.
- **Yamaha:** YZ65 2018–2027; YZ85 2002–2018; YZ85 17/14 and YZ85 19/16 2019–2027; YZ125 and YZ250 1974–2027; YZ250F 2001–2027; YZ450F 2003–2027.
- **Suzuki:** RM-Z250 2004–2026; RM-Z450 2005–2026.
- **KTM:** 50 SX 2002–2027; 50 SX Factory Edition 2026–2027; 65 SX 1998–2027; 85 SX 17/14 and 85 SX 19/16 2003–2027; 125 SX 1998–2027; 250 SX 1997–2027; 300 SX 2023–2027; 250 SX-F 2006–2027; 350 SX-F 2011–2027; 450 SX-F 2007–2027.
- **Husqvarna:** TC 50 and TC 65 2017–2027; TC 85 17/14 and TC 85 19/16, TC 125, TC 250, FC 250, FC 350, and FC 450 2014–2027; TC 300 2023–2027; FC 250 Factory Edition and FC 450 Factory Edition 2027.
- **GasGas:** MC 50, MC 65, both MC 85 wheel-size variants, MC 125, MC 250, MC 250F, and MC 450F 2021–2026; MC 350F 2022–2026; MC 150 and MC 300 2025–2026.
- **Triumph:** TF 250-X 2024–2027; TF 450-RC 2025 only; TF 450-X 2026–2027.

Model-year boundaries use manufacturer histories and announcements where available, with established motocross model-history references for older years. Sources include [Honda's CRF history](https://global.honda/en/CRF/), [Honda's 2004 CRF250R history](https://global.honda/jp/CRF/history/stories/2004/), [Kawasaki's KX four-stroke history](https://content2.kawasaki.com/contentstorage/kmc/newsarticles/media/81d8089c-0abf-47a7-a8ad-931e02b9cca2.pdf), [Yamaha YZ250F history](https://en.wikipedia.org/wiki/Yamaha_YZ250F), [Suzuki's RM-Z archive](https://www.globalsuzuki.com/motorcycle/smgs/digital-archive/2_bike/competition_176.php), [KTM model-year listings](https://mxowners.com/bikes.html), [KTM and Husqvarna range archives](https://motocrossmarketing.com/download/motocrossmarketing/04_Motore_29_web.pdf), [GasGas's 2021 motocross launch](https://press.gasgas.com/news-gasgas-motorcycles-launch-2021-offroad-line-up?id=114033&imageid=408662&l=international&menueid=20135), [2025 AMA-legal model list](https://americanmotorcyclist.com/wp-content/uploads/2025/01/CB2025.03.SX-2025-Approved-Motorcycle-List.pdf), and the 2025–2027 manufacturer sources listed below. Model naming and availability can differ by market, trim, and wheel configuration. Check the bike's VIN and owner documentation before relying on exact fitment or setup specifications.

Current-lineup sources used to check recent entries:

- KTM: [2026 SX range](https://press.ktm.com/news-the-2026-ktm-sx-range-sets-the-latest-motocross-ktm-north-america?id=220920&imageid=878591&l=north+america&menueid=6521), [2027 SX range](https://press.ktm.com/news-get-scrambling-nine-new-2027-ktm-sx-motorcycles-are-primed-for-the-dirt?id=241398&l=scandinavia&menueid=6094)
- Husqvarna: [2026 motocross range](https://press.husqvarna-motorcycles.com/news-husqvarna-mobility-reveals-2026-motocross-line-up?id=221054&imageid=879261&l=international&menueid=19202), [2027 motocross range](https://press.husqvarna-motorcycles.com/news-husqvarna-mobility-announces-refreshed-2027-motocross-line-up?id=241715&imageid=954983&l=north+america&menueid=18846)
- GasGas: [2025 lineup](https://press.gasgas.com/news-gasgas-adds-two-high-revving-2-strokes-to-2025-motocross-line-up?id=200366&l=uk&menueid=24741), [2026 lineup](https://press.gasgas.com/News_Detail.aspx?id=221580&menueid=20135)
- Honda: [2025 CRF250R specs](https://powersports.honda.com/api/custom/downloads/specs?category=motocross&segment=motorcycle&trim=CRF250RS&year=2025), [2025 CRF250RWE specs](https://powersports.honda.com/api/custom/downloads/specs?category=motocross&segment=motorcycle&trim=CRF250RWES&year=2025), [2025 CRF450R specs](https://powersports.honda.com/api/custom/downloads/specs?category=motocross&segment=motorcycle&trim=CRF450RS&year=2025), [2025 CRF450RWE specs](https://powersports.honda.com/api/custom/downloads/specs?category=motocross&segment=motorcycle&trim=CRF450RWES&year=2025), [2026 CRF250R](https://powersports.honda.com/motorcycle/motocross/crf250r/2026/crf250r), [2026 CRF250RWE](https://powersports.honda.com/motorcycle/motocross/crf250r/2026/crf250rwe), [2026 CRF450R](https://powersports.honda.com/motorcycle/motocross/crf450r/2026/crf450r), [2026 CRF450RWE](https://powersports.honda.com/motorcycle/motocross/crf450r/2026/crf450rwe), [2027 CRF450R](https://powersports.honda.com/motorcycle/motocross/crf450r/2027/crf450r)
- Kawasaki: [2027 KX lineup](https://www.kawasaki.com/en-us/press-releases/motorcycle), [2025 KX mini lineup](https://content2.kawasaki.com/ContentStorage/KMC/PressReleases/775/6dd21bad-b5cc-4fb1-ba8d-f9e28da36d83.pdf), [2025 KX250](https://content2.kawasaki.com/ContentStorage/KMC/PressReleases/783/3d16fe3d-06e3-49b6-961d-f773c3e69f05.pdf), [2026 KX models](https://content2.kawasaki.com/ContentStorage/KMC/PressReleases/817/94ff6045-cb4a-43ae-8c9f-a3598f4c45c0.pdf)
- Yamaha: [2025 YZ range announcement](https://global.yamaha-motor.com/jp/news/2024/0718/yz450f.html), [2027 YZ range announcement](https://global.yamaha-motor.com/jp/news/2026/0618/yz250f.html)
- Suzuki: [2025 RM-Z250](https://suzukicycles.com/motocross/2025/rm-z250), [2025 RM-Z450](https://suzukicycles.com/motocross/2025/rm-z450), [2026 RM-Z250](https://suzukicycles.com/motocross/2026/rm-z250), [2026 RM-Z450](https://suzukicycles.com/motocross/2026/rm-z450), [2026 RM-Z return announcement](https://suzukicycles.com/news/2025/07/suzuki-announces-first-wave-of-2026-models-featuring-the-new-gsx-8t-and-gsx-8tt)
- Triumph: [2025 TF 250-X announcement](https://www.triumphmotorcycles.com/for-the-ride/news/motorcycles/my25-tf-250-x-reveal), [2025 TF 450-RC](https://www.triumphmotorcycles.com/motorcycles/off-road/motocross/tf-450-rc-edition-2025), [2026 TF 450-X announcement](https://www.triumphmotorcycles.com/for-the-ride/news/motorcycles/new-tf-450-x-for-2026), [current TF 450-X specs](https://www.triumphmotorcycles.com/motorcycles/off-road/motocross/tf-450-x), [current motocross model range](https://www.triumphmotorcycles.com/motocross)
Rider experience/style, track conditions, suspension outcome, bike/rider associations, and maintenance service are dropdown-controlled where appropriate. Names, notes, heights, hours, click counts, sag, dates, and sprocket counts remain editable text or numeric fields because they are identifying details, notes, or measurements. Saved bikes with values outside the catalog remain editable as custom values; loading a record does not rewrite its stored make, year, model, or engine.
