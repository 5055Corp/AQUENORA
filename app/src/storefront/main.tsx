import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './storefront.css';
import { startErrorAlerts } from '../errorAlerts';
import { StorePage } from './StorePage';

startErrorAlerts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorePage />
  </StrictMode>,
);
