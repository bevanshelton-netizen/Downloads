# THE CHANCELLOR™ Setup Guide

A beginner-friendly guide to get THE CHANCELLOR™ application running on your computer.

## Prerequisites

Before you start, make sure you have:

1. **Node.js** installed (version 18 or higher)
   - Download from: https://nodejs.org
   - To check if installed: Open terminal and type `node --version`

2. **Git** installed
   - Download from: https://git-scm.com
   - To check if installed: Open terminal and type `git --version`

3. **A code editor** (recommended: VS Code)
   - Download from: https://code.visualstudio.com

4. **An OpenAI API key**
   - Sign up at: https://platform.openai.com
   - Get your API key from: https://platform.openai.com/api-keys

5. **A Supabase account** (for database and authentication)
   - Sign up at: https://supabase.com
   - Create a new project

## Step-by-Step Installation

### Step 1: Clone or Download the Repository

**Option A: Using Git (Recommended)**
```bash
git clone https://github.com/bevanshelton-netizen/downloads.git
cd downloads
```

**Option B: Download as ZIP**
- Click the green "Code" button on GitHub
- Select "Download ZIP"
- Extract the ZIP file
- Open terminal in the extracted folder

### Step 2: Install Dependencies

In your terminal, run:
```bash
npm install
```

This downloads all the libraries the project needs. It may take 2-5 minutes.

### Step 3: Set Up Supabase Database

1. **Create a Supabase Account**
   - Go to https://supabase.com
   - Sign up for a free account
   - Create a new project

2. **Get Your Credentials**
   - Go to your project settings
   - Find your **Project URL** (looks like `https://your-project.supabase.co`)
   - Find your **Anon Public Key** (in the API section)
   - Keep these safe - you'll need them in Step 4

3. **Enable Authentication**
   - In Supabase, go to **Authentication** → **Providers**
   - Make sure "Email" provider is enabled

4. **Create the Database Schema**
   - In Supabase, go to the **SQL Editor**
   - Click "New Query"
   - Copy the entire contents from `supabase/schema.sql`
   - Paste it into the SQL editor
   - Click "Run"
   - Wait for it to complete successfully

5. **Seed the Database with 50 Laws**
   - Create another new query
   - Copy the entire contents from `supabase/seed.sql`
   - Paste it into the SQL editor
   - Click "Run"
   - You should see "50 rows inserted" confirmation

### Step 4: Set Up Environment Variables

1. In the project root folder, create a new file called `.env.local`
2. Copy the contents from `.env.local.example`:
   ```
   OPENAI_API_KEY=sk_test_your_openai_api_key_here
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   NEXT_PUBLIC_APP_NAME=THE CHANCELLOR™
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Replace the placeholder values:**
   - Replace `sk_test_your_openai_api_key_here` with your actual OpenAI API key
   - Replace `https://your-project.supabase.co` with your actual Supabase URL
   - Replace `your_supabase_anon_key_here` with your actual Supabase Anon Key

**Important:** Never commit `.env.local` to GitHub. It's already in `.gitignore`.

### Step 5: Run the Development Server

In your terminal, run:
```bash
npm run dev
```

You should see:
```
> next dev
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
```

Open your browser and visit: **http://localhost:3000**

You should see THE CHANCELLOR™ home page!

## Testing Authentication

### Create an Account

1. Click "Sign Up" in the top navigation
2. Fill in your details:
   - Full Name: Your name
   - Email: Your email
   - Password: A secure password (6+ characters)
3. Click "Sign Up"
4. You'll be redirected to login

### Sign In

1. Click "Login" in the top navigation
2. Enter your email and password
3. Click "Sign In"
4. You'll be redirected to your **Dashboard**

### Dashboard Features

Once logged in, you can:
- View your subscription status
- Access "Ask The Chancellor" chat
- View recent conversations
- Access the 12 Domains and 50 Laws
- Edit your profile and change your password
- Sign out

### Test the Chat Feature

1. From the dashboard, click "Start Conversation" or go to /ask
2. Type a question in the input field
3. Click "Send Message" or press Enter
4. Wait for THE CHANCELLOR™ to respond
5. Messages are automatically saved to your chat history

## Supabase Database Overview

Your database now has these tables:

### users
- Stores user profiles and subscription information
- Linked to Supabase Auth
- Only users can see their own data

### chat_messages
- Stores conversation history
- Each message is linked to a user
- Private - users can only see their own messages
- Automatically saved when authenticated

### laws
- Contains all 50 Laws of Life
- Public - everyone can read them
- Already seeded with all laws

### products
- Stores Chancellor Collection items
- Public - everyone can read them
- Pre-seeded with sample products

### subscriptions
- Stores user subscription details
- Links to payment and tier information
- Private - users can only see their own

## Database Security

Your database is protected by **Row Level Security (RLS)**:

- Users can only read/write their own data
- Chat messages are private to each user
- Laws and products are publicly readable
- Subscriptions are private to each user

The frontend uses only the **Anon Public Key** - never expose the Service Role Key.

## Common Commands

