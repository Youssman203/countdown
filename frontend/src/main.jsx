import React from 'react';
import { createRoot } from 'react-dom/client';
import MemberApp from './components/MemberApp.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemberApp />
  </React.StrictMode>,
);
