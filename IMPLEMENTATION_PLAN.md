# Step-by-Step Implementation Plan to Deploy Your Project LIVE (FREE)

## Prerequisites

- GitHub Account (you already have this)
- Gmail account (for sending OTPs/emails)

---

## STEP 1: Get Free MySQL Database (5 minutes)

### 1.1 Go to db4free.net

- Open browser and visit: https://db4free.net
- Click "Sign Up" or "Create Account"

### 1.2 Create Account

- Username: Choose any (e.g., `deepfakeuser`)
- Email: Use a valid email
- Password: Create a strong password

### 1.3 Note Down These Details (IMPORTANT)

After creating account, note these:

- Host: `db4free.net`
- Username: (the one you chose)
- Password: (the one you set)
- Database Name: `deepfake_detection`

### 1.4 Create Database

1. Login to db4free.net
2. Go to "Databases" section
3. Create database named: `deepfake_detection`

---

## STEP 2: Deploy Backend on Render (10 minutes)

### 2.1 Go to Render.com

- Open: https://render.com
- Click "Sign Up" → "GitHub" (login with your GitHub)

### 2.2 Create Backend Service

1. Click "New +" → "Web Service"
2. Connect GitHub: Select your repo `st5359286/Deepfake-Detection`
3. Configure:
   - **Name**: `deepfake-backend`
   - **Root Directory**: `Backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

### 2.3 Add Environment Variables

Scroll down to "Environment Variables" and add:

| Key           | Value                                    |
| ------------- | ---------------------------------------- |
| `DB_HOST`     | `db4free.net`                            |
| `DB_USER`     | (your db4free username)                  |
| `DB_PASSWORD` | (your db4free password)                  |
| `DB_NAME`     | `deepfake_detection`                     |
| `EMAIL_USER`  | (your Gmail email)                       |
| `EMAIL_PASS`  | (your Gmail App Password - see Step 2.4) |
| `JWT_SECRET`  | `your-super-secret-key-12345`            |
| `PORT`        | `3000`                                   |

### 2.4 Get Gmail App Password (For Email)

1. Go to your Google Account → Security
2. Enable "2-Step Verification"
3. Go to: https://myaccount.google.com/apppasswords
4. Create App Password for "Mail"
5. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)
6. Use this as `EMAIL_PASS`

### 2.5 Deploy

- Click "Create Web Service"
- Wait 2-3 minutes for deployment
- **Note your backend URL** (e.g., `https://deepfake-backend.onrender.com`)

---

## STEP 3: Deploy Frontend on Vercel (5 minutes)

### 3.1 Go to Vercel.com

- Open: https://vercel.com
- Click "Sign Up" → "GitHub"

### 3.2 Import Project

1. Click "Add New..." → "Project"
2. Find and select: `st5359286/Deepfake-Detection`
3. Click "Import"

### 3.3 Configure

- **Framework Preset**: `Vite`
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 3.4 Add Environment Variable

Expand "Environment Variables" and add:

- Name: `VITE_API_URL`
- Value: Your Render backend URL (e.g., `https://deepfake-backend.onrender.com`)

### 3.5 Deploy

- Click "Deploy"
- Wait 1-2 minutes
- **Note your frontend URL** (e.g., `https://deepfake-detection.vercel.app`)

---

## STEP 4: Connect Backend to Frontend (2 minutes)

### 4.1 Update Render Environment

1. Go to Render dashboard → Your backend service
2. Click "Environment"
3. Add/Update:
   - `FRONTEND_URL`: Your Vercel URL (e.g., `https://deepfake-detection.vercel.app`)
4. Click "Save Changes"
5. Redeploy (click "Manual Deploy" → "Deploy latest commit")

### 4.2 Test Your Live App!

- Open your Vercel frontend URL
- Try registering a new account
- Check your email for OTP
- Login and test deepfake detection

---

## Quick Reference Card

| Service  | URL                                     | Purpose         |
| -------- | --------------------------------------- | --------------- |
| GitHub   | github.com/st5359286/Deepfake-Detection | Code Storage    |
| Database | db4free.net                             | Free MySQL      |
| Backend  | render.com                              | Node.js Server  |
| Frontend | vercel.app                              | Website Hosting |

---

## Troubleshooting

### Problem: "Database connection error"

- Check DB credentials in Render
- Make sure database exists in db4free.net
- Wait 2-3 minutes after creating db4free database

### Problem: "Email not sent"

- Make sure Gmail App Password is correct
- Check that 2-Step Verification is enabled on Google

### Problem: "CORS error"

- Make sure `FRONTEND_URL` is set correctly in Render

### Problem: "Page not found"

- Ensure frontend root directory is set to `frontend`
- Check vercel.json is correct

---

## Your Live URLs (After Deployment)

- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.onrender.com`

Replace the above with your actual URLs from Vercel and Render!
