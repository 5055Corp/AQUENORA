import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { StoreProvider } from './store';
import { readSettings } from './settings';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider settings={readSettings()}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
