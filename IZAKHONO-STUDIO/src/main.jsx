import React from 'react';
import { createRoot } from 'react-dom/client';
import SuiteShell from './SuiteShell.jsx';
import LegalPage from './LegalPage.jsx';
import './styles.css';
import './suite.css';
import './premium-v1.css';

document.body.dataset.qualityProfile = 'izakhono-premium-v1';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const legalPages = {
  '/terms': 'terms',
  '/privacy': 'privacy',
  '/refunds': 'refunds',
  '/pricing': 'pricing',
};
const legalPage = legalPages[path];

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {legalPage ? <LegalPage page={legalPage} /> : <SuiteShell />}
  </React.StrictMode>,
);
