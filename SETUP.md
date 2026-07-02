# Setup Guide - Lead Generation Platform

This is a **production-ready** lead generation and autonomous sales platform. Follow these steps to deploy.

## 1. Prerequisites

- Node.js 18+
- Git account (GitHub)
- Supabase account (free tier)
- Vercel account (free tier)
- Discord server + webhook
- Resend account (for emails)
- Google account (for Google Form + Gmail)

## 2. Create Supabase Project

1. Go to https://supabase.com/auth/signup
2. Sign up with email: `flauraSaransh+2@gmail.com` (or any new email)
3. Create a new free project (Region: closest to you)
4. Wait for it to initialize
5. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
6. Save these in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<project-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

## 3. Apply Database Schema

```bash
cd lead-generation-platform

# Install dependencies
npm install

# Connect to your Supabase project
# Update .env.local with your keys from step 2

# Apply schema via Supabase SQL Editor or CLI
# Copy the contents of supabase/migrations/0001_init.sql
# Go to Supabase Dashboard → SQL Editor → New Query
# Paste and run the SQL
```

## 4. Setup Resend (for email outreach)

1. Go to https://resend.com
2. Create a free account
3. Verify your email
4. Get API key from Dashboard
5. Add to `.env.local`:
   ```
   RESEND_API_KEY=<your-key>
   ```

## 5. Setup Discord Webhook (for notifications)

1. Open your Discord server
2. Server Settings → Integrations → Webhooks
3. Create New Webhook → Copy webhook URL
4. Add to `.env.local`:
   ```
   DISCORD_WEBHOOK_URL=<webhook-url>
   ```

## 6. Setup Admin Password

Choose a strong password and add to `.env.local`:
```
ADMIN_PASSWORD=<your-secure-password>
```

## 7. Create Google Form

1. Go to https://forms.google.com
2. Create a new form titled: "Buy Leads"
3. Add these fields in order:
   - **Your Name** (Short answer)
   - **Your Email** (Email)
   - **Phone** (Short answer)
   - **Lead Category** (Multiple choice: Real Estate Buyer, Real Estate Seller, Mortgage, Insurance, B2B)
   - **Quantity Wanted** (Multiple choice: 10, 25, 50, 100, 250, 500)
   - **Price You'll Pay** (Short answer)
   - **Additional Notes** (Paragraph)
4. Go to **Responses** tab → Click the Google Sheets icon to create a linked sheet
5. In the form, click **More (⋮)** → **Get pre-filled link**
6. Copy the form ID from the URL: `https://forms.google.com/u/0/d/<FORM_ID>/edit`

## 8. Setup Apps Script (Google Form → Discord + Webhook)

1. Open your Google Form
2. Click **More (⋮)** → **Script Editor**
3. Delete any existing code
4. Paste this script:

```javascript
function onFormSubmit(e) {
  const response = e.response;
  const formResponse = response.getItemResponses();
  
  const data = {
    buyer_name: formResponse[0].getResponse(),
    buyer_email: formResponse[1].getResponse(),
    buyer_phone: formResponse[2].getResponse(),
    category_wanted: formResponse[3].getResponse(),
    quantity_wanted: formResponse[4].getResponse(),
    price_offered: formResponse[5].getResponse(),
    notes: formResponse[6].getResponse()
  };

  // Send to Discord
  const discordUrl = "DISCORD_WEBHOOK_URL_HERE";
  const discordPayload = {
    content: `🚨 NEW BUYER REQUEST\n**${data.buyer_name}** (${data.buyer_email})\nWants: ${data.quantity_wanted} ${data.category_wanted} leads for $${data.price_offered}\nPhone: ${data.buyer_phone}`,
    embeds: [{
      color: 3447003,
      fields: [
        {name: "Name", value: data.buyer_name},
        {name: "Email", value: data.buyer_email},
        {name: "Phone", value: data.buyer_phone},
        {name: "Category", value: data.category_wanted},
        {name: "Quantity", value: data.quantity_wanted},
        {name: "Price Offered", value: `$${data.price_offered}`},
        {name: "Notes", value: data.notes || "None"}
      ]
    }]
  };
  
  UrlFetchApp.fetch(discordUrl, {
    method: "post",
    payload: JSON.stringify(discordPayload),
    headers: {"Content-Type": "application/json"}
  });

  // Send to dashboard webhook
  const webhookUrl = "https://your-vercel-app.vercel.app/api/buyer-request-webhook";
  UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    payload: JSON.stringify(data),
    headers: {"Content-Type": "application/json"}
  });
}
```

