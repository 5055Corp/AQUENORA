import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './interview.css';
import { Interview } from './Interview';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Interview />
  </StrictMode>,
);
