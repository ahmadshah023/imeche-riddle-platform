# 🚀 Vercel Deployment Guide

Complete step-by-step guide to deploy your IMechE Riddle Run competition platform to Vercel.

## Prerequisites

- ✅ Firebase project created and configured
- ✅ Firebase Auth enabled (Email/Password + Google)
- ✅ Firestore Database enabled
- ✅ GitHub account (free)
- ✅ Vercel account (free)

---

## Step 1: Prepare Your Code

### 1.1 Ensure `.env.local` is in `.gitignore`

Your `.gitignore` should already include `.env.local` (never commit secrets!). Verify:

```bash
# In webapp/.gitignore, you should see:
.env*.local
```

### 1.2 Test Build Locally

Before deploying, test that your app builds successfully:

```bash
cd webapp
npm install
npm run build
```

If the build succeeds, you're ready! If there are errors, fix them first.

---

## Step 2: Push to GitHub

### 2.1 Initialize Git (if not already done)

```bash
cd webapp
git init
git add .
git commit -m "Initial commit - Ready for deployment"
```

### 2.2 Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon → **"New repository"**
3. Name it (e.g., `imeche-riddle-platform`)
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README, .gitignore, or license
6. Click **"Create repository"**

### 2.3 Push Your Code

GitHub will show you commands. Run these in your `webapp` folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual values.

---

## Step 3: Deploy to Vercel

### 3.1 Sign Up / Sign In to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** (or **"Log In"** if you have an account)
3. Choose **"Continue with GitHub"** (recommended)

### 3.2 Import Your Project

1. After logging in, click **"Add New..."** → **"Project"**
2. You'll see your GitHub repositories. Find your project and click **"Import"**

### 3.3 Configure Project Settings

Vercel will auto-detect Next.js. Configure:

- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: Leave as `./` (or set to `webapp` if your repo root is one level up)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### 3.4 Add Environment Variables

**CRITICAL STEP**: Add all Firebase environment variables:

1. In the **"Environment Variables"** section, add each variable:

```
NEXT_PUBLIC_FIREBASE_API_KEY = your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID = your_app_id
```

2. Copy values from your Firebase Console:
   - Go to Firebase Console → Project Settings → General
   - Scroll to "Your apps" → Web app → Config object
   - Copy each value exactly

3. **Important**: Make sure to add these for **all environments**:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

### 3.5 Deploy!

1. Click **"Deploy"**
2. Wait 2-3 minutes for the build to complete
3. You'll see a success message with your live URL (e.g., `https://your-project.vercel.app`)

---

## Step 4: Configure Firebase for Production

### 4.1 Add Vercel Domain to Firebase Authorized Domains

1. Go to Firebase Console → Authentication → Settings
2. Scroll to **"Authorized domains"**
3. Click **"Add domain"**
4. Add your Vercel domain: `your-project.vercel.app`
5. Also add your custom domain if you set one up

### 4.2 Update Firestore Security Rules (if needed)

Your Firestore rules should allow your Vercel domain. The rules in `README.md` should work, but verify:

- Rules allow authenticated users
- Admin emails are correctly listed

---

## Step 5: Test Your Live Site

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Test login (email/password and Google)
3. Test admin dashboard (if your email is in `ADMIN_EMAILS`)
4. Create a test competition
5. Test team creation and riddle solving

---

## Step 6: (Optional) Custom Domain

### 6.1 Add Custom Domain in Vercel

1. Go to your project → **Settings** → **Domains**
2. Enter your domain (e.g., `riddle-platform.com`)
3. Follow DNS configuration instructions
4. Vercel will handle SSL automatically

### 6.2 Update Firebase Authorized Domains

Add your custom domain to Firebase Authorized Domains (same as Step 4.1).

---

## Troubleshooting

### Build Fails

**Error**: `Module not found` or `Cannot find module`
- **Fix**: Ensure all dependencies are in `package.json` and run `npm install` locally first

**Error**: `Environment variable not found`
- **Fix**: Double-check all `NEXT_PUBLIC_*` variables are added in Vercel dashboard

### App Works Locally but Not on Vercel

**Issue**: Firebase connection errors
- **Fix**: Verify environment variables are set correctly in Vercel
- **Fix**: Check Firebase Authorized Domains includes your Vercel URL

**Issue**: Auth redirects not working
- **Fix**: Add Vercel domain to Firebase Authorized Domains
- **Fix**: Check Firebase Auth settings → Authorized redirect URIs

### Performance Issues

- Enable Vercel Analytics (optional, in project settings)
- Check Vercel logs: Project → Deployments → Click deployment → View logs

---

## Updating Your Deployment

Every time you push to GitHub:

1. **Automatic**: Vercel will auto-deploy if you connected GitHub
2. **Manual**: Go to Vercel dashboard → Deployments → Redeploy

To update code:
```bash
git add .
git commit -m "Your update message"
git push
```

Vercel will automatically build and deploy!

---

## Environment Variables Reference

Copy these exactly as shown (get values from Firebase Console):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Quick Checklist

- [ ] Code builds locally (`npm run build` succeeds)
- [ ] `.env.local` is in `.gitignore`
- [ ] Code pushed to GitHub
- [ ] Vercel project created and connected to GitHub
- [ ] All 6 Firebase environment variables added in Vercel
- [ ] Vercel domain added to Firebase Authorized Domains
- [ ] Test login works on live site
- [ ] Test admin dashboard works
- [ ] Test competition creation works

---

## Need Help?

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Firebase Docs**: [firebase.google.com/docs](https://firebase.google.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

---

**🎉 Congratulations! Your competition platform is now live!**
