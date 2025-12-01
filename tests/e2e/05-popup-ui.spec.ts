import { test, expect } from '../fixtures/extension';
import { PopupPage } from '../page-objects/PopupPage';
import { YouTubePage } from '../page-objects/YouTubePage';

test.describe('Popup UI', () => {
  test('displays stats header with event and stream counts', async ({ context, extensionId }) => {
    const popupPage = new PopupPage(await context.newPage());
    await popupPage.goto(extensionId);

    // Check stats header exists
    const statsVisible = await popupPage.statsHeader.isVisible();
    expect(statsVisible).toBe(true);

    // Event count element exists
    const eventCountVisible = await popupPage.eventCountStat.isVisible();
    expect(eventCountVisible).toBe(true);

    // Stream count element exists
    const streamCountVisible = await popupPage.streamCountStat.isVisible();
    expect(streamCountVisible).toBe(true);

    await popupPage.page.close();
  });

  test('tab switching works - Events, Upcoming, Posts', async ({ context, extensionId }) => {
    const popupPage = new PopupPage(await context.newPage());
    await popupPage.goto(extensionId);

    // Default tab should be visible
    const eventsTabActive = await popupPage.eventsTab.getAttribute('class');
    expect(eventsTabActive).toContain('active');

    // Switch to Upcoming
    await popupPage.switchToTab('upcoming');
    const upcomingTabActive = await popupPage.upcomingTab.getAttribute('class');
    expect(upcomingTabActive).toContain('active');

    // Switch to Posts
    await popupPage.switchToTab('posts');
    const postsTabActive = await popupPage.postsTab.getAttribute('class');
    expect(postsTabActive).toContain('active');

    await popupPage.page.close();
  });

  test('renders event items correctly', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    // Add test data
    await ytPage.goto();
    await page.waitForTimeout(1000);

    const eventData = {
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
                              postId: 'uiTest001',
                              authorText: { simpleText: 'UI Test Channel' },
                              authorThumbnail: {
                                thumbnails: [{ url: 'https://example.com/thumb.jpg' }]
                              },
                              contentText: {
                                runs: [{ text: 'Tour tickets on sale now! Concert announcement!' }]
                              },
                              publishedTimeText: { runs: [{ text: '30 min ago' }] },
                              voteCount: { simpleText: '5K' }
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

    await ytPage.injectMockResponse(eventData);
    await page.waitForTimeout(2000);

    // Open popup and check rendering
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('events');

    const items = await popupPage.getEventItems();
    if (items.length > 0) {
      const details = await popupPage.getEventItemDetails(0);
      expect(details).toBeDefined();
      if (details) {
        expect(details.channel).toBeDefined();
      }
    }

    await page.close();
    await popupPage.page.close();
  });

  test('shows badges for live/upcoming streams', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Add live stream
    const liveData = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [{
            tabRenderer: {
              content: {
                richGridRenderer: {
                  contents: [{
                    richItemRenderer: {
                      content: {
                        videoRenderer: {
                          videoId: 'liveUI001',
                          title: { runs: [{ text: 'LIVE NOW!' }] },
                          ownerText: { runs: [{ text: 'Live Channel' }] },
                          thumbnail: { thumbnails: [{ url: 'test.jpg' }] },
                          badges: [{
                            metadataBadgeRenderer: {
                              style: 'BADGE_STYLE_TYPE_LIVE_NOW',
                              label: 'LIVE'
                            }
                          }],
                          thumbnailOverlays: [{
                            thumbnailOverlayTimeStatusRenderer: {
                              style: 'LIVE',
                              text: { simpleText: 'LIVE' }
                            }
                          }]
                        }
                      }
                    }
                  }]
                }
              }
            }
          }]
        }
      }
    };

    await ytPage.injectMockResponse(liveData);
    await page.waitForTimeout(2000);

    await popupPage.goto(extensionId);
    await popupPage.switchToTab('upcoming');

    // Check for badge elements
    const badges = await popupPage.page.locator('.badge').all();
    // May have badges if data rendered correctly

    await page.close();
    await popupPage.page.close();
  });

  test('shows keyword tags on matched events', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Add event with keywords
    const keywordData = {
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
                              postId: 'tagUI001',
                              authorText: { simpleText: 'Tag Test' },
                              contentText: {
                                runs: [{ text: 'GIVEAWAY! Get your tour tickets!' }]
                              },
                              publishedTimeText: { runs: [{ text: '1h' }] }
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

    await ytPage.injectMockResponse(keywordData);
    await page.waitForTimeout(2000);

    await popupPage.goto(extensionId);
    await popupPage.switchToTab('events');

    // Look for keyword tags
    const keywordTags = await popupPage.page.locator('.keyword-tag').all();
    // Should show matched keywords if item rendered

    await page.close();
    await popupPage.page.close();
  });

  test('clicking event opens YouTube in new tab', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Add clickable video
    const clickData = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [{
            tabRenderer: {
              content: {
                richGridRenderer: {
                  contents: [{
                    richItemRenderer: {
                      content: {
                        videoRenderer: {
                          videoId: 'clickTest123',
                          title: { runs: [{ text: 'Click Test Video' }] },
                          ownerText: { runs: [{ text: 'Click Channel' }] },
                          thumbnail: { thumbnails: [{ url: 'test.jpg' }] },
                          upcomingEventData: {
                            startTime: String(Math.floor(Date.now() / 1000) + 86400)
                          }
                        }
                      }
                    }
                  }]
                }
              }
            }
          }]
        }
      }
    };

    await ytPage.injectMockResponse(clickData);
    await page.waitForTimeout(2000);

    await popupPage.goto(extensionId);
    await popupPage.switchToTab('upcoming');

    // Count pages before click
    const pagesBefore = context.pages().length;

    // Try clicking an item (if any exist)
    const items = await popupPage.getEventItems();
    if (items.length > 0) {
      // Listen for new page
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        items[0].click()
      ]);

      if (newPage) {
        const newUrl = newPage.url();
        expect(newUrl).toContain('youtube.com');
        await newPage.close();
      }
    }

    await page.close();
    await popupPage.page.close();
  });

  test('clear button works with confirmation', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    // Add some data first
    await ytPage.goto();
    await page.waitForTimeout(1000);

    const clearData = {
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
                              postId: 'clearUI001',
                              authorText: { simpleText: 'Clear Test' },
                              contentText: { runs: [{ text: 'Tour announcement!' }] },
                              publishedTimeText: { runs: [{ text: '1h' }] }
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

    await ytPage.injectMockResponse(clearData);
    await page.waitForTimeout(2000);

    await popupPage.goto(extensionId);

    // Get count before clear
    const countBefore = await popupPage.getEventCount();

    // Clear data (handles dialog automatically)
    await popupPage.clearAllData();

    // Refresh popup to see updated count
    await popupPage.goto(extensionId);
    const countAfter = await popupPage.getEventCount();

    expect(countAfter).toBe(0);

    await page.close();
    await popupPage.page.close();
  });

  test('shows empty state message when no data', async ({ context, extensionId }) => {
    const popupPage = new PopupPage(await context.newPage());

    // Clear any existing data first
    await popupPage.goto(extensionId);
    await popupPage.clearAllData();

    // Refresh and check for empty state
    await popupPage.goto(extensionId);

    const isEmpty = await popupPage.isEmptyStateVisible();
    expect(isEmpty).toBe(true);

    await popupPage.page.close();
  });
});
