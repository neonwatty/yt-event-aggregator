/**
 * Injected script that runs in the page context to intercept YouTube's internal API calls.
 * This script wraps the native fetch function to capture responses from youtubei endpoints.
 */

(function() {
  'use strict';

  // Endpoints we care about
  const INTERCEPT_ENDPOINTS = [
    '/youtubei/v1/browse',      // Subscription feed, community posts, channel pages
    '/youtubei/v1/next',        // Video page data, recommendations
    '/youtubei/v1/search',      // Search results
    '/youtubei/v1/guide'        // Navigation guide (subscription list)
  ];

  // Store original fetch
  const originalFetch = window.fetch;

  // Wrap fetch to intercept responses
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input.url;

    // Call original fetch
    const response = await originalFetch.apply(this, arguments);

    // Check if this is an endpoint we care about
    const shouldIntercept = INTERCEPT_ENDPOINTS.some(endpoint => url.includes(endpoint));

    if (shouldIntercept) {
      try {
        // Clone response so we can read it without consuming the original
        const clone = response.clone();
        const data = await clone.json();

        // Determine the endpoint type
        let endpointType = 'unknown';
        if (url.includes('/browse')) endpointType = 'browse';
        else if (url.includes('/next')) endpointType = 'next';
        else if (url.includes('/search')) endpointType = 'search';
        else if (url.includes('/guide')) endpointType = 'guide';

        // Send data to content script via postMessage
        window.postMessage({
          type: 'YT_EVENT_AGGREGATOR_DATA',
          endpointType: endpointType,
          url: url,
          data: data,
          timestamp: Date.now()
        }, '*');

      } catch (e) {
        // Silently fail - don't break YouTube if our parsing fails
        console.debug('[YT-Event-Aggregator] Failed to parse response:', e);
      }
    }

    return response;
  };

  // Also intercept XMLHttpRequest for older code paths
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._ytEventAggregatorUrl = url;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const url = this._ytEventAggregatorUrl;
    const shouldIntercept = url && INTERCEPT_ENDPOINTS.some(endpoint => url.includes(endpoint));

    if (shouldIntercept) {
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);

          let endpointType = 'unknown';
          if (url.includes('/browse')) endpointType = 'browse';
          else if (url.includes('/next')) endpointType = 'next';
          else if (url.includes('/search')) endpointType = 'search';
          else if (url.includes('/guide')) endpointType = 'guide';

          window.postMessage({
            type: 'YT_EVENT_AGGREGATOR_DATA',
            endpointType: endpointType,
            url: url,
            data: data,
            timestamp: Date.now()
          }, '*');
        } catch (e) {
          console.debug('[YT-Event-Aggregator] Failed to parse XHR response:', e);
        }
      });
    }

    return originalXHRSend.apply(this, arguments);
  };

  // Signal that injection is complete
  window.__ytEventAggregatorInstalled = true;
  window.postMessage({
    type: 'YT_EVENT_AGGREGATOR_READY',
    timestamp: Date.now()
  }, '*');

  console.log('[YT-Event-Aggregator] Fetch interceptor installed');
})();
