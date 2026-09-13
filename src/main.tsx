import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Startup } from './ui/Startup';

createRoot(document.getElementById('root')!).render(<StrictMode><Startup /></StrictMode>);
