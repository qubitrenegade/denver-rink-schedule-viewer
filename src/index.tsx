// Entry point for the Denver Rink Schedule Viewer app
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Register service worker for PWA functionality
console.log('Checking ServiceWorker support:', 'serviceWorker' in navigator);
if ('serviceWorker' in navigator) {
  console.log('ServiceWorker is supported, setting up registration...');
  
  const registerSW = () => {
    console.log('Attempting to register service worker at /sw.js');
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ SW registered successfully: ', registration);
        console.log('SW scope:', registration.scope);
        console.log('SW state:', registration.installing?.state || registration.waiting?.state || registration.active?.state);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                if (confirm('A new version is available. Reload to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.error('❌ SW registration failed: ', registrationError);
        console.error('Error details:', registrationError.message);
        console.error('Error stack:', registrationError.stack);
      });
  };

  // Register immediately and also on load
  registerSW();
  window.addEventListener('load', registerSW);
  
  // Listen for fresh data notifications from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FRESH_DATA_AVAILABLE') {
      // Dispatch custom event for components to listen to
      window.dispatchEvent(new CustomEvent('freshDataAvailable', {
        detail: { url: event.data.url }
      }));
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary fallbackMessage="The application encountered an error. Please try refreshing.">
    <App />
  </ErrorBoundary>
);