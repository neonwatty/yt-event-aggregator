/**
 * Content script that bridges between the injected page script and the service worker.
 * It injects the fetch interceptor and relays messages.
 */

(function() {
  'use strict';

  // Inject the fetch interceptor script into the page context
  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/inject.js');
    script.onload = function() {
      this.remove(); // Clean up after injection
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Inject as early as possible
  injectScript();

  // Listen for messages from the injected script
  window.addEventListener('message', function(event) {
    // Only accept messages from the same window
    if (event.source !== window) return;

    // Check if this is our message
    if (event.data && event.data.type === 'YT_EVENT_AGGREGATOR_DATA') {
      // Forward to service worker
      chrome.runtime.sendMessage({
        action: 'PROCESS_YT_DATA',
        endpointType: event.data.endpointType,
        url: event.data.url,
        data: event.data.data,
        timestamp: event.data.timestamp,
        pageUrl: window.location.href
      }).catch(err => {
        // Service worker might not be ready yet
        console.debug('[YT-Event-Aggregator] Could not send to service worker:', err);
      });
    }

    if (event.data && event.data.type === 'YT_EVENT_AGGREGATOR_READY') {
      console.debug('[YT-Event-Aggregator] Content script ready');
    }
  });

  // Listen for YouTube's SPA navigation events
  document.addEventListener('yt-navigate-finish', function(event) {
    chrome.runtime.sendMessage({
      action: 'PAGE_NAVIGATED',
      url: window.location.href,
      timestamp: Date.now()
    }).catch(() => {});
  });

  // Also listen for popstate for back/forward navigation
  window.addEventListener('popstate', function() {
    chrome.runtime.sendMessage({
      action: 'PAGE_NAVIGATED',
      url: window.location.href,
      timestamp: Date.now()
    }).catch(() => {});
  });

  console.debug('[YT-Event-Aggregator] Content script loaded');
})();
