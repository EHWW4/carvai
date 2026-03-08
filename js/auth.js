/*
 * © 2025 Edward Hirth WoodWorks. All Rights Reserved. Patent Pending.
 * PROPRIETARY — Auth & Paywall Protection Layer
 * Configure SUPABASE_URL, SUPABASE_KEY, and STRIPE links below.
 */

// ─────────────────────────────────────────────
// CONFIG — Fill these in after setting up accounts
// ─────────────────────────────────────────────
const CONFIG = {
  // Supabase — get from supabase.com → your project → Settings → API
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_KEY: 'YOUR_SUPABASE_ANON_KEY',

  // Stripe Payment Links — get from stripe.com → Payment Links
  STRIPE: {
    starter:   'https://buy.stripe.com/YOUR_STARTER_LINK',
    pro:       'https://buy.stripe.com/YOUR_PRO_LINK',
    studio:    'https://buy.stripe.com/YOUR_STUDIO_LINK',
    perpetual: 'https://buy.stripe.com/YOUR_PERPETUAL_LINK',
  },

  // Your domain
  DOMAIN: 'https://edwardhirthwoodworks.com',

  // Trial days
  TRIAL_DAYS: 14,
};

// ─────────────────────────────────────────────
// AUTH STATE
// ─────────────────────────────────────────────
const Auth = {
  user: null,
  session: null,
  plan: null,

  // Check if user is logged in with active subscription
  async check() {
    // In production: call Supabase to verify session + check subscription status
    // For demo/development: use localStorage trial
    const demo = localStorage.getItem('ehw_demo_user');
    if (demo) {
      try {
        const d = JSON.parse(demo);
        const trialEnd = new Date(d.trialStart);
        trialEnd.setDate(trialEnd.getDate() + CONFIG.TRIAL_DAYS);
        if (new Date() < trialEnd) {
          this.user = d;
          this.plan = d.plan || 'trial';
          return true;
        }
      } catch(e) {}
    }
    return false;
  },

  // Start trial (called after email capture)
  startTrial(email, name, plan = 'pro') {
    const user = {
      email,
      name,
      plan,
      trialStart: new Date().toISOString(),
      id: 'trial_' + Date.now()
    };
    localStorage.setItem('ehw_demo_user', JSON.stringify(user));
    this.user = user;
    this.plan = 'trial';
    return user;
  },

  // Go to Stripe checkout
  checkout(plan = 'pro') {
    const link = CONFIG.STRIPE[plan];
    if (link && link.includes('stripe.com')) {
      window.location.href = link;
    } else {
      // Dev mode — just start trial
      console.warn('[EHW] Stripe not configured. Starting demo trial.');
      return null;
    }
  },

  logout() {
    localStorage.removeItem('ehw_demo_user');
    localStorage.removeItem('ehw_api_key');
    this.user = null;
    this.plan = null;
    window.location.href = '/';
  },

  getDisplayName() {
    return this.user?.name || this.user?.email?.split('@')[0] || 'Designer';
  }
};

// ─────────────────────────────────────────────
// PAYWALL GATE — Call this at the top of app.html
// Redirects to site if not authenticated
// ─────────────────────────────────────────────
async function requireAuth(onSuccess) {
  const ok = await Auth.check();
  if (ok) {
    onSuccess(Auth.user);
  } else {
    // Show paywall overlay instead of redirecting
    showPaywallGate();
  }
}

function showPaywallGate() {
  document.getElementById('paywall-gate').style.display = 'flex';
  document.getElementById('app-root').style.display = 'none';
}

function hidePaywallGate() {
  document.getElementById('paywall-gate').style.display = 'none';
  document.getElementById('app-root').style.display = 'flex';
}

// ─────────────────────────────────────────────
// SUPABASE PRODUCTION INTEGRATION (uncomment when ready)
// ─────────────────────────────────────────────
/*
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)

async function checkSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  
  // Check active subscription in your subscriptions table
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status, trial_end')
    .eq('user_id', session.user.id)
    .single()
  
  if (!data) return false
  if (data.status === 'active') return true
  if (data.status === 'trialing' && new Date(data.trial_end) > new Date()) return true
  return false
}
*/
