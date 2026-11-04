import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './storefront.css';
import { StorePage } from './StorePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorePage />
  </StrictMode>,
);
