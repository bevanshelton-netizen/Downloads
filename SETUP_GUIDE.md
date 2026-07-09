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
   PAYFAST_MERCHANT_ID=test_merchant_id
   PAYFAST_MERCHANT_KEY=test_merchant_key
   PAYFAST_SANDBOX=true
   NEXT_PUBLIC_APP_NAME=THE CHANCELLOR™
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Replace the placeholder values:**
   - Replace `sk_test_your_openai_api_key_here` with your actual OpenAI API key
   - Replace `https://your-project.supabase.co` with your actual Supabase URL
   - Replace `your_supabase_anon_key_here` with your actual Supabase Anon Key
   - **Do NOT add real PayFast credentials yet** - Payment integration is placeholder only

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

## Testing Subscriptions

### Test Free Plan

1. **Create a Free Account**
   - Click "Sign Up"
   - Fill in your details
   - Sign up with email/password

2. **Go to Ask The Chancellor**
   - You'll see "Free Plan" displayed
   - You have **5 questions per day**
   - After 5 questions, you'll see a limit warning

3. **Test the Daily Limit**
   - Ask 5 questions
   - On the 6th attempt, you'll get an error message
   - Button to upgrade to Wisdom or Legacy plan

### Test Paid Plans

1. **View Subscription Plans**
   - Click "Subscribe" in the navigation
   - See all three plans: Free (R0), Wisdom (R99), Legacy (R299)

2. **Try to Upgrade** (Placeholder)
   - Click "Upgrade Now" on Wisdom or Legacy
   - You'll see "Payment integration coming soon"
   - Full PayFast integration ready for implementation

3. **Manually Test Upgrade** (For Development)
   - In Supabase, go to SQL Editor
   - Run this query to upgrade your test user:
   ```sql
   UPDATE subscriptions
   SET tier = 'wisdom', status = 'active'
   WHERE user_id = 'your_user_id';
   ```
   - You now have unlimited questions on the Ask page

## Subscription Plans

### Free Plan - R0/month
- **5 questions per day**
- Access to 50 Laws of Life
- Community forum access
- Basic support

### Wisdom Plan - R99/month
- **Unlimited questions**
- Priority response time
- 12 Domains deep dives
- Weekly group sessions
- Exclusive resources library
- Premium support

### Legacy Plan - R299/month
- **Everything in Wisdom, plus:**
- Personal mentorship track
- Monthly one-on-ones
- Custom learning paths
- VIP event access
- Direct messaging access
- Priority support

## How Subscription Limits Work

### Daily Question Counting
1. When a user asks a question, it's stored in `chat_messages` table
2. The system counts user messages from today (00:00 to 23:59)
3. Free users can ask up to 5 questions per day
4. Wisdom and Legacy users have unlimited access

### API Protection
1. When a user sends a chat message, `/api/chat` is called
2. The API checks the user's subscription tier
3. For Free users, it checks daily count
4. If limit exceeded, API returns error (HTTP 429)
5. Frontend shows upgrade prompt

### Subscription Checking
1. Dashboard shows current plan and daily count
2. Ask page displays remaining questions (Free plan only)
3. Dashboard has quick upgrade button
4. Subscription page shows all plans with features

## PayFast Integration (Placeholder)

### Current Status
- **Not active yet** - Payment system is a placeholder
- `lib/payfast.ts` contains helper functions for future integration
- Environment variables are placeholder only
- Upgrade buttons show "Coming soon" message

### Future Implementation Steps
1. Get real PayFast merchant credentials
2. Update `.env.local` with real values:
   ```
   PAYFAST_MERCHANT_ID=your_real_merchant_id
   PAYFAST_MERCHANT_KEY=your_real_merchant_key
   PAYFAST_SANDBOX=false (for production)
   ```
3. Implement `/api/payfast/notify` endpoint
4. Connect `Subscribe` page to PayFast payment flow
5. Handle payment notifications and subscription updates

## Testing the Chat API

### With cURL (Test Limits)
```bash
# Test without authentication
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Hello, what is wisdom?"
    }]
  }'
```

### Test with Browser
1. Sign up for an account
2. Go to /ask
3. Ask questions and watch the counter
4. Free users will be limited after 5 questions

## Database Security

Your database is protected by **Row Level Security (RLS)**:

- Users can only read/write their own data
- Chat messages are private to each user
- Laws and products are publicly readable
- Subscriptions are private to each user
- Daily limits are checked server-side

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
│   │       └── route.ts     # Chat API endpoint (with subscription limits)
│   └── (pages)/
│       ├── auth/
│       │   ├── signup/      # Sign up page
│       │   └── login/       # Login page
│       ├── ask/             # Ask The Chancellor (with limits)
│       ├── subscribe/       # Subscribe page
│       └── dashboard/       # Protected dashboard
├── components/
│   ├── auth/                # Auth components (ProtectedRoute)
│   ├── layout/              # Layout components (Navbar, Footer)
│   ├── sections/            # Section components (Hero, etc)
│   └── ui/                  # Reusable UI components
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── auth.ts              # Authentication functions
│   ├── subscription.ts      # Subscription & limits logic
│   ├── payfast.ts           # PayFast integration (placeholder)
│   └── supabase-service.ts  # Database helpers
├── styles/
│   └── globals.css          # Global styles
├── supabase/
│   ├── schema.sql           # Database schema
│   └── seed.sql             # Seed data
└── .env.local.example       # Environment template
```

## Troubleshooting

### "npm: command not found"
- Node.js is not installed. Download from https://nodejs.org

### "Port 3000 already in use"
```bash
npm run dev -- -p 3001
```

### Chat limit not working
- Make sure you're logged in
- Check browser console for errors
- Verify Supabase is properly configured

### Can't upgrade subscription
- Payment integration is placeholder only
- Use manual SQL update for testing (see above)
- Full PayFast integration coming soon

### Styles not loading
```bash
rm -rf .next
npm run dev
```

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

## Deployment

When ready to deploy:

1. Build:
   ```bash
   npm run build
   ```

2. Test production build:
   ```bash
   npm run start
   ```

3. Deploy to Vercel:
   - Create account at https://vercel.com
   - Connect GitHub repository
   - Add environment variables
   - Deploy

## Need Help?

- GitHub Issues: https://github.com/bevanshelton-netizen/downloads/issues
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs
- OpenAI Docs: https://platform.openai.com/docs

## Technology Stack

- **Frontend:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS
- **AI:** OpenAI API (GPT-4 Turbo)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Payments:** PayFast (placeholder for now)
- **Deployment:** Vercel (recommended)

---

**Walk in wisdom. Build with purpose. Leave a legacy.**
