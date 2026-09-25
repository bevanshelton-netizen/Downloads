window.DOXA_CONFIG = {
  supabaseUrl: 'https://yfawrenhudjomhnglfhq.supabase.co',
  supabaseAnonKey: 'sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p',
  mode: 'auto'
};

// Browser-safe publishable key only. Row Level Security remains the security boundary.
// Keep the public acquisition funnel separate from the authenticated Shield dashboard.
const riskCheckButton = document.getElementById('heroCheckBtn');
if (riskCheckButton) {
  riskCheckButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = './risk-check.html';
  }, true);
}
