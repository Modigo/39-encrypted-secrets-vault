import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/theme.css';
import './styles/components.css';
import './styles/forms.css';
import './styles/states.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/detail.css';
import './styles/access.css';
import './styles/login.css';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { PollStatusProvider } from './context/PollStatusContext';
import { ToastProvider } from './components/Toast';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <PollStatusProvider>
            <App />
          </PollStatusProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
