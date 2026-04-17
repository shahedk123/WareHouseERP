# WarehouseOS — Quick Deployment Guide (5 Easy Steps)

**Total Time:** 40 minutes from zero to live production system  
**Complexity:** Easy (click buttons, paste environment variables)

---

## ⚡ Prerequisites (5 minutes)

1. **GitHub Account** — https://github.com
2. **Supabase Account** — https://supabase.com
3. **Railway Account** — https://railway.app (free)
4. **Vercel Account** — https://vercel.com (free)
5. **This Repository** — Already have it locally

---

## 🚀 Step 1: Database Migration (5 minutes)

### 1.1 Go to Supabase Dashboard
```
https://app.supabase.com/projects
```

### 1.2 Open Your Project
- Click on project: `njjrldbhcrbuazvmupaz`
- Or create new if doesn't exist

### 1.3 Run Migration
1. Click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy **entire contents** of:
   ```
   supabase/migrations/003_warehouseos_schema.sql
   ```
4. Paste into SQL editor
5. Click **Run** button
6. Wait for success message

### 1.4 Verify
- Go to **Tables** tab
- Should see 14 tables (users, products, invoices, stock_movements, etc.)

✅ **Database ready!**

---

## 👤 Step 2: Create Admin User (2 minutes)

```bash
cd backend
node scripts/create-admin.js "Your Name" your@email.com
```

**Output:**
```
✅ Admin user created:
   ID: <copy-this-uuid>
   Name: Your Name
   Email: your@email.com
   Role: admin
```

**Save the UUID** — you'll use it for testing.

---

## 🧪 Step 3: Test Backend Locally (10 minutes)

### 3.1 Start Backend
```bash
cd backend
npm run dev
```

Expected output:
```
✅ Server running on port 3001
✅ Cron jobs started
```

### 3.2 Run 1 Quick Test (in another terminal)
```bash
curl http://localhost:3001/health
```

Should return:
```json
{"status":"ok","service":"WarehouseOS API"}
```

✅ **Backend works locally!**

---

## 📤 Step 4: Deploy to Railway (10 minutes)

### 4.1 Create Railway Project
1. Go to https://railway.app/dashboard
2. Click **New Project**
3. Click **Deploy from GitHub**
4. Select your `warehousevoice` repository
5. Railway auto-detects Node.js

### 4.2 Add Environment Variables
1. Click **Project** → **Variables**
2. Add these environment variables:

```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://njjrldbhcrbuazvmupaz.supabase.co
SUPABASE_SERVICE_KEY=<your-service-key>
WHATSAPP_TOKEN=<your-token-or-placeholder>
WHATSAPP_PHONE_ID=<your-phone-id-or-placeholder>
FRONTEND_URL=https://<your-vercel-url>.vercel.app
```

### 4.3 Deploy
1. Click **Deploy** button
2. Wait for deployment to complete (2-3 minutes)
3. Copy public URL from Railway (e.g., `https://warehouseos-prod.railway.app`)

### 4.4 Verify Backend
```bash
curl https://warehouseos-prod.railway.app/health
```

Should return success.

✅ **Backend deployed!**

---

## 🎨 Step 5: Deploy to Vercel (10 minutes)

### 5.1 Create Vercel Project
1. Go to https://vercel.com/dashboard
2. Click **Add New** → **Project**
3. Click **Import Git Repository**
4. Select `warehousevoice` repo
5. Click **Import**

### 5.2 Configure Settings
1. **Root Directory:** Select `frontend` (important!)
2. **Build Command:** `npm run build`
3. **Output Directory:** `dist`

### 5.3 Add Environment Variables
Click **Environment Variables** and add:

```
VITE_API_URL=https://warehouseos-prod.railway.app
VITE_SUPABASE_URL=https://njjrldbhcrbuazvmupaz.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 5.4 Deploy
1. Click **Deploy** button
2. Wait for deployment to complete (3-5 minutes)
3. Copy Vercel URL (e.g., `https://warehouseos-frontend.vercel.app`)

✅ **Frontend deployed!**

---

## 🎉 Your System is Live!

