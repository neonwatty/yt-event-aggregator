import { test as base, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  popupPage: Page;
}

export const test = base.extend<ExtensionFixtures>({
  // Launch Chrome with the extension loaded
  context: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, '../../');
    const userDataDir = path.join(__dirname, '../../.test-user-data');

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new', // New headless mode that supports extensions
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
      viewport: { width: 1920, height: 1080 },
    });

    await use(context);
    await context.close();
  },

  // Get the extension ID from the service worker
  extensionId: async ({ context }, use) => {
    // Open a page to trigger extension loading
    const page = await context.newPage();
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Wait for service worker to be available
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }

    // Extract extension ID from service worker URL
    // URL format: chrome-extension://<extension-id>/src/background/service-worker.js
    const extensionId = serviceWorker.url().split('/')[2];
    await page.close();
    await use(extensionId);
  },

  // Helper to open the extension popup
  popupPage: async ({ context, extensionId }, use) => {
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

// Helper to inject mock data into a YouTube page
export async function injectMockYouTubeData(page: Page, mockData: any) {
  await page.evaluate((data) => {
    window.postMessage({
      type: 'YT_EVENT_DATA',
      payload: data,
      endpoint: '/youtubei/v1/browse'
    }, '*');
  }, mockData);
}

// Helper to wait for extension message processing
export async function waitForExtensionProcessing(page: Page, timeout = 2000) {
  await page.waitForTimeout(timeout);
}

// Helper to get storage stats from popup
export async function getStorageStats(popupPage: Page) {
  return await popupPage.evaluate(() => {
    const eventCount = document.querySelector('.stat:nth-child(1) .stat-value')?.textContent;
    const streamCount = document.querySelector('.stat:nth-child(2) .stat-value')?.textContent;
    return {
      events: parseInt(eventCount || '0'),
      streams: parseInt(streamCount || '0'),
    };
  });
}
