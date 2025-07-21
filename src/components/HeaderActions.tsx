import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

interface HeaderActionsProps {
  onShowAbout: () => void;
}

const HeaderActions: React.FC<HeaderActionsProps> = ({ onShowAbout }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  useEffect(() => {
    // Check if device is mobile and browser type
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    const checkFirefox = () => {
      const isFF = /Firefox/i.test(navigator.userAgent);
      logger.log('Firefox detection:', isFF, navigator.userAgent);
      setIsFirefox(isFF);
    };
    
    checkMobile();
    checkFirefox();
    window.addEventListener('resize', checkMobile);
    
    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      logger.log('PWA install prompt detected!', e);
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
    const isInAppBrowser = (window.navigator as any).standalone; // iOS Safari - type cast for iOS-specific property
    const isRunningInPWA = !!(isStandalone || isInAppBrowser);
    
    logger.log('PWA detection:', { isStandalone, isInAppBrowser, isRunningInPWA });
    
    // Try to detect if app is installed (different from running in PWA)
    // This is tricky - we'll use the presence of beforeinstallprompt as a signal
    let isAppInstalled = false;
    if (isRunningInPWA) {
      // If we're in PWA mode, the app is definitely installed
      isAppInstalled = true;
    }
    
    // Debug: Log service worker registration status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        logger.log('Service Worker registrations:', registrations.length);
      });
    }

    // Debug: Check PWA criteria
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const pwaCriteriaMet = (location.protocol === 'https:' || location.hostname === 'localhost') &&
                           'serviceWorker' in navigator &&
                           manifestLink !== null;
    
    logger.log('PWA Debug Info:', {
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
      logger.log('Hiding button because:', { isFirefox, isRunningInPWA, noDeferredPrompt: !deferredPrompt });
      setShowInstallButton(false);
    }
    
    logger.log('Final button state:', { 
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

    logger.log('Installing app using deferred prompt');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      logger.log('User accepted install');
      setShowInstallButton(false); // Hide button after successful install
    }
    
    setDeferredPrompt(null);
  };

  const handleShareLink = async () => {
    const currentUrl = window.location.href;
    
    try {
      if (navigator.share && isMobile) {
        // Use native share API on mobile if available
        await navigator.share({
          title: 'Denver Rink Schedule',
          text: 'Check out this ice rink schedule!',
          url: currentUrl,
        });
      } else {
        // Fallback to clipboard API
        await navigator.clipboard.writeText(currentUrl);
        setShowCopiedMessage(true);
        setTimeout(() => setShowCopiedMessage(false), 2000);
      }
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
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

      <button
        onClick={handleShareLink}
        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
      >
        {showCopiedMessage ? '✅ Link Copied!' : '📤 Share Link'}
      </button>
    </div>
  );
};

export default HeaderActions;