// Entry point for the Denver Rink Schedule Viewer app
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

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