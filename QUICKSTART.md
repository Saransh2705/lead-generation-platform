# 🚀 Quick Start Guide - Lead Generation Platform

## Prerequisites
- Python 3.11+
- PostgreSQL 15
- Redis 7
- Git

## Installation (Local Development)

### 1. Clone & Setup
```bash
cd lead-generation-platform
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb lead_generation

# Set environment variables
cp config/.env.example .env
# Edit .env with your settings
```

### 3. Initialize Database
```bash
python -m alembic upgrade head
```

### 4. Start Services (Terminal 1)
```bash
uvicorn backend.app:app --reload
# Dashboard: http://localhost:8000/dashboard
```

### 5. Start Celery Worker (Terminal 2)
```bash
celery -A tasks worker --loglevel=info
```

### 6. Start Celery Beat Scheduler (Terminal 3)
```bash
celery -A tasks beat --loglevel=info
```

---

## Docker Setup (Recommended)

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- FastAPI Backend (port 8000)
- Celery Worker
- Celery Beat Scheduler

---

## Configuration

### Environment Variables (.env)
```
DATABASE_URL=postgresql://user:password@localhost/lead_generation
STRIPE_API_KEY=sk_test_...
PAYPAL_CLIENT_ID=...
LINKEDIN_EMAIL=your_email@gmail.com
LINKEDIN_PASSWORD=...
```

### Add Leads Manually
```bash
python -c "
from backend.database import SessionLocal
from backend.models import Lead, LeadType

db = SessionLocal()
lead = Lead(
    first_name='John',
    last_name='Doe',
    email='john@example.com',
    phone='555-1234',
    lead_type=LeadType.REAL_ESTATE_BUYER,
    property_address='123 Main St',
    property_price=500000,
    source='manual'
)
db.add(lead)
db.commit()
print(f'Lead {lead.id} created')
"
```

---

## API Endpoints

### Statistics
```bash
GET /api/v1/stats
```

Response:
```json
{
  "total_leads": 1234,
  "total_sales": 567,
  "total_revenue": 14175.00,
  "average_lead_price": 25.00
}
```

### Get Leads
```bash
GET /api/v1/leads
```

### Create Payment
```bash
POST /api/v1/payments
{
  "sale_id": 123,
  "amount": 25.00,
  "customer_name": "John Smith",
  "customer_email": "john@example.com"
}
```

---

## Automated Tasks (Celery Beat)

The system automatically runs these tasks:

### Scraping (every 2-3 hours)
- Real estate leads from Zillow
- Business leads from Yellow Pages
- Validation & deduplication

### Sales Automation (multiple times daily)
- LinkedIn outreach messages
- Email campaigns
- Facebook group posts
- Marketplace syncing

### Revenue (every 15 minutes - 1 hour)
- Payment status checks
- Invoice generation
- Revenue calculation

### Maintenance (nightly)
- Log cleanup
- Weekly reports

---

## Payment Integration

### Stripe Setup
1. Get API key from https://dashboard.stripe.com/apikeys
2. Add to `.env`: `STRIPE_API_KEY=sk_test_...`
3. Set webhook secret from https://dashboard.stripe.com/webhooks

### PayPal Setup
1. Create Business account at https://business.paypal.com
2. Get Client ID & Secret from developer dashboard
3. Add to `.env`

---

## Monitoring

### Dashboard
Access at: http://localhost:8000/dashboard

Shows:
- Total revenue
- Leads sold
- Average price per lead
- Pending payments
- Recent leads table

### Logs
```bash
# Celery worker logs
docker logs lead_gen_celery

# Backend logs
docker logs lead_gen_backend
```

### Database
```bash
# Connect to PostgreSQL
psql -U lead_user -d lead_generation -h localhost

# View leads
SELECT * FROM leads LIMIT 10;

# View sales
SELECT * FROM sales WHERE is_sold = true;

# View payments
SELECT * FROM payments WHERE status = 'completed';
```

---

## Revenue Tracking

### View Today's Revenue
```bash
python -c "
from backend.services.payment_service import payment_service
stats = payment_service.get_revenue_stats()
print(f'Total Revenue: ${stats[\"total_revenue\"]}')
print(f'Total Payments: {stats[\"total_payments\"]}')
print(f'Pending: ${stats[\"pending_revenue\"]}')
"
```

### Export Data
```bash
python -c "
import pandas as pd
from backend.database import SessionLocal
from backend.models import Payment

db = SessionLocal()
payments = db.query(Payment).all()
data = [{
    'id': p.id,
    'amount': p.amount,
    'status': p.status,
    'created_at': p.created_at
} for p in payments]

df = pd.DataFrame(data)
df.to_csv('payments.csv', index=False)
print('Exported to payments.csv')
"
```

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or change port
uvicorn backend.app:app --port 8001
```

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Create database if missing
createdb lead_generation
```

### Celery Not Running
```bash
# Check Redis
redis-cli ping

# Restart Celery
celery -A tasks purge  # Clear queue
celery -A tasks worker --loglevel=info
```

### Payment Webhook Not Working
1. Check webhook secret in `.env`
2. Verify endpoint is accessible
3. Check logs: `docker logs lead_gen_backend`

---

## Deployment

### AWS Deployment
```bash
# Using Elastic Beanstalk
eb init lead-generation-platform
eb create production
eb deploy
```

### Heroku Deployment
```bash
# Using Heroku
heroku create lead-generation-platform
git push heroku main
heroku addons:create heroku-postgresql:standard-0
heroku addons:create heroku-redis:premium-0
heroku config:set STRIPE_API_KEY=...
```

### Docker Hub
```bash
docker build -t myusername/lead-gen .
docker push myusername/lead-gen
```

---

## Next Steps

1. **Complete Integrations**
   - LinkedIn API authentication
   - Facebook API setup
   - Email provider configuration

2. **Add More Scrapers**
   - Add estate.com scraper
   - Add trulia.com scraper
   - Add custom sources

3. **Expand Sales Channels**
   - Add More APIs
   - Custom web interface for buyers
   - API marketplace listing

4. **Analytics**
   - Add conversion tracking
   - ROI per channel
   - Lead quality scoring

---

## Support

For issues, check:
- Logs: `docker logs`
- Database: `psql`
- Celery: `celery inspect active`
- Redis: `redis-cli KEYS *`

---

**Happy lead selling! 💰**
