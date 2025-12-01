import { Page, Locator } from '@playwright/test';

export class PopupPage {
  readonly page: Page;
  readonly eventsTab: Locator;
  readonly upcomingTab: Locator;
  readonly postsTab: Locator;
  readonly eventList: Locator;
  readonly clearButton: Locator;
  readonly emptyState: Locator;
  readonly statsHeader: Locator;
  readonly eventCountStat: Locator;
  readonly streamCountStat: Locator;

  constructor(page: Page) {
    this.page = page;
    this.eventsTab = page.locator('[data-tab="events"]');
    this.upcomingTab = page.locator('[data-tab="upcoming"]');
    this.postsTab = page.locator('[data-tab="posts"]');
    this.eventList = page.locator('#event-list');
    this.clearButton = page.locator('#clear-data');
    this.emptyState = page.locator('#event-list .empty-state');
    this.statsHeader = page.locator('.stats');
    this.eventCountStat = page.locator('#stat-events');
    this.streamCountStat = page.locator('#stat-streams');
  }

  async goto(extensionId: string) {
    await this.page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async switchToTab(tab: 'events' | 'upcoming' | 'posts') {
    const tabLocator = {
      events: this.eventsTab,
      upcoming: this.upcomingTab,
      posts: this.postsTab,
    }[tab];
    await tabLocator.click();
    await this.page.waitForTimeout(100);
  }

  async getEventCount(): Promise<number> {
    const text = await this.eventCountStat.textContent();
    // Format is "0 events" - parse the number at the start
    const match = (text || '0').match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async getStreamCount(): Promise<number> {
    const text = await this.streamCountStat.textContent();
    // Format is "0 upcoming" - parse the number at the start
    const match = (text || '0').match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async getEventItems() {
    return this.eventList.locator('.event-item').all();
  }

  async clickEventItem(index: number) {
    const items = await this.getEventItems();
    if (items[index]) {
      await items[index].click();
    }
  }

  async getEventItemDetails(index: number) {
    const items = await this.getEventItems();
    if (!items[index]) return null;

    const item = items[index];
    return {
      title: await item.locator('.event-title').textContent(),
      channel: await item.locator('.event-channel').textContent(),
      badges: await item.locator('.badge').allTextContents(),
      keywords: await item.locator('.keyword-tag').allTextContents(),
    };
  }

  async clearAllData() {
    // Set up dialog handler before clicking
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await this.clearButton.click();
    await this.page.waitForTimeout(500);
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async hasEvents(): Promise<boolean> {
    const items = await this.getEventItems();
    return items.length > 0;
  }
}
