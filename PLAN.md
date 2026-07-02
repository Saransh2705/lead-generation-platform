# Lead Generation Platform - Complete Plan

**Goal:** Scrape leads → Auto-sell to multiple channels → Notify on buyer requests → Manual payment.

---

## 1. ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    LEAD GENERATION SYSTEM                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. SCRAPER (Auto, every 2-3 hrs)                       │
│     └─ Zillow, LinkedIn, Yellow Pages → leads.csv       │
│                                                           │
│  2. AUTO-SELLERS (Auto, continuous)                     │
│     ├─ LinkedIn → DMs to real estate agents/brokers     │
│     ├─ Facebook → Posts in real estate groups           │
│     ├─ Email → Send to agent email list                 │
│     ├─ APIs → LendingTree, Zillow, QuinStreet           │
│     └─ Custom Platform → Form for direct sales          │
│                                                           │
│  3. BUYER FORM (Custom platform page)                   │
│     └─ "I want X leads for $Y" → Saved to database      │
│                                                           │
│  4. NOTIFICATIONS (Real-time)                           │
│     └─ Notify you: "New buyer! John wants 50 leads"    │
│                                                           │
│  5. PAYMENT HANDLING (Manual)                           │
│     └─ You accept offer → Send CSV → Get paid manually  │
│                                                           │
│  6. DASHBOARD                                            │
│     ├─ Scraper status                                   │
│     ├─ Pending buyer requests                           │
│     ├─ Payment logs                                      │
│     └─ Total revenue                                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. FILE STRUCTURE

```
lead-generation-platform/
├── pages/
│   ├── index.tsx                  # Dashboard (admin only)
│   ├── buy-leads.tsx              # Public buyer form
│   ├── api/
│   │   ├── scrape.ts              # POST - trigger scraper
│   │   ├── sell-linkedin.ts       # POST - LinkedIn outreach
│   │   ├── sell-email.ts          # POST - Email campaigns
│   │   ├── sell-facebook.ts       # POST - Facebook posts
│   │   ├── sell-api.ts            # POST - LendingTree/Zillow/QuinStreet
│   │   ├── submit-buyer-form.ts   # POST - buyer request form
│   │   ├── get-requests.ts        # GET - fetch pending buyer requests
│   │   ├── logs.ts                # GET - fetch payments
│   │   └── notify.ts              # POST - send you notification
│   └── data/
│       ├── leads.csv              # Scraped leads
│       ├── payments.json          # Manual payments logged
│       ├── buyer-requests.json    # Pending buyer requests
│       ├── agent-emails.txt       # Email list (for campaigns)
│       └── config.json            # Channels config
│
├── lib/
│   ├── scraper.ts                 # Playwright scraping logic
│   ├── sellers/
│   │   ├── linkedin.ts            # LinkedIn automation
│   │   ├── facebook.ts            # Facebook group posting
│   │   ├── email.ts               # Email sending
│   │   ├── apis.ts                # LendingTree/Zillow/QuinStreet
│   │   └── platform.ts            # Custom platform logic
│   ├── payment-logger.ts          # JSON file I/O
│   └── notifier.ts                # Send you notifications (email/webhook)
│
├── public/
│   └── buy-leads-form.html        # Public buyer form (optional static)
│
├── .env.example
├── package.json
├── tsconfig.json
└── PLAN.md
```

---

## 3. CORE FLOW

### Phase 1: Scraper (Day 1)
**API Route:** `POST /api/scrape`
- Playwright launches Chrome
- Scrapes Zillow, LinkedIn, Yellow Pages
- Saves to `data/leads.csv` (name, email, phone, company, lead_type)
- Returns: `{count: 150, success: true}`

### Phase 2: Auto-Sellers (Days 2-3)

#### LinkedIn Seller
**API Route:** `POST /api/sell-linkedin`
- Reads `leads.csv`
- Filters for: Real estate agents, mortgage brokers, insurance agents
- Auto-sends LinkedIn DMs: "Hi [name], I have high-quality real estate leads. Interested?"
- Tracks: sent, opened, replied
- Saves responses

#### Facebook Seller
**API Route:** `POST /api/sell-facebook`
- Reads `leads.csv`
- Posts to real estate groups: "[50 fresh real estate leads available] Contact us: [link]"
- Tracks: posted, reactions, shares

#### Email Seller
**API Route:** `POST /api/sell-email`
- Reads agent email list from `data/agent-emails.txt`
- Sends: "I have 50 real estate leads ready. Interested in buying? Reply YES"
- Tracks: sent, bounced, replied

