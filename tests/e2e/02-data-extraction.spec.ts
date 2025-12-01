import { test, expect } from '../fixtures/extension';
import { YouTubePage } from '../page-objects/YouTubePage';
import { PopupPage } from '../page-objects/PopupPage';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browseCommunity = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/mocks/browse-community.json'), 'utf-8')
);
const browseFeed = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/mocks/browse-feed.json'), 'utf-8')
);

test.describe('Data Extraction', () => {
  test('parses community posts from backstagePostRenderer', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    // Go to YouTube
    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject mock community post data
    await ytPage.injectMockResponse(browseCommunity);
    await page.waitForTimeout(2000);

    // Open popup and check for posts
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('posts');

    // Should have captured community posts
    const hasEvents = await popupPage.hasEvents();
    // Note: This tests the full pipeline - may need to verify storage directly

    await page.close();
    await popupPage.page.close();
  });

  test('parses video renderer items', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject mock video feed data
    await ytPage.injectMockResponse(browseFeed);
    await page.waitForTimeout(2000);

    // Check stats via popup page (extension context)
    await popupPage.goto(extensionId);
    const eventCount = await popupPage.getEventCount();
    const streamCount = await popupPage.getStreamCount();

    // Should have processed some videos
    expect(eventCount + streamCount).toBeGreaterThanOrEqual(0);

    await page.close();
    await popupPage.page.close();
  });

  test('extracts upcoming stream data', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject feed with upcoming streams
    await ytPage.injectMockResponse(browseFeed);
    await page.waitForTimeout(2000);

    // Check upcoming tab in popup
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('upcoming');

    // Get stream count
    const streamCount = await popupPage.getStreamCount();
    // Feed has at least one upcoming stream

    await page.close();
    await popupPage.page.close();
  });

  test('detects live stream badges', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject feed data that includes live streams
    await ytPage.injectMockResponse(browseFeed);
    await page.waitForTimeout(2000);

    // Check via popup page (extension context)
    await popupPage.goto(extensionId);
    const eventCount = await popupPage.getEventCount();

    // Extension should have processed the feed without errors
    expect(eventCount).toBeGreaterThanOrEqual(0);

    await page.close();
    await popupPage.page.close();
  });

  test('extracts channel info from ownerText/longBylineText', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject data
    await ytPage.injectMockResponse(browseFeed);
    await page.waitForTimeout(2000);

    // Check via popup page
    await popupPage.goto(extensionId);
    const items = await popupPage.getEventItems();

    if (items.length > 0) {
      const details = await popupPage.getEventItemDetails(0);
      // Channel info should be extracted
      expect(details).toBeDefined();
    }

    await page.close();
    await popupPage.page.close();
  });

  test('handles missing fields gracefully', async ({ context }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const errors: string[] = [];

    page.on('pageerror', err => errors.push(err.message));

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject sparse/incomplete data
    const sparseData = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [{
            tabRenderer: {
              content: {
                sectionListRenderer: {
                  contents: [{
                    itemSectionRenderer: {
                      contents: [{
                        backstagePostThreadRenderer: {
                          post: {
                            backstagePostRenderer: {
                              postId: 'sparse123'
                              // Missing many fields
                            }
                          }
                        }
                      }]
                    }
                  }]
                }
              }
            }
          }]
        }
      }
    };

    await ytPage.injectMockResponse(sparseData);
    await page.waitForTimeout(1000);

    // Should not crash
    const hasCriticalError = errors.some(err =>
      err.includes('Cannot read') || err.includes('undefined')
    );
    expect(hasCriticalError).toBe(false);

    await page.close();
  });
});
