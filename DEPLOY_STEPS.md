# 🚀 Step-by-Step Deployment Guide

Follow these steps **in order**. Check each box as you complete it.

---

## ✅ STEP 1: Verify Your Project is Ready

### 1.1 Check Build Works
- [ ] Open terminal in `webapp` folder
- [ ] Run: `npm run build`
- [ ] See "✓ Compiled successfully" - **DONE!**

**If build fails:** Fix errors first before proceeding.

---

## ✅ STEP 2: Get Your Firebase Credentials

### 2.1 Open Firebase Console
- [ ] Go to: https://console.firebase.google.com
- [ ] Select your project (or create one if needed)

### 2.2 Get Configuration Values
- [ ] Click the **gear icon** ⚙️ → **Project Settings**
- [ ] Scroll down to **"Your apps"** section
- [ ] If you don't have a web app, click **"Add app"** → **Web** (</> icon)
- [ ] Copy these 6 values (you'll need them for Vercel):

```
1. apiKey: "AIza..."
2. authDomain: "your-project.firebaseapp.com"
3. projectId: "your-project-id"
4. storageBucket: "your-project.appspot.com"
5. messagingSenderId: "123456789"
6. appId: "1:123456789:web:abc123"
```

**📝 Write these down or keep Firebase Console open!**

---

## ✅ STEP 3: Set Up GitHub Repository

### 3.1 Create GitHub Account (if needed)
- [ ] Go to: https://github.com
- [ ] Sign up or log in

### 3.2 Create New Repository
- [ ] Click **"+"** icon (top right) → **"New repository"**
- [ ] Repository name: `imeche-riddle-platform` (or your choice)
- [ ] Description: "IMechE Riddle Competition Platform"
- [ ] Choose: **Public** or **Private**
- [ ] **DO NOT** check "Add a README file"
- [ ] **DO NOT** check "Add .gitignore"
- [ ] **DO NOT** check "Choose a license"
- [ ] Click **"Create repository"**

### 3.3 Initialize Git in Your Project
Open PowerShell/Command Prompt in your `webapp` folder and run:

```powershell
cd "C:\Users\hp\OneDrive - Higher Education Commission\Desktop\Imeche 2\webapp"
git init
git add .
git commit -m "Initial commit - Ready for deployment"
```

### 3.4 Connect to GitHub and Push
GitHub will show you commands. Use these (replace YOUR_USERNAME and YOUR_REPO_NAME):

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

**You'll be asked for GitHub username and password (use Personal Access Token if 2FA enabled)**

- [ ] Code successfully pushed to GitHub

---

## ✅ STEP 4: Deploy to Vercel

### 4.1 Sign Up for Vercel
- [ ] Go to: https://vercel.com
- [ ] Click **"Sign Up"**
- [ ] Choose **"Continue with GitHub"** (recommended)
- [ ] Authorize Vercel to access your GitHub

### 4.2 Import Your Project
- [ ] After logging in, click **"Add New..."** → **"Project"**
- [ ] You'll see your GitHub repositories
- [ ] Find `imeche-riddle-platform` (or your repo name)
- [ ] Click **"Import"** button

### 4.3 Configure Project Settings
Vercel auto-detects Next.js. Verify these settings:

- [ ] **Framework Preset**: Next.js ✅
- [ ] **Root Directory**: `./` (leave as is)
- [ ] **Build Command**: `npm run build` ✅
- [ ] **Output Directory**: `.next` ✅
- [ ] **Install Command**: `npm install` ✅

### 4.4 Add Environment Variables ⚠️ CRITICAL STEP

**This is the most important step!**

- [ ] Scroll down to **"Environment Variables"** section
- [ ] Click **"Add"** for each variable below:

**Variable 1:**
- Name: `NEXT_PUBLIC_FIREBASE_API_KEY`
- Value: (paste from Firebase Console - the `apiKey` value)
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **"Add"**

**Variable 2:**
- Name: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- Value: (paste from Firebase Console - the `authDomain` value)
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **"Add"**

**Variable 3:**
- Name: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- Value: (paste from Firebase Console - the `projectId` value)
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **"Add"**

**Variable 4:**
- Name: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- Value: (paste from Firebase Console - the `storageBucket` value)
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **"Add"**

**Variable 5:**
- Name: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- Value: (paste from Firebase Console - the `messagingSenderId` value)
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **"Add"**

**Variable 6:**
- Name: `NEXT_PUBLIC_FIREBASE_APP_ID`
- Value: (paste from Firebase Console - the `appId` value)
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **"Add"**

**✅ Verify:** You should see all 6 variables listed

### 4.5 Deploy!
- [ ] Scroll down and click **"Deploy"** button
- [ ] Wait 2-3 minutes for build to complete
- [ ] You'll see: **"Congratulations! Your project has been deployed"**
- [ ] Copy your live URL (e.g., `https://your-project.vercel.app`)

---

## ✅ STEP 5: Configure Firebase for Production

### 5.1 Add Vercel Domain to Firebase
- [ ] Go back to Firebase Console
- [ ] Click **Authentication** → **Settings** tab
- [ ] Scroll to **"Authorized domains"** section
- [ ] Click **"Add domain"**
- [ ] Enter your Vercel domain: `your-project.vercel.app` (use the actual URL from Step 4.5)
- [ ] Click **"Add"**

### 5.2 Verify Firestore Rules
- [ ] Go to Firebase Console → **Firestore Database** → **Rules** tab
- [ ] Verify rules allow authenticated users (check README.md for example rules)
- [ ] Click **"Publish"** if you made changes

---

## ✅ STEP 6: Test Your Live Site

### 6.1 Test Basic Functionality
- [ ] Visit your Vercel URL: `https://your-project.vercel.app`
- [ ] Page loads without errors ✅
- [ ] Click **"Login"** or **"First time here?"**
- [ ] Test email/password signup ✅
- [ ] Test Google sign-in ✅

### 6.2 Test Admin Dashboard
- [ ] Log in with an admin email (from `AuthProvider.tsx`)
- [ ] Should redirect to `/admin` ✅
- [ ] Admin dashboard loads ✅
- [ ] Create a test competition ✅

### 6.3 Test Player Flow
- [ ] Log in with a non-admin email
- [ ] Should see `/dashboard` with competitions ✅
- [ ] Join a competition with password ✅
- [ ] Create/join a team ✅
- [ ] Test riddle solving ✅

---

## ✅ STEP 7: (Optional) Custom Domain

### 7.1 Add Domain in Vercel
- [ ] Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
- [ ] Enter your domain (e.g., `riddle-platform.com`)
- [ ] Follow DNS configuration instructions
- [ ] Wait for DNS propagation (can take up to 24 hours)

### 7.2 Add Domain to Firebase
- [ ] Add custom domain to Firebase Authorized Domains (same as Step 5.1)

---

## 🎉 You're Done!

Your competition platform is now live! 🚀

### Quick Reference:
- **Live URL**: `https://your-project.vercel.app`
- **Admin Dashboard**: `https://your-project.vercel.app/admin`
- **GitHub Repo**: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`

### Updating Your Site:
Every time you push to GitHub, Vercel automatically deploys:
```powershell
git add .
git commit -m "Your update message"
git push
```

---

## 🆘 Troubleshooting

### Build Fails on Vercel
- Check Vercel logs: Project → Deployments → Click failed deployment → View logs
- Verify all 6 environment variables are set correctly
- Ensure build works locally first (`npm run build`)

### Firebase Connection Errors
- Double-check all environment variables in Vercel match Firebase Console exactly
- Verify Vercel domain is in Firebase Authorized Domains
- Check Firebase Console → Authentication → Settings → Authorized domains

### Auth Not Working
- Verify `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` matches Firebase Console
- Check Firebase Authorized Domains includes your Vercel URL
- Ensure Firebase Auth is enabled in Firebase Console

---

**Need help?** Check the full `DEPLOYMENT.md` file for more details!