### Start Development Server
```bash
npm run dev
```
Runs the app at http://localhost:3000 with hot reload (changes appear instantly).

### Build for Production
```bash
npm run build
```
Creates an optimized production build. Run this before deploying.

### Start Production Server
```bash
npm run start
```
Runs the production build (must run `npm run build` first).

### Run Linter
```bash
npm run lint
```
Checks code for errors and style issues.

## Project Structure

```
downloads/
├── app/
│   ├── layout.tsx           # Main layout with navbar and footer
│   ├── page.tsx             # Home page
│   ├── api/
│   │   └── chat/
│   │       └── route.ts     # Chat API endpoint
│   └── (pages)/
│       ├── auth/
│       │   ├── signup/      # Sign up page
│       │   ├── login/       # Login page
│       │   └── reset-password/  # Password reset page
│       ├── ask/             # Ask The Chancellor page
│       ├── domains/         # 12 Domains page
│       ├── laws/            # 50 Laws of Life page
│       ├── collection/      # Chancellor Collection page
│       ├── about/           # About page
│       ├── subscribe/       # Subscribe page
│       └── dashboard/       # Protected dashboard
│           └── profile/     # User profile page
├── components/
│   ├── auth/                # Auth components (ProtectedRoute)
│   ├── layout/              # Layout components (Navbar, Footer)
│   ├── sections/            # Section components (Hero, etc)
│   └── ui/                  # Reusable UI components (Button, Card, etc)
├── lib/
│   ├── supabase.ts          # Supabase client setup
│   ├── supabase-service.ts  # Supabase helper functions
│   ├── database.types.ts    # TypeScript database types
│   └── auth.ts              # Authentication functions
├── styles/
│   └── globals.css          # Global styles
├── supabase/
│   ├── schema.sql           # Database schema
│   └── seed.sql             # Seed data (50 Laws + products)
├── public/                  # Static images and assets
├── .env.local.example       # Environment variables template
├── SETUP_GUIDE.md           # This file
└── package.json             # Project dependencies
```

## User Authentication Flow

1. **Sign Up** (unauthenticated)
   - User enters email, password, and name
   - Account created in Supabase Auth
   - User profile created in database
   - User redirected to login

2. **Login** (unauthenticated)
   - User enters email and password
   - Supabase validates credentials
   - User session created
   - User redirected to dashboard

3. **Dashboard** (authenticated)
   - Protected route - requires valid session
   - Displays user profile, subscription, recent chats
   - Shows quick links to features

4. **Ask The Chancellor** (authenticated)
   - Messages automatically saved to database
   - Chat history persists
   - Users can view previous conversations

5. **Profile** (authenticated)
   - Users can update password
   - View account information
   - Sign out

## Troubleshooting

### "npm: command not found"
- Node.js is not installed. Download and install from https://nodejs.org

### "Port 3000 already in use"
- Another application is using port 3000
- Either close that application or run on a different port:
  ```bash
  npm run dev -- -p 3001
  ```

### Authentication not working
- Make sure Supabase Email provider is enabled
- Check that your Supabase URL and Anon Key are correct in `.env.local`
- Check browser console (F12) for error messages

### Chat not working / "Failed to fetch response"
- Make sure your OpenAI API key is correct in `.env.local`
- Check that you have an active OpenAI account with available credits
- Check browser console (F12) for detailed error messages

### Supabase errors
- Make sure your Supabase URL and Anon Key are correct in `.env.local`
- Make sure you've run both schema.sql and seed.sql in Supabase
- Make sure Email authentication is enabled
- Check Supabase logs in the dashboard for details

### "ProtectedRoute" errors
- Make sure you're logged in to access protected pages
- Try clearing your browser cache and cookies
- Refresh the page

### Styles not loading / page looks broken
- Try deleting `.next` folder and restarting:
  ```bash
  rm -rf .next
  npm run dev
  ```

### "Module not found" errors
- Run `npm install` again
- Delete `node_modules` folder and `package-lock.json`, then run `npm install`

## Deployment

When ready to deploy:

1. Build the project:
   ```bash
   npm run build
   ```

2. Test the production build:
   ```bash
   npm run start
   ```

3. Deploy to hosting (Vercel recommended):
   - Create account at https://vercel.com
   - Connect your GitHub repository
   - Add your environment variables to Vercel project settings:
     - `OPENAI_API_KEY`
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_APP_URL` (set to your production domain)
   - Deploy with one click

## Need Help?

- Check GitHub Issues: https://github.com/bevanshelton-netizen/downloads/issues
- Open an Issue for bugs or feature requests
- Review Next.js docs: https://nextjs.org/docs
- Review Supabase docs: https://supabase.com/docs
- Supabase Auth docs: https://supabase.com/docs/guides/auth
- OpenAI API docs: https://platform.openai.com/docs

## Technology Stack

- **Frontend:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS
- **AI:** OpenAI API (GPT-4 Turbo)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Deployment:** Vercel (recommended)

---

**Walk in wisdom. Build with purpose. Leave a legacy.**
