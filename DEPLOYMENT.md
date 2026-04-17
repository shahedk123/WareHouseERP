# WarehouseOS Deployment Guide

## 📋 Overview

WarehouseOS is a unified ERP + WhatsApp warehouse management system. All phases (1-5) are complete and ready to deploy.

- **Phase 1:** Database schema (14 tables, Supabase)
- **Phase 2:** WhatsApp backend (webhook, commands, notifications)
- **Phase 3:** ERP backend (products, parties, stock, invoices, tax, reports)
- **Phase 4:** Frontend (React 18, Vite, 25+ pages)
- **Phase 5:** Deployment (Railway backend, Vercel frontend)

---

## 🔧 Prerequisites

1. **Supabase Account** → https://supabase.com
   - Active project (we use: `njjrldbhcrbuazvmupaz`)
   - SQL editor access
   - Service key for backend migrations

2. **Railway Account** → https://railway.app
   - For Node.js backend deployment

3. **Vercel Account** → https://vercel.com
   - For React frontend deployment

4. **GitHub Repository**
   - Linked to Vercel for auto-deployments
   - Connected to Railway for auto-deployments

5. **Meta Business Account** (WhatsApp integration)
   - Cloud API access token
   - Phone ID for WhatsApp Business Account

---

## 📦 Phase 1: Database Setup

### Step 1: Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Create new project (or use existing)
3. Copy project URL and API keys

### Step 2: Apply Migration
1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy entire contents of `supabase/migrations/003_warehouseos_schema.sql`
4. Paste into editor
5. Click **Run**

**Verify:** Check **Tables** tab → should see 14 tables:
- users, company_settings, products, parties
- stock_movements, invoices, invoice_items, payments
- pending_bills, wa_stock_entries, conversation_state, message_log
- product_groups, product_categories

### Step 3: Create Admin User
```bash
cd backend
node scripts/create-admin.js "Ahmed Admin" admin@warehouse.com
```

Save the returned UUID.

### Step 4: Register Test Users (Optional)
```bash
node scripts/register.js +919876543210 "Raju Picker" picker
node scripts/register.js +919876543211 "Priya Accountant" accountant
node scripts/register.js +919876543212 "Rajesh Manager" manager
```

---

## 🚀 Phase 2-3: Backend Deployment (Railway)

### Step 1: Prepare Backend
```bash
cd backend
npm install
```

### Step 2: Create .env
```bash
cp .env.example .env
```

Update with real values:
```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://njjrldbhcrbuazvmupaz.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
WHATSAPP_TOKEN=your-meta-token
WHATSAPP_PHONE_ID=your-phone-id
FRONTEND_URL=https://yourdomain.vercel.app
```

### Step 3: Deploy to Railway
1. Go to https://railway.app/dashboard
2. Click **New Project** → **Deploy from GitHub**
3. Select your `warehousevoice` repository
4. Railway auto-detects Node.js + creates `Procfile`

#### Configure Environment (Railway Dashboard)
1. Go to **Project** → **Variables**
2. Add all variables from `.env`
3. Set **PORT** to 3001

#### Configure Domain
1. Go to **Project** → **Settings** → **Networking**
2. Railway assigns auto domain (e.g., `warehouseos-prod.railway.app`)
3. Set public domain or custom domain

#### Deploy
1. Railway auto-deploys on GitHub push
2. Or manually click **Deploy** button
3. Check **Deployments** tab → see logs

**Verify Backend Live:**
```bash
curl https://warehouseos-prod.railway.app/health
# Should return: {"status":"ok","service":"WarehouseOS API"}
```

---

## 🎨 Phase 4: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend
```bash
cd frontend
npm install
```

### Step 2: Create .env.local (for local testing)
```bash
cp .env.example .env.local
```

Update:
```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://njjrldbhcrbuazvmupaz.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Deploy to Vercel
1. Go to https://vercel.com/dashboard
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Select **frontend** as root directory
5. Click **Deploy**

#### Configure Environment
1. Go to **Project Settings** → **Environment Variables**
2. Add for all environments (Preview, Production, Development):
   - `VITE_API_URL` → Your Railway backend URL
   - `VITE_SUPABASE_URL` → Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → Your anon key
3. Redeploy after adding vars

#### Custom Domain (Optional)
1. Go to **Project Settings** → **Domains**
2. Add custom domain (e.g., `warehouse.yourdomain.com`)

**Verify Frontend Live:**
- Visit your Vercel URL
- Should redirect to `/login` if not authenticated
- Login with registered email
- Should see `/dashboard` with KPI cards

---

## 🧪 Phase 5: Post-Deployment Testing

### Backend Testing
```bash
# Health check
curl https://warehouseos-prod.railway.app/health

# Create product (replace ADMIN_UUID)
curl -X POST https://warehouseos-prod.railway.app/api/erp/products \
  -H "Content-Type: application/json" \
  -H "x-user-id: ADMIN_UUID" \
  -H "x-user-role: admin" \
  -d '{"code":"TEST-001","name":"Test Product","unit":"bags","tax_rate":5,"tax_type":"GST","selling_rate":100}'