5. Replace:
   - `DISCORD_WEBHOOK_URL_HERE` with your Discord webhook URL
   - `https://your-vercel-app.vercel.app` with your deployed Vercel URL
6. Save (Ctrl+S)
7. Click **Run** → authorize the script

## 9. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to GitHub repo (will create if needed)
# - Set project name: "lead-generation-platform"
# - Select framework: Next.js
# - Add environment variables from .env.local
```

## 10. Update GitHub Secrets

For GitHub Actions to run scrapers and automated outreach:

```bash
# Go to your GitHub repo → Settings → Secrets and variables → Actions

# Add these secrets:
gh secret set SUPABASE_URL -b "<your-project-url>"
gh secret set SUPABASE_SERVICE_ROLE_KEY -b "<your-service-role-key>"
gh secret set RESEND_API_KEY -b "<your-resend-key>"
gh secret set DISCORD_WEBHOOK_URL -b "<your-discord-webhook>"
gh secret set ADMIN_PASSWORD -b "<your-admin-password>"

# For LinkedIn/Facebook automation (later):
gh secret set LINKEDIN_SESSION -b "<your-linkedin-session-storage-json>"
gh secret set FACEBOOK_SESSION -b "<your-facebook-session-storage-json>"
```

## 11. Local Testing

```bash
# Install dependencies
npm install

# Create .env.local with all values from above

# Run dev server
npm run dev

# Open http://localhost:3000/login
# Login with ADMIN_PASSWORD
```

## 12. Test Buyer Form Webhook

```bash
# From terminal:
curl -X POST http://localhost:3000/api/buyer-request-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_name": "Test Buyer",
    "buyer_email": "test@example.com",
    "buyer_phone": "555-1234",
    "category_wanted": "Real Estate Buyer",
    "quantity_wanted": "50",
    "price_offered": "500",
    "notes": "Test request"
  }'

# Verify:
# 1. Check Discord - should see the notification
# 2. Go to dashboard http://localhost:3000/requests
# 3. Should see the new request in the table
```

## 13. Test Scraper

```bash
npm run scrape

# Should create sample leads in Supabase leads table
```

## 14. Deploy Workflows

```bash
# Push to GitHub
git add .
git commit -m "Initial lead generation platform"
git push

# Workflows are in .github/workflows/ and will run on schedule:
# - scrape.yml: Every 2 hours
# - sell-email.yml: Every 4 hours
# - draft-outreach.yml: Every 6 hours (LinkedIn/Facebook drafts)

# Trigger manually:
gh workflow run scrape.yml
gh workflow run sell-email.yml
```

## 15. Monitor

- Dashboard: https://your-vercel-app.vercel.app/login
- GitHub Actions: https://github.com/your-username/lead-generation-platform/actions
- Supabase: https://supabase.com/dashboard
- Discord: Check webhook channel for notifications

## Troubleshooting

**Webhook not receiving?**
- Check Discord webhook URL is correct
- Check Vercel deployment logs: `vercel logs`
- Ensure ADMIN_PASSWORD is set in Vercel env vars

**Scraper not running?**
- Check GitHub Actions tab for errors
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct in secrets
- Check workflow logs for specific error

**Dashboard not loading?**
- Clear browser cache
- Check Vercel deployment is successful
- Verify NEXT_PUBLIC_SUPABASE_URL is accessible

## Next Steps

1. Add more lead categories in `lib/categories.ts`
2. Implement LinkedIn/Facebook automation (requires session capture)
3. Add LendingTree/Zillow API integrations
4. Setup email templates in Resend
5. Monitor leads and adjust pricing based on demand
