import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@jfrader/tokens/tokens.css';
import '@jfrader/tokens/base.css';
import './app.css';
import { App } from './app/App';
import { createApp } from './app/create-app';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const { queryClient, router } = createApp();

createRoot(root).render(
  <StrictMode>
    <App queryClient={queryClient} router={router} />
  </StrictMode>,
);
