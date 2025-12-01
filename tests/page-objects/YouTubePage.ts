import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class YouTubePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(url: string = 'https://www.youtube.com') {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoSubscriptions() {
    await this.page.goto('https://www.youtube.com/feed/subscriptions');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoChannelCommunity(channelId: string) {
    await this.page.goto(`https://www.youtube.com/channel/${channelId}/community`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async gotoVideo(videoId: string) {
    await this.page.goto(`https://www.youtube.com/watch?v=${videoId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Inject mock data as if it came from a YouTube API response
  async injectMockResponse(mockData: any, endpoint: string = '/youtubei/v1/browse') {
    await this.page.evaluate(({ data, ep }) => {
      window.postMessage({
        type: 'YT_EVENT_AGGREGATOR_DATA',
        endpointType: 'browse',
        url: ep,
        data: data,
        timestamp: Date.now()
      }, '*');
    }, { data: mockData, ep: endpoint });
  }

  // Load mock data from file and inject it
  async injectMockFromFile(mockFileName: string, endpoint: string = '/youtubei/v1/browse') {
    const mockPath = path.join(__dirname, '../fixtures/mocks', mockFileName);
    const mockData = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
    await this.injectMockResponse(mockData, endpoint);
  }

  // Check if the fetch interceptor is installed
  async isFetchInterceptorInstalled(): Promise<boolean> {
    return this.page.evaluate(() => {
      return (window as any).__ytEventAggregatorInstalled === true;
    });
  }

  // Wait for the extension to process the injected data
  async waitForExtensionProcessing(timeout: number = 2000) {
    await this.page.waitForTimeout(timeout);
  }

  // Get console logs (useful for debugging)
  async getConsoleLogs(): Promise<string[]> {
    const logs: string[] = [];
    this.page.on('console', msg => {
      logs.push(`${msg.type()}: ${msg.text()}`);
    });
    return logs;
  }

  // Simulate YouTube navigation event (SPA navigation)
  async simulateYouTubeNavigation(url: string) {
    await this.page.evaluate((newUrl) => {
      window.history.pushState({}, '', newUrl);
      window.dispatchEvent(new Event('yt-navigate-finish'));
    }, url);
  }

  // Check if we're on a YouTube page
  async isYouTubePage(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('youtube.com');
  }
}
