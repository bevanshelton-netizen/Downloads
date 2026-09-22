import React from 'react';
import { createRoot } from 'react-dom/client';
import SuiteShell from './SuiteShell.jsx';
import './styles.css';
import './suite.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SuiteShell />
  </React.StrictMode>,
);