# Get users
curl https://warehouseos-prod.railway.app/api/users
```

### Frontend Testing
1. **Login** → https://your-domain.vercel.app
   - Use registered email
   - Should redirect to `/dashboard`

2. **Create Product** → `/products` → Add Product
   - Fill form, submit
   - Should appear in list

3. **Create Invoice** → `/invoices/create`
   - Step 1: Select customer
   - Step 2: Add items
   - Step 3: Confirm, create
   - Should show success message

4. **Stock In** → `/stock/in`
   - Select product, quantity, rate
   - Submit
   - Verify stock updates on `/reports/stock`

5. **GST Summary** → `/tax/gst`
   - Select date range
   - Should show tax breakdown

---

## 📊 Monitoring & Logs

### Railway Logs
1. Go to **Railway Dashboard** → **Project** → **Deployments**
2. Click latest deployment → **View Logs**
3. See real-time logs (startup, errors, requests)

### Vercel Logs
1. Go to **Vercel Dashboard** → **Project**
2. Click **Deployments** → Latest
3. See build logs, preview URLs

### Supabase Monitoring
1. Go to **Supabase Dashboard** → **Monitoring**
2. View database stats, connection pools
3. Check logs for auth/RLS issues

---

## 🔐 Security Checklist

- [ ] **CORS**: Backend allows frontend domain
  - Update `FRONTEND_URL` in backend .env
  - Or configure in Supabase RLS policies

- [ ] **Environment Variables**: Never commit `.env`
  - Use `.env.example` template
  - Store secrets in Railway/Vercel dashboards

- [ ] **Service Key**: Keep Supabase service key secret
  - Only used in backend
  - Never expose in frontend

- [ ] **Anon Key**: Only frontend-safe permissions
  - Frontend uses anon key (in browser, visible)
  - RLS policies protect table access

- [ ] **API Headers**: Always validate `x-user-id` and `x-user-role` on backend

- [ ] **HTTPS**: All endpoints use HTTPS (Railway + Vercel auto-enable)

---

## 🔄 CI/CD Pipeline

### Automatic Deployments

#### Backend (Railway)
- On push to `main` branch → auto-deploy
- Logs visible in Railway dashboard
- Auto-healthcheck on deployment

#### Frontend (Vercel)
- On push to `main` branch → auto-deploy
- On pull request → preview deployment (separate URL)
- Can manually promote preview → production

#### Disable Auto-Deploy
1. Railway: **Project Settings** → Disable auto-deploy
2. Vercel: **Settings** → **Git** → Uncheck "Deploy on every push"

---

## 📝 Rollback Process

### Backend (Railway)
1. Go to **Project** → **Deployments**
2. Find previous successful deployment
3. Click → **Redeploy** button
4. Takes ~2 min to redeploy

### Frontend (Vercel)
1. Go to **Deployments** tab
2. Click previous stable deployment
3. Click **⋯** menu → **Promote to Production**
4. Takes ~30 sec

---

## 🛠 Troubleshooting

### Backend Won't Start
```bash
# Check logs in Railway dashboard
# Common issues:
# 1. Missing env vars → Add in Railway Variables
# 2. Port conflict → Ensure PORT=3001 in Railway
# 3. DB connection → Verify SUPABASE_URL and SERVICE_KEY
```

### Frontend Shows API Errors
```bash
# 1. Check VITE_API_URL in Vercel → should be Railway URL
# 2. Check CORS: backend must allow frontend domain
# 3. Check auth headers: x-user-id, x-user-role should be present
# Open browser DevTools → Network tab → see actual requests
```

### Supabase Connection Timeout
```bash
# 1. Verify SUPABASE_URL is correct
# 2. Check if Supabase project is active (not paused)
# 3. Verify service key has correct permissions
# 4. Check firewall: Supabase IP may be blocked
```

### RLS Policy Errors
```bash
# Error: "new row violates row level security policy"
# 1. Go to Supabase → Tables → RLS policies
# 2. MVP has all policies "ENABLE (all open)"
# 3. For production, restrict by user/role
```

---

## 📈 Scaling & Performance

### Database
- Supabase auto-scales with plan tier
- **Free tier:** 500MB storage, 2 connections
- **Pro tier:** Unlimited storage, 100 connections
- Monitor in Supabase dashboard

### Backend
- Railway: auto-scales with CPU/memory
- Increase plan in **Railway Settings** → **Plan**
- Monitor CPU/memory in **Metrics** tab

### Frontend
- Vercel: CDN serves from 300+ edge locations
- Build optimized automatically
- Monitor in **Analytics** tab

### Caching
- Backend has 15-min stale alerts cron
- Frontend uses Supabase realtime for live updates
- Add Redis for session/token caching if needed

---

## 📚 Useful Links

- **Supabase Docs:** https://supabase.com/docs
- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **React Docs:** https://react.dev
- **Vite Docs:** https://vitejs.dev
- **Axios Docs:** https://axios-http.com

---

## 🎉 Success Indicators

✅ **Backend deployed:**
- Health check returns 200 OK
- Can create products, invoices
- Database queries are fast

✅ **Frontend deployed:**
- Login page loads
- Can authenticate with email
- Dashboard shows KPI cards
- Can create/edit products, invoices

✅ **Database synced:**
- Data created in frontend appears in Supabase
- Tax calculations are correct
- Stock movements are reflected

✅ **WhatsApp integrated (if using):**
- Webhook receives messages
- Bill photos are stored
- Commands work (CLAIM, DONE, etc.)

**🚀 All phases complete. System ready for production use.**
