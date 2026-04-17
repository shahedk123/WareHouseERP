# WarehouseOS — Deployment Checklist

**Status:** Ready to deploy  
**Estimated Time:** 40 minutes total  
**Last Updated:** April 6, 2026

---

## 📋 Pre-Deployment (Day 1)

### Accounts & Access
- [ ] GitHub account created
- [ ] Supabase account created
- [ ] Railway account created
- [ ] Vercel account created
- [ ] GitHub repository cloned locally

### Code Preparation
- [ ] Repository structure verified
- [ ] `.env.example` files in place
- [ ] Backend code reviewed
- [ ] Frontend code reviewed
- [ ] No sensitive data in git history

### Documentation Review
- [ ] README.md read (5 min)
- [ ] QUICK_DEPLOY.md read (5 min)
- [ ] DEPLOYMENT.md bookmarked for reference

---

## 🗄️ Step 1: Database Setup (Supabase) — 5 minutes

### Create/Access Supabase Project
- [ ] Go to https://supabase.com/dashboard
- [ ] Use existing project OR create new
- [ ] Note project URL: `https://njjrldbhcrbuazvmupaz.supabase.co`
- [ ] Copy Service Key from Settings → API Keys

### Apply Migration
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Copy `supabase/migrations/003_warehouseos_schema.sql`
- [ ] Paste into SQL editor
- [ ] Click Run
- [ ] Wait for success message

### Verify Database
- [ ] Check Tables tab
- [ ] Verify 14 tables created:
  - [ ] users
  - [ ] company_settings
  - [ ] products
  - [ ] parties
  - [ ] stock_movements
  - [ ] invoices
  - [ ] invoice_items
  - [ ] payments
  - [ ] pending_bills
  - [ ] wa_stock_entries
  - [ ] conversation_state
  - [ ] message_log
  - [ ] product_groups
  - [ ] product_categories
- [ ] Verify seed data (8 product groups)

### Get API Keys
- [ ] Copy Supabase URL
- [ ] Copy Service Key (backend use)
- [ ] Copy Anon Key (frontend use)
- [ ] Store in safe place (password manager)

✅ **Database ready!**

---

## 👤 Step 2: Admin User Setup (Backend Scripts) — 2 minutes

### Run Admin Creation Script
```bash
cd backend
node scripts/create-admin.js "Your Name" your@email.com
```

### Verify Output
- [ ] Script runs without errors
- [ ] Admin user ID returned
- [ ] Email and role confirmed
- [ ] No database connection errors

### Save Admin Credentials
- [ ] Copy admin user ID
- [ ] Save email address
- [ ] Will use for testing and initial login

✅ **Admin user created!**

---

## 🧪 Step 3: Local Testing — 10 minutes

### Test Backend Locally
- [ ] Terminal 1: `cd backend && npm run dev`
- [ ] Backend starts on port 3001
- [ ] See message: "✅ Cron jobs started"
- [ ] Health check: `curl http://localhost:3001/health`
- [ ] Returns: `{"status":"ok","service":"WarehouseOS API"}`

### Test Frontend Locally
- [ ] Terminal 2: `cd frontend && npm run dev`
- [ ] Frontend starts on port 5173
- [ ] Browser: http://localhost:5173
- [ ] Login page loads
- [ ] Can login with admin email
- [ ] Dashboard displays with KPI cards

### Run Backend Tests (Optional but Recommended)
- [ ] Follow TESTING.md
- [ ] Run 12 curl tests
- [ ] All tests should pass
- [ ] Verify tax calculations

✅ **System works locally!**

---

## 🚀 Step 4: Deploy Backend (Railway) — 10 minutes

### Create Railway Project
- [ ] Go to https://railway.app/dashboard
- [ ] Click **New Project**
- [ ] Click **Deploy from GitHub**
- [ ] Select repository: `warehousevoice`
- [ ] Authorize GitHub access

### Configure Build Settings
- [ ] Framework: Node.js (auto-detected)
- [ ] Build command: `cd backend && npm install`
- [ ] Start command: `cd backend && npm run dev`

### Add Environment Variables
In Railway Dashboard → Project → Variables, add:
- [ ] NODE_ENV = `production`
- [ ] PORT = `3001`
- [ ] SUPABASE_URL = `https://njjrldbhcrbuazvmupaz.supabase.co`
- [ ] SUPABASE_SERVICE_KEY = (from Step 1)
- [ ] WHATSAPP_TOKEN = (placeholder if not using: `skip`)
- [ ] WHATSAPP_PHONE_ID = (placeholder if not using: `skip`)
- [ ] FRONTEND_URL = (will update after Vercel deployed)

### Deploy
- [ ] Click **Deploy** button
- [ ] Wait 2-3 minutes for build & deploy
- [ ] Check Deployments tab for success
- [ ] Copy public URL (e.g., `https://warehouseos-prod.railway.app`)

### Verify Deployment
- [ ] Health check: `curl https://[railway-url]/health`
- [ ] Should return success JSON
- [ ] No 500 errors in logs
- [ ] Database connection successful

✅ **Backend deployed!**

---

## 🎨 Step 5: Deploy Frontend (Vercel) — 10 minutes

### Create Vercel Project
- [ ] Go to https://vercel.com/dashboard
- [ ] Click **Add New** → **Project**
- [ ] Click **Import Git Repository**
- [ ] Select `warehousevoice` repo
- [ ] Click **Import**

### Configure Build Settings
- [ ] Framework: Vite (auto-detected)
- [ ] Root Directory: `frontend` (important!)
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm install`

### Add Environment Variables
In Vercel Dashboard → Project → Settings → Environment Variables:
- [ ] VITE_API_URL = (Railway URL from Step 4)
- [ ] VITE_SUPABASE_URL = (from Step 1)
- [ ] VITE_SUPABASE_ANON_KEY = (from Step 1)

### Deploy
- [ ] Click **Deploy** button
- [ ] Wait 3-5 minutes for build & deploy
- [ ] Check Deployments tab for success
- [ ] Copy Vercel URL (e.g., `https://warehouseos-frontend.vercel.app`)

### Verify Deployment
- [ ] Visit Vercel URL in browser
- [ ] Login page loads
- [ ] No console errors
- [ ] Can login with admin email
- [ ] Dashboard displays

✅ **Frontend deployed!**

---

## 🔗 Step 6: Post-Deployment Setup — 5 minutes

### Update Frontend URL in Backend
- [ ] Go to Railway dashboard
- [ ] Project → Variables
- [ ] Update FRONTEND_URL = (Vercel URL from Step 5)
- [ ] Click Redeploy

### Test Production System
- [ ] Visit frontend URL
- [ ] Login with admin email
- [ ] Create test product
- [ ] Create test invoice
- [ ] Verify tax calculations
- [ ] Download PDF
- [ ] Check stock report

### Configure Monitoring (Optional)
- [ ] Railway: Enable email alerts
- [ ] Vercel: Enable email alerts
- [ ] Check logs regularly first week

✅ **Production system live!**

---

## ✅ Verification Checklist (After Deployment)

### Backend Tests
- [ ] Health check returns 200
- [ ] Can create products (POST /api/erp/products)
- [ ] Can create invoices (POST /api/erp/invoices)
- [ ] Tax calculations correct
- [ ] Stock movements tracked
- [ ] PDF generation works

### Frontend Tests
- [ ] Login page loads
- [ ] Can login with admin email
- [ ] Dashboard shows KPI cards
- [ ] Can navigate to all pages
- [ ] Create product works
- [ ] Create invoice works (3-step wizard)
- [ ] Download PDF works
- [ ] Stock reports load
- [ ] GST summary loads

### Database Tests
- [ ] Data persists after refresh
- [ ] Queries are fast (<100ms)
- [ ] No RLS policy errors
- [ ] Stock movements recorded

### Integration Tests
- [ ] Frontend talks to backend
- [ ] Backend queries database
- [ ] Tax calculations accurate
- [ ] Real-time updates work

---

## 🚨 Troubleshooting

### If Backend Won't Deploy
1. Check Railway logs for build errors
2. Verify SUPABASE_URL and SERVICE_KEY
3. Ensure package.json exists in backend/
4. Check if node_modules needs clean install

### If Frontend Won't Deploy
1. Check Vercel build logs
2. Verify root directory is `frontend`
3. Check env vars are set
4. Verify npm run build works locally

### If Can't Login
1. Verify admin user was created
2. Check backend logs for auth errors
3. Verify email format matches
4. Check CORS configuration

### If API Calls Fail
1. Verify VITE_API_URL is correct
2. Check browser Network tab
3. Review backend logs
4. Check database connection

---

## 📊 Deployment Summary

| Phase | Time | Status |
|-------|------|--------|
| 1. Database (Supabase) | 5 min | ✅ |
| 2. Admin User | 2 min | ✅ |
| 3. Local Testing | 10 min | ✅ |
| 4. Backend (Railway) | 10 min | ✅ |
| 5. Frontend (Vercel) | 10 min | ✅ |
| 6. Post-Deploy Setup | 5 min | ✅ |
| **TOTAL** | **42 min** | **✅ LIVE** |

---

## 🎯 Success Criteria

✅ All boxes above checked  
✅ Backend API responding  
✅ Frontend displaying correctly  
✅ Can login and use system  
✅ Data persists in database  
✅ All features working  

---

## 📞 Support

- Check DEPLOYMENT.md for detailed instructions
- Review logs in Railway/Vercel dashboards
- Verify all environment variables
- Ensure Supabase migration applied

---

## 🎉 You're Live!

**Frontend:** https://[your-vercel-url].vercel.app  
**Backend:** https://[your-railway-url].railway.app  
**Database:** Supabase (internal)  

**Congratulations! 🚀**

Now you have a production-grade ERP + WhatsApp warehouse management system!
