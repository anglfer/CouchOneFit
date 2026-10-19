import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './services/theme';
import './services/pwa';
import App from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
