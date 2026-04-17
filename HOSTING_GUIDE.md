# WarehouseOS — Hosting & Deployment Services Guide

**Updated:** April 6, 2026  
**Total Cost (Free Tier):** $0/month  
**Scale Support:** Single database to millions of records  

---

## 🏗️ Architecture Overview

```
┌─────────────────────┐
│   Frontend (React)  │
│    Vercel (Free)    │────┐
│  5 deployments/day  │    │
└─────────────────────┘    │
                           │
                        HTTPS
                           │
                           ▼
┌─────────────────────┐
│  Backend (Node.js)  │
│   Railway (Free)    │
│  500 MB storage     │
└─────────────────────┘
         │
         │
         ▼
┌─────────────────────┐
│  Database & Auth    │
│ Supabase (Free)     │
│ 500 MB storage      │
│ 2 concurrent conn   │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ File Storage (CDN)  │
│ Supabase Storage    │
│ 1 GB free tier      │
└─────────────────────┘
```

---

## 📌 Hosting Services Selected

### Frontend: Vercel
**Why Vercel?**
- ✅ Free tier: unlimited deployments
- ✅ Auto-deploys from GitHub
- ✅ Global CDN (300+ edge locations)
- ✅ Automatic SSL/HTTPS
- ✅ Preview URLs for PRs
- ✅ Environment variables support
- ✅ Supports Vite (our build tool)

**Features:**
- Automatic git integration
- Preview deployments
- Analytics dashboard
- Real-time logs
- Integrated with Next.js (we use Vite, still works)

**Free Tier Limits:**
- 6000 build minutes/month
- Unlimited deployments
- Unlimited bandwidth
- 1 GB serverless function storage

**Cost to Scale:**
- Free: $0
- Pro: $20/month (advanced features)
- Enterprise: Custom pricing

### Backend: Railway
**Why Railway?**
- ✅ Free tier: $5 credit/month
- ✅ Auto-deploys from GitHub
- ✅ Full Node.js support
- ✅ Environment variables
- ✅ Custom domains
- ✅ Automatic HTTPS
- ✅ Real-time logs
- ✅ Better UX than Heroku

**Features:**
- Docker or Nixpacks support
- Database support (PostgreSQL, MySQL, Redis)
- Pay-as-you-go pricing
- Automatic scaling
- Team collaboration

**Free Tier Details:**
- $5 credit/month
- ~500MB storage
- ~512MB RAM
- Enough for 100-1000 active users

**Cost to Scale:**
- Free: $5 credit
- Pay-as-you-go: $0.50/vCPU/hour
- ~$10-50/month for small app

### Database: Supabase
**Why Supabase?**
- ✅ PostgreSQL (not proprietary)
- ✅ Free tier: 500MB storage
- ✅ Auto-backups
- ✅ SSL encryption
- ✅ RLS policies (security)
- ✅ Realtime subscriptions
- ✅ Built-in auth
- ✅ File storage (CDN)

**Features:**
- PostgreSQL 14+
- Row Level Security (RLS)
- Realtime capabilities
- GraphQL + REST API
- Storage bucket (CDN)
- Vector embeddings (AI-ready)

**Free Tier Details:**
- 500MB database storage
- 1GB file storage
- 2 concurrent connections
- Enough for 10k-100k records
- No auto-scaling (manual upgrades)

**Cost to Scale:**
- Free: $0
- Pro: $25/month (10GB storage)
- Team: $599/month (unlimited)
- Enterprise: Custom

---

## 🚀 Deployment Steps

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Initial WarehouseOS deployment"
git push origin main
```

### 2. Deploy Backend (Railway)

**Option A: Connect GitHub (Recommended)**
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select warehousevoice repo
4. Auto-detects Node.js
5. Add env vars (see below)
6. Click Deploy

**Option B: Railway CLI**
```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

**Environment Variables (Railway):**
```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://njjrldbhcrbuazvmupaz.supabase.co
SUPABASE_SERVICE_KEY=<service-key>
WHATSAPP_TOKEN=<token-or-skip>
WHATSAPP_PHONE_ID=<phone-id-or-skip>
FRONTEND_URL=https://<vercel-url>.vercel.app
```

**After Deploy:**
- Get public URL from Railway
- Update FRONTEND_URL in env vars
- Railway auto-redeploys

### 3. Deploy Frontend (Vercel)

**Only Option: Connect GitHub**
1. Go to https://vercel.com
2. New Project → Import Git Repo
3. Select warehousevoice repo
4. Set Root Directory: `frontend`
5. Add env vars (see below)
6. Click Deploy

**Environment Variables (Vercel):**
```
VITE_API_URL=https://<railway-url>.railway.app
VITE_SUPABASE_URL=https://njjrldbhcrbuazvmupaz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

**After Deploy:**
- Get public URL from Vercel
- Update FRONTEND_URL in Railway env vars
- Both auto-sync

### 4. Configure Database (Supabase)

**No additional setup needed!**
- Migration already applied
- Seed data already loaded
- Tables ready to use

**Optional: Backups**
- Supabase auto-backs up daily
- Free tier keeps 7-day backup
- Pro tier keeps 30-day backup

---

## 🔄 Auto-Deployment Flow

```
Developer pushes to GitHub
         ↓
GitHub webhook → Railway
GitHub webhook → Vercel
         ↓
Railway builds backend
Vercel builds frontend
         ↓
Tests run (if configured)
         ↓
