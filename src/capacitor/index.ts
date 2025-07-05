import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

export class CapacitorManager {
  private static instance: CapacitorManager;
  
  public static getInstance(): CapacitorManager {
    if (!CapacitorManager.instance) {
      CapacitorManager.instance = new CapacitorManager();
    }
    return CapacitorManager.instance;
  }

  public async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // Configure status bar
      await StatusBar.setStyle({ style: Style.Default });
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
      await StatusBar.setOverlaysWebView({ overlay: false });

      // Hide splash screen after app is ready
      await SplashScreen.hide();

      // Configure keyboard
      Keyboard.setResizeMode({ mode: 'body' });

      // Listen for app state changes
      App.addListener('appStateChange', ({ isActive }) => {
        console.log('App state changed. Is active?', isActive);
      });

      // Listen for app URL open
      App.addListener('appUrlOpen', (event) => {
        console.log('App opened with URL:', event.url);
        // Handle deep links here
        this.handleDeepLink(event.url);
      });

      console.log('Capacitor initialized successfully');
    } catch (error) {
      console.error('Error initializing Capacitor:', error);
    }
  }

  public async provideFeedback(impact: ImpactStyle = ImpactStyle.Light): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await Haptics.impact({ style: impact });
    } catch (error) {
      console.error('Error providing haptic feedback:', error);
    }
  }

  public async shareSchedule(title: string, text: string, url?: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to web share API
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(`${title}\n${text}\n${url || ''}`);
      }
      return;
    }

    try {
      await Share.share({
        title,
        text,
        url,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  private handleDeepLink(url: string): void {
    // Parse the URL and handle different deep link scenarios
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      // Example: denverrinkschedule://schedule?rink=ice-ranch&date=2024-01-15
      if (urlObj.pathname === '/schedule') {
        const rink = params.get('rink');
        const date = params.get('date');
        
        // Update app state based on deep link parameters
        if (rink || date) {
          const searchParams = new URLSearchParams(window.location.search);
          if (rink) searchParams.set('rink', rink);
          if (date) searchParams.set('date', date);
          
          // Update URL without page reload
          const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
          window.history.pushState({}, '', newUrl);
          
          // Trigger a custom event to notify the app of the deep link
          window.dispatchEvent(new CustomEvent('deeplink', { 
            detail: { rink, date } 
          }));
        }
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getPlatform(): string {
    return Capacitor.getPlatform();
  }
}

export const capacitorManager = CapacitorManager.getInstance();