import React from 'react';
import { createRoot } from 'react-dom/client';
import SuiteShell from './SuiteShell.jsx';
import './styles.css';
import './suite.css';
import './premium-v1.css';

document.body.dataset.qualityProfile = 'izakhono-premium-v1';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SuiteShell />
  </React.StrictMode>,
);