Auto-deploy if tests pass
         ↓
Production updated
URL unchanged
         ↓
Realtime monitoring starts
```

---

## 📊 Cost Analysis

### Monthly Cost Breakdown (Typical Usage)

| Service | Free Tier | Cost | Notes |
|---------|-----------|------|-------|
| **Vercel Frontend** | ✅ Included | $0 | Unlimited deployments |
| **Railway Backend** | $5 credit | $10-20 | Pay-as-you-go |
| **Supabase DB** | 500MB | $0-25 | Upgrade if >500MB |
| **File Storage** | 1GB | $0-5 | If using storage |
| **Domain (Optional)** | — | $0-15 | If custom domain |
| **TOTAL (Free Tier)** | | **$0** | If usage low |
| **TOTAL (Scaled)** | | **$35-50** | For 1000+ users |

### Scaling Timeline

| Users | Traffic | Database | Backend | Frontend | Cost |
|-------|---------|----------|---------|----------|------|
| 1-10 | Low | Free | Free | Free | $0 |
| 10-100 | Medium | Free | Free | Free | $0-10 |
| 100-1000 | High | $25 | $20 | Free | $45 |
| 1000+ | Very High | $100+ | $50+ | Free | $150+ |

---

## 🔐 Deployment Security

### Supabase Security
- ✅ Automatic HTTPS/SSL
- ✅ Role Level Security (RLS) policies
- ✅ Service key (server-only)
- ✅ Anon key (frontend-safe)
- ✅ Row-level access control
- ✅ Automatic backups
- ✅ 2-factor auth (optional)

### Railway Security
- ✅ Automatic HTTPS/SSL
- ✅ Environment variables encrypted
- ✅ Git integration with OAuth
- ✅ Private deployments
- ✅ VPC support (Pro tier)
- ✅ Automatic disaster recovery

### Vercel Security
- ✅ Automatic HTTPS/SSL
- ✅ Environment variables encrypted
- ✅ Preview deployments isolated
- ✅ Git integration with OAuth
- ✅ DDoS protection
- ✅ Web Application Firewall

---

## 📈 Monitoring & Logs

### Railway Logs
1. Go to https://railway.app/dashboard
2. Project → Deployments
3. Click latest deployment
4. View real-time logs
5. Search for errors

### Vercel Logs
1. Go to https://vercel.com/dashboard
2. Project → Deployments
3. Click latest deployment
4. View build logs
5. View runtime logs

### Supabase Monitoring
1. Go to https://app.supabase.com
2. Project → Monitoring
3. View database stats
4. Check connection count
5. Monitor storage usage

---

## 🛠️ Maintenance Tasks

### Weekly
- [ ] Check logs for errors
- [ ] Monitor database size
- [ ] Review deployment history

### Monthly
- [ ] Update dependencies
- [ ] Review cost breakdown
- [ ] Check security updates

### Quarterly
- [ ] Test disaster recovery
- [ ] Review scaling needs
- [ ] Plan infrastructure upgrades

---

## 🚨 Troubleshooting

### Backend Won't Start
**Check:**
1. Railway logs for errors
2. Environment variables set
3. Supabase connection working
4. Port 3001 accessible

**Fix:**
1. Redeploy
2. Check env vars
3. Restart Railway project

### Frontend Blank Page
**Check:**
1. Vercel build logs
2. Browser console errors
3. Network tab (API calls)
4. Environment variables

**Fix:**
1. Check VITE_API_URL
2. Verify backend is running
3. Clear browser cache
4. Redeploy frontend

### Database Connection Failed
**Check:**
1. SUPABASE_URL correct
2. SERVICE_KEY correct
3. Database tables exist
4. RLS policies allow access

**Fix:**
1. Verify credentials
2. Check Supabase dashboard
3. Test SQL query manually
4. Check RLS policies

---

## 💡 Pro Tips

### Faster Deployments
1. Use Railway → faster build (30-60s)
2. Use Vercel → fastest frontend (20-40s)
3. Both support caching
4. GitHub Actions can pre-test

### Cost Optimization
1. Free tier covers 100-1000 users
2. Upgrade gradually as you scale
3. Use Supabase Pro at 500MB data
4. Use Railway Pro at high CPU

### Performance Optimization
1. Vercel CDN is global (300+ edge locations)
2. Railway in nearest region
3. Database in same region
4. Enable caching on static assets

### Disaster Recovery
1. GitHub as backup
2. Supabase auto-backups
3. Export database monthly
4. Test restore procedure

---

## 📚 Additional Resources

### Vercel
- Docs: https://vercel.com/docs
- Dashboard: https://vercel.com/dashboard
- CLI: https://vercel.com/download

### Railway
- Docs: https://docs.railway.app
- Dashboard: https://railway.app/dashboard
- Template: https://railway.app/templates

### Supabase
- Docs: https://supabase.com/docs
- Dashboard: https://app.supabase.com
- CLI: https://supabase.com/docs/guides/cli

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Vercel project created
- [ ] Supabase migration applied
- [ ] Backend environment variables set
- [ ] Frontend environment variables set
- [ ] Backend deployed & running
- [ ] Frontend deployed & loading
- [ ] Can login to system
- [ ] Data persists
- [ ] Logs monitored
- [ ] Ready for production

---

**Total Cost: $0-50/month depending on scale**  
**Deployment Time: 40 minutes**  
**Uptime: 99%+ (multiple redundancies)**  

🚀 **Ready to deploy!**
