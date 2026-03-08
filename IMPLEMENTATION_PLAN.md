# Deepfake Detection - Deployment Guide (FREE)

## ✅ What's Changed - SQLite Integration

Your project now uses **SQLite** instead of MySQL - no external database needed!

---

## Step 1: Push Code to GitHub

If not already done:

```bash
git add .
git commit -m "Updated to use SQLite"
git push origin main
```

---

## Step 2: Deploy Backend on Render.com (FREE)

### 1. Go to https://render.com

- Click "Sign Up" → Use your GitHub account

### 2. Create New Web Service

- Click "New" → "Web Service"
- Connect your GitHub repository
- Select the repository with your Deepfake Detection project

### 3. Configure Settings:

| Setting        | Value              |
| -------------- | ------------------ |
| Name           | `deepfake-backend` |
| Root Directory | `Backend`          |
| Build Command  | `npm install`      |
| Start Command  | `node server.js`   |

### 4. Add Environment Variables:

Click "Advanced" → "Add Environment Variable":

| Variable     | Value                                    |
| ------------ | ---------------------------------------- |
| `EMAIL_USER` | your-email@gmail.com                     |
| `EMAIL_PASS` | your-app-password (16-char app password) |
| `JWT_SECRET` | any-random-string-min-32-chars           |
| `PORT`       | 3000                                     |

### 5. Click "Create Web Service"

**Wait 2-3 minutes** for deployment to complete.

**Copy your backend URL** - it will be like:

```
https://deepfake-backend.onrender.com
```

---

## Step 3: Deploy Frontend on Vercel (FREE)

### 1. Go to https://vercel.com

- Click "Sign Up" → Use your GitHub account

### 2. Add New Project

- Click "Add New..." → "Project"
- Select your GitHub repository

### 3. Configure Settings:

| Setting          | Value           |
| ---------------- | --------------- |
| Framework Preset | `Vite`          |
| Root Directory   | `frontend`      |
| Build Command    | `npm run build` |
| Output Directory | `dist`          |

### 4. Add Environment Variable:

Click "Environment Variables":

| Name           | Value                                    |
| -------------- | ---------------------------------------- |
| `VITE_API_URL` | `https://your-backend-name.onrender.com` |

**Replace `your-backend-name` with your actual Render service name!**

### 5. Click "Deploy"

**Wait 1-2 minutes** for deployment.

**Copy your frontend URL** - it will be like:

```
https://your-project.vercel.app
```

---

## Step 4: Test Your Live App!

1. Open your Vercel frontend URL
2. Register a new account
3. Check server console for OTP code (or your email)
4. Verify account
5. Login and test deepfake detection!

---

## Important Notes:

### Email for OTP:

- Check server logs in Render dashboard for OTP codes
- Or configure real email in environment variables

### First Request:

- Backend may take 30-60 seconds to wake up (free tier)
- First request after inactivity is slow, then fast

### Database:

- SQLite file is created automatically on first run
- Data persists as long as your service runs

---

## Troubleshooting:

### "Cannot connect to database"

- Make sure SQLite is in dependencies: `"sqlite3": "^5.1.7"`
- Check Render logs for errors

### CORS errors

- The backend is already configured with CORS
- Make sure VITE_API_URL is correct

### Build fails

- Make sure Root Directory is set to `Backend` for backend
- Make sure Root Directory is set to `frontend` for frontend
