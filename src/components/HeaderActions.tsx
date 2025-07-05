import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { capacitorManager } from '../capacitor';

interface HeaderActionsProps {
  onShowAbout: () => void;
}

const HeaderActions: React.FC<HeaderActionsProps> = ({ onShowAbout }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if device is mobile and browser type
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    const checkFirefox = () => {
      const isFF = /Firefox/i.test(navigator.userAgent);
      console.log('Firefox detection:', isFF, navigator.userAgent);
      setIsFirefox(isFF);
    };
    
    checkMobile();
    checkFirefox();
    window.addEventListener('resize', checkMobile);
    
    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('PWA install prompt detected!', e);
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true); // Always set to true, we'll filter later
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Check if currently running as installed PWA
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isInAppBrowser = window.navigator.standalone; // iOS Safari
    const isRunningInPWA = !!(isStandalone || isInAppBrowser);
    
    logger.log('PWA detection:', { isStandalone, isInAppBrowser, isRunningInPWA });
    
    // Try to detect if app is installed (different from running in PWA)
    // This is tricky - we'll use the presence of beforeinstallprompt as a signal
    let isAppInstalled = false;
    if (isRunningInPWA) {
      // If we're in PWA mode, the app is definitely installed
      isAppInstalled = true;
    }
    
    setIsInstalled(isAppInstalled);

    // Debug: Log service worker registration status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('Service Worker registrations:', registrations.length);
      });
    }

    // Debug: Check PWA criteria
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const pwaCriteriaMet = (location.protocol === 'https:' || location.hostname === 'localhost') &&
                           'serviceWorker' in navigator &&
                           manifestLink !== null;
    
    console.log('PWA Debug Info:', {
      isHttps: location.protocol === 'https:' || location.hostname === 'localhost',
      hasServiceWorker: 'serviceWorker' in navigator,
      hasManifest: manifestLink !== null,
      manifestHref: manifestLink?.getAttribute('href'),
      userAgent: navigator.userAgent,
      beforeInstallPromptSupport: 'beforeinstallprompt' in window,
      isStandalone: isStandalone,
      pwaCriteriaMet
    });
    
    // Simple logic: Only show install button when we actually have an install prompt
    // This means the app is installable but not yet installed
    if (showInstallButton && (isFirefox || isRunningInPWA || !deferredPrompt)) {
      console.log('Hiding button because:', { isFirefox, isRunningInPWA, noDeferredPrompt: !deferredPrompt });
      setShowInstallButton(false);
    }
    
    console.log('Final button state:', { 
      showInstallButton,
      isFirefox, 
      isRunningInPWA,
      hasDeferredPrompt: !!deferredPrompt
    });

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    console.log('Installing app using deferred prompt');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted install');
      setShowInstallButton(false); // Hide button after successful install
    }
    
    setDeferredPrompt(null);
  };

  const handleShareClick = async () => {
    try {
      await capacitorManager.shareSchedule(
        'Denver Rink Schedule',
        'Check out the Denver ice rink schedules!',
        window.location.href
      );
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4 mt-3">
      <button
        onClick={onShowAbout}
        className="text-sky-400 hover:text-sky-300 underline transition-colors text-sm flex items-center gap-1"
      >
        ℹ️ About
      </button>
      
      <button
        onClick={handleShareClick}
        className="text-sky-400 hover:text-sky-300 underline transition-colors text-sm flex items-center gap-1"
      >
        📤 Share
      </button>
      
      
      {isMobile && showInstallButton && (
        <button
          onClick={handleInstallClick}
          className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          📱 Install App
        </button>
      )}
      
      {!isMobile && showInstallButton && (
        <button
          onClick={handleInstallClick}
          className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          💻 Install
        </button>
      )}
    </div>
  );
};

export default HeaderActions;