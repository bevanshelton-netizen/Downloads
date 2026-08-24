window.DOXA_CONFIG = {
  supabaseUrl: 'https://zoolsumifdtanycjryje.supabase.co',
  supabaseAnonKey: '',
  mode: 'auto'
};

// Keep the public acquisition funnel separate from the authenticated/demo Shield.
// This capture-phase handler runs before app.js's generic hero CTA handler.
const riskCheckButton = document.getElementById('heroCheckBtn');
if (riskCheckButton) {
  riskCheckButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = './risk-check.html';
  }, true);
}