### Access Your Application
```
Frontend (UI):  https://your-vercel-url.vercel.app
Backend (API):  https://your-railway-url.railway.app
```

### Login
1. Go to `https://your-vercel-url.vercel.app`
2. Email: `your@email.com` (admin email from Step 2)
3. Click Sign In
4. See dashboard with KPI cards

### Test It
1. **Dashboard** — View KPI cards
2. **Create Product** — `/products` → Add Product
3. **Create Invoice** — `/invoices/create` → 3-step wizard
4. **View Reports** — `/reports/stock` → Stock summary

---

## 🔧 Troubleshooting

### Backend won't start?
```bash
# Check logs in Railway dashboard
# Verify all env vars are set correctly
# Ensure SUPABASE_URL and SERVICE_KEY are correct
```

### Frontend shows blank page?
```
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for API calls
4. Verify VITE_API_URL in Vercel environment
```

### Can't login?
```
1. Verify user was created: node scripts/create-admin.js
2. Check backend logs for auth errors
3. Verify email matches exactly
```

---

## 📝 Environment Variables Reference

### Backend (.env in Railway)
| Variable | Example | Where to Get |
|----------|---------|--------------|
| SUPABASE_URL | https://njjrldbhcrbuazvmupaz.supabase.co | Supabase dashboard → Settings |
| SUPABASE_SERVICE_KEY | eyJhbGc... | Supabase → Settings → API Keys → Service Key |
| WHATSAPP_TOKEN | EAAxx... | Meta Business dashboard (optional for now) |
| WHATSAPP_PHONE_ID | 123456 | Meta Business dashboard (optional for now) |
| FRONTEND_URL | https://app.vercel.app | Your Vercel URL |

### Frontend (.env.local in Vercel)
| Variable | Example | Where to Get |
|----------|---------|--------------|
| VITE_API_URL | https://api.railway.app | Your Railway URL |
| VITE_SUPABASE_URL | https://njjrldbhcrbuazvmupaz.supabase.co | Supabase dashboard |
| VITE_SUPABASE_ANON_KEY | eyJhbGc... | Supabase → Settings → API Keys → Anon Key |

---

## 🚨 Important Notes

1. **GitHub Push Required**
   - Railway and Vercel watch your GitHub repo
   - When you push code → auto-deploys
   - No manual deployment needed after first setup

2. **Environment Variables**
   - Always use Railway/Vercel dashboards for secrets
   - Never commit `.env` to GitHub
   - Use `.env.example` as template

3. **Custom Domain (Optional)**
   - Railway: Settings → Custom Domain
   - Vercel: Settings → Domains
   - Point DNS to provided values

---

## ✅ Deployment Checklist

- [ ] Step 1: Database migration applied
- [ ] Step 2: Admin user created
- [ ] Step 3: Backend tested locally
- [ ] Step 4: Backend deployed to Railway
- [ ] Step 5: Frontend deployed to Vercel
- [ ] Can login to frontend
- [ ] Can create products
- [ ] Can create invoices
- [ ] System is live!

---

## 🎓 Next Steps After Deployment

1. **Monitor Logs**
   - Railway: Dashboard → Deployments → Logs
   - Vercel: Dashboard → Deployments → Logs

2. **Add More Users** (optional)
   ```bash
   node scripts/register.js +919876543210 "Raju Picker" picker
   node scripts/register.js +919876543211 "Priya Accountant" accountant
   ```

3. **Configure WhatsApp** (optional)
   - Update WHATSAPP_TOKEN and WHATSAPP_PHONE_ID
   - Get from Meta Business dashboard
   - Redeploy to Railway

4. **Scale if Needed**
   - Increase Railway resources
   - Upgrade Supabase plan
   - Add custom domain

---

## 📞 Support

If stuck:
1. Check DEPLOYMENT.md for detailed instructions
2. Review logs in Railway/Vercel dashboards
3. Verify environment variables are set
4. Ensure Supabase migration was applied

---

**⏱️ Total Time: 40 minutes → Live production system!**

🚀 **You're ready to deploy!**