#### API Integrations
**API Route:** `POST /api/sell-api`
- **LendingTree**: Send via their partner API
- **Zillow**: Send via their lead submission API
- **QuinStreet**: Send via their API
- (These are "passive" - platform buys from you)

#### Custom Buyer Platform
**Page:** `/buy-leads`
- Public form: "Buy real estate leads"
- Fields:
  - Your name
  - Email
  - Phone
  - How many leads? (50, 100, 500, 1000)
  - Price you'll pay?
  - Lead type (buyer/seller/investor)
  - Submit
- Saves to `data/buyer-requests.json`
- Triggers notification to you

### Phase 3: Buyer Requests & Notifications (Days 3-4)

**API Route:** `POST /api/submit-buyer-form`
- Receives buyer form data
- Saves to `data/buyer-requests.json`
- Sends you notification (email webhook + dashboard alert)
- Notification: "🚨 NEW BUYER REQUEST\nName: John Smith\nEmail: john@realtors.com\nWants: 50 leads\nPrice: $500\n[Accept] [Reject]"

**API Route:** `GET /api/get-requests`
- Returns pending buyer requests
- Dashboard shows them in real-time

**API Route:** `POST /api/notify`
- Sends you webhook/email notification
- Can integrate with Slack, Discord, email, etc

### Phase 4: Dashboard (Day 4)

**Pages:** `pages/index.tsx` (Admin dashboard)
- Scraper controls: "Run now" button, status, last run time
- Seller controls: "Send LinkedIn offers", "Post to Facebook", "Send emails"
- Pending requests table:
  - Buyer name, email, wants X leads for $Y
  - Actions: [Accept & Send CSV] [Reject]
- Payments table:
  - Logged payments + total earned
- Quick stats:
  - Total leads scraped
  - Buyers reached (LinkedIn, Facebook, Email, APIs)
  - Pending requests count
  - Total revenue

---

## 4. BUYER NOTIFICATION FLOW

```
1. Buyer visits /buy-leads
2. Fills form: "I want 50 leads for $500"
3. Submits → POST /api/submit-buyer-form
4. Saved to buyer-requests.json
5. You get notification: Email + Dashboard alert
6. You review offer
7. If good: Click [Accept & Send CSV]
   └─ Sends buyer the leads.csv file
   └─ Creates "pending payment" entry
8. Buyer sends you payment (email/Venmo/bank transfer)
9. You log payment in dashboard
10. Dashboard shows: "Earned $500 from John"
```

---

## 5. ENV VARIABLES (.env.local)

```bash
# LinkedIn
LINKEDIN_EMAIL=your_email@gmail.com
LINKEDIN_PASSWORD=your_password
LINKEDIN_API_KEY=optional_if_using_api

# Facebook
FACEBOOK_PAGE_ACCESS_TOKEN=your_token
FACEBOOK_GROUP_IDS=123456,789012,345678

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=app_password

# APIs
LENDINGTREE_API_KEY=your_key
ZILLOW_API_KEY=your_key
QUINSTREET_API_KEY=your_key

# Notifications
NOTIFICATION_EMAIL=your_personal_email@gmail.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/... (optional)
DISCORD_WEBHOOK_URL=... (optional)

# Scraper config
SCRAPER_LOCATIONS=los-angeles,new-york,chicago
SCRAPER_LEAD_TYPES=buyer,seller,investor
```

---

## 6. DEPENDENCIES

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "playwright": "^1.40.0",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 7. IMPLEMENTATION PHASES

| Phase | Time | What |
|-------|------|------|
| **1: Scraper** | 3-4 hrs | `/api/scrape` - Get leads into CSV |
| **2: Sellers** | 6-8 hrs | LinkedIn, Facebook, Email, APIs auto-send offers |
| **3: Buyer Form** | 2-3 hrs | `/buy-leads` page + `/api/submit-buyer-form` |
| **4: Notifications** | 2 hrs | Alert you when buyer submits request |
| **5: Dashboard** | 3-4 hrs | Admin panel to manage everything |
| **6: Testing** | 2 hrs | End-to-end: scrape → sell → buyer request → log payment |
| **TOTAL** | **3-4 days** | One person, part-time |

---

## 8. WHAT HAPPENS AUTOMATICALLY

### Every 2-3 Hours
- Scraper runs → new leads saved to CSV

### Continuously (every 15 min)
- LinkedIn seller: Check for replies, send more DMs
- Facebook seller: Post to groups
- Email seller: Send campaigns to agent lists
- APIs: Submit leads to LendingTree/Zillow/QuinStreet

### Real-Time
- Buyer visits `/buy-leads` → submits form
- You get notified immediately
- Buyer request appears in dashboard

