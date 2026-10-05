import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ServerGate } from './components/ServerGate';
import { API_MODE } from './config';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      {/* Mode serveur : installation, connexion et chargement des données via l'API */}
      {API_MODE ? <ServerGate /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);