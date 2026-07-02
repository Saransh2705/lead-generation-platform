# 🎯 Lead Generation Platform - Manual Payment System

A simple, no-frills lead scraper + manual payment logger. Scrape leads from websites, track sales manually.

## ✅ What It Does

- **Scrapes leads** from any website (Zillow, LinkedIn, Yellow Pages, etc)
- **Saves to CSV** automatically
- **Manual payment logging** - you enter what you earned
- **Simple dashboard** - see total revenue + leads count
- **No API keys, no business accounts** - just a web app

## 🏗️ Tech Stack

- **Next.js** - Full-stack JavaScript app
- **Playwright** - Web scraping with JavaScript support
- **JSON files** - `payments.json` for tracking earnings
- **TypeScript** - Type-safe code

## 📁 Project Structure

```
lead-generation-platform/
├── pages/
│   ├── index.tsx              # Dashboard: Run scraper, view leads
│   ├── payments.tsx           # Manual payment logger
│   └── api/
│       └── logs.ts            # Fetch payments.json
├── scripts/
│   └── scraper.ts             # Playwright scraper
├── lib/
│   └── payment-logger.ts      # JSON file I/O
├── data/
│   ├── leads.csv              # Scraped leads
│   └── payments.json          # Manual payments
├── .env.example
├── package.json
├── tsconfig.json
└── PLAN.md                    # Full implementation plan
```

## 🚀 Quick Start (2 minutes)

```bash
cd lead-generation-platform

# Install
npm install

# Setup
cp .env.example .env.local

# Run
npm run dev

# Open http://localhost:3000
```

See `PLAN.md` for full setup.

## 💰 Workflow

1. **Scrape leads**: Click "Run Scraper" → saves to CSV
2. **Sell leads**: Email CSV to buyer (outside app)
3. **Log payment**: Go to Payments page, enter amount + buyer email
4. **View earnings**: Dashboard shows total

**That's it. No integrations, no headache.**

## 📊 Status

- ✅ Plan complete (`PLAN.md`)
- ⏳ **Phase 1: Scraper** - Starting now
- ⏳ Phase 2: Dashboard
- ⏳ Phase 3: Payment logger

---

**Version**: 1.0.0 - Manual Payment System  
**Last Updated**: 2026-07-02