---

## 9. MANUAL WORKFLOW

```
Morning:
1. Dashboard shows: "52 new leads scraped, 3 pending buyer requests"
2. You review requests:
   - John: wants 50 leads for $500
   - Sarah: wants 100 leads for $800
   - Mike: wants 20 leads for $200
3. Click [Accept & Send CSV] on John's request
4. John receives email with CSV + instructions to pay
5. John sends you $500 (Venmo/bank transfer)
6. You log in dashboard: "Received $500 from John"
7. Dashboard now shows: "Total earned: $500"

Repeat steps 2-6 throughout the day
```

---

## 10. CHANNELS BREAKDOWN

### LinkedIn (Active)
- Target: Real estate agents, brokers, investors
- Message: "Hi [name], I have high-quality real estate leads. Interested in buying? How many leads would you need?"
- Response handling: When they reply with interest, you get notified

### Facebook (Active)
- Target: Real estate groups, investor groups
- Post: "🏠 Fresh Real Estate Leads Available 🏠\n50 high-quality leads: [buyers/sellers/investors]\nInterested? Contact us: [link to /buy-leads]"
- Tracking: Post reactions, comments

### Email (Active)
- Target: Agent email list (you provide)
- Message: "Subject: Real Estate Leads Available\n\nHi [name], I have X leads available. Price: $Y per lead. Reply YES if interested."
- Response handling: Email replies → forwarded to you

### APIs (Passive)
- **LendingTree**: They buy via API, auto-process
- **Zillow**: They buy via API, auto-process
- **QuinStreet**: They buy via API, auto-process
- (You submit leads, they auto-buy if they match criteria)

### Custom Platform (Active + Passive)
- Your own landing page at `/buy-leads`
- Buyers can fill form anytime
- You control who buys and at what price

---

## 11. HONEST GOTCHAS

1. **LinkedIn/Facebook rate limits** - Can't send 1000 DMs/day. Spread them over time (50/hour max). Use delays between messages.

2. **Email deliverability** - Gmail/Outlook may mark bulk emails as spam. Use legit SMTP provider (Mailgun, SendGrid) for better delivery.

3. **API quotas** - LendingTree/Zillow/QuinStreet have limits on submissions. Check their docs.

4. **LinkedIn/Facebook TOS** - Automated outreach may violate TOS. Use accounts you're OK losing.

5. **Lead quality** - Scraped leads (names, emails, phones) may be outdated. Have high bounce rate. Test on small batch first.

6. **Response handling** - LinkedIn DMs/replies are manual. You read them, decide to sell or not.

7. **CSV file corruption** - If two updates happen simultaneously, file could corrupt. Use atomic writes (see `lib/payment-logger.ts`).

8. **Notification delivery** - Email/Slack notifications must be configured. Test first.

---

## 12. DEPLOYMENT

**Option A: Vercel** (Free, easy)
- Push to GitHub
- Connect to Vercel
- Add env vars
- Deploy
- **Caveat**: File I/O unreliable on serverless. Use `/tmp` or database.

**Option B: Self-hosted** (Better for file storage)
- Railway, Fly.io, Render, DigitalOcean
- `npm run build && npm run start`
- Files persist in `pages/data/`
- **Better for this project**

---

## 13. REVENUE CALCULATION

```
Example:
- Scrape 100 leads/day
- Send to LinkedIn (50 interested)
- Send to Facebook (20 interested)
- Send to Email (30 interested)
- APIs auto-buy 5 leads/day

Buyer conversion (realistic): 5-10%
- LinkedIn: 50 × 5% = 2-3 buyers/day
- Facebook: 20 × 5% = 1 buyer/day
- Email: 30 × 5% = 1-2 buyers/day
- APIs: 5 auto-sales/day
- Total: ~10 buyers/day buying ~50 leads total

Revenue (at $10-20/lead):
- 50 leads × $15 avg = $750/day
- $750 × 30 days = $22,500/month

**Conservative estimate with manual system**
```

---

## 14. NEXT STEPS

1. **Setup** (30 min): Create Next.js app, add dependencies
2. **Scraper** (3-4 hrs): Build `/api/scrape`
3. **Sellers** (6-8 hrs): LinkedIn, Facebook, Email, APIs
4. **Buyer form** (2-3 hrs): `/buy-leads` page + notifications
5. **Dashboard** (3-4 hrs): Admin panel
6. **Testing** (2 hrs): Full flow
7. **Deploy** (1 hr): To Railway/Fly

---

**Ready to build Phase 1: Scraper? 🚀**
