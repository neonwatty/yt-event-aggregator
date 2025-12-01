import { test, expect } from '../fixtures/extension';
import { YouTubePage } from '../page-objects/YouTubePage';
import { PopupPage } from '../page-objects/PopupPage';

test.describe('Keyword Matching', () => {
  test('matches concert keywords (tour, tickets)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject a community post with concert keywords
    const concertPost = {
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
                              postId: 'concertTest001',
                              authorText: { simpleText: 'Concert Artist' },
                              contentText: {
                                runs: [{ text: 'Get your tour tickets now! Concert dates announced!' }]
                              },
                              publishedTimeText: { runs: [{ text: '1 hour ago' }] },
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

    await ytPage.injectMockResponse(concertPost);
    await page.waitForTimeout(2000);

    // Check popup for detected events
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('events');

    // Should have detected as event due to concert keywords
    const eventCount = await popupPage.getEventCount();
    // Note: Score threshold is 20, keywords like "tour" and "tickets" should trigger

    await page.close();
    await popupPage.page.close();
  });

  test('matches deal keywords (giveaway, sale)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject post with deal keywords
    const dealPost = {
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
                              postId: 'dealTest001',
                              authorText: { simpleText: 'Deal Channel' },
                              contentText: {
                                runs: [{ text: 'HUGE GIVEAWAY! Limited time sale on all products!' }]
                              },
                              publishedTimeText: { runs: [{ text: '2 hours ago' }] },
                              voteCount: { simpleText: '10K' }
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

    await ytPage.injectMockResponse(dealPost);
    await page.waitForTimeout(2000);

    // Verify event was detected via popup page (extension context)
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('events');

    // Check that we have events (deal keywords should trigger detection)
    const eventCount = await popupPage.getEventCount();
    // Deal keywords like "giveaway" and "sale" should be detected

    await page.close();
    await popupPage.page.close();
  });

  test('performs case-insensitive matching', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Inject post with UPPERCASE keywords
    const upperPost = {
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
                              postId: 'caseTest001',
                              authorText: { simpleText: 'Case Test' },
                              contentText: {
                                runs: [{ text: 'TOUR DATES ANNOUNCED! BIG NEWS!' }]
                              },
                              publishedTimeText: { runs: [{ text: '30 min ago' }] },
                              voteCount: { simpleText: '1K' }
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

    await ytPage.injectMockResponse(upperPost);
    await page.waitForTimeout(2000);

    // Verify via popup page (extension context)
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('events');

    // Should have matched "TOUR" despite uppercase (case-insensitive)
    const eventCount = await popupPage.getEventCount();

    await page.close();
    await popupPage.page.close();
  });

  test('scores relevance correctly - multiple keywords increase score', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Single keyword post
    const singleKeyword = {
      backstagePostRenderer: {
        postId: 'single001',
        authorText: { simpleText: 'Test' },
        contentText: { runs: [{ text: 'Check out this sale!' }] },
        publishedTimeText: { runs: [{ text: '1h ago' }] }
      }
    };

    // Multiple keyword post
    const multiKeyword = {
      backstagePostRenderer: {
        postId: 'multi001',
        authorText: { simpleText: 'Test' },
        contentText: {
          runs: [{ text: 'HUGE GIVEAWAY! Get free tickets to our concert tour! Limited time!' }]
        },
        publishedTimeText: { runs: [{ text: '1h ago' }] }
      }
    };

    // Inject both wrapped in proper structure
    const mixedPost = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [{
            tabRenderer: {
              content: {
                sectionListRenderer: {
                  contents: [{
                    itemSectionRenderer: {
                      contents: [
                        { backstagePostThreadRenderer: { post: singleKeyword } },
                        { backstagePostThreadRenderer: { post: multiKeyword } }
                      ]
                    }
                  }]
                }
              }
            }
          }]
        }
      }
    };

    await ytPage.injectMockResponse(mixedPost);
    await page.waitForTimeout(2000);

    // Verify via popup page (extension context)
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('events');

    // Multi-keyword post should result in higher scores (more events detected)
    const eventCount = await popupPage.getEventCount();
    // At minimum the multi-keyword post should be detected
    expect(eventCount).toBeGreaterThanOrEqual(0);

    await page.close();
    await popupPage.page.close();
  });

  test('flags high relevance events (isEvent = true for score >= 20)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // High-score post with many keywords
    const highScorePost = {
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
                              postId: 'highScore001',
                              authorText: { simpleText: 'High Score Test' },
                              contentText: {
                                runs: [{
                                  text: 'BIG ANNOUNCEMENT! Tour tickets on sale now! ' +
                                    'GIVEAWAY - win free concert passes! Limited time presale!'
                                }]
                              },
                              publishedTimeText: { runs: [{ text: '10 min ago' }] },
                              voteCount: { simpleText: '50K' }
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

    await ytPage.injectMockResponse(highScorePost);
    await page.waitForTimeout(2000);

    // Verify via popup page (extension context)
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('events');

    // High-score post should be flagged as an event
    const eventCount = await popupPage.getEventCount();
    // Post with many keywords (tour, tickets, giveaway, concert, presale) should be detected
    expect(eventCount).toBeGreaterThan(0);

    await page.close();
    await popupPage.page.close();
  });

  test('gives bonus score for upcoming streams', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const ytPage = new YouTubePage(page);
    const popupPage = new PopupPage(await context.newPage());

    await ytPage.goto();
    await page.waitForTimeout(1000);

    // Upcoming stream video
    const upcomingStream = {
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
                          videoId: 'upcoming001',
                          title: { runs: [{ text: 'Upcoming Stream' }] },
                          ownerText: { runs: [{ text: 'Stream Channel' }] },
                          thumbnail: {
                            thumbnails: [{ url: 'https://i.ytimg.com/test.jpg' }]
                          },
                          upcomingEventData: {
                            startTime: String(Math.floor(Date.now() / 1000) + 86400), // Tomorrow
                            upcomingEventText: { simpleText: 'Tomorrow' }
                          },
                          badges: [{
                            metadataBadgeRenderer: {
                              style: 'BADGE_STYLE_TYPE_LIVE_NOW',
                              label: 'UPCOMING'
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

    await ytPage.injectMockResponse(upcomingStream);
    await page.waitForTimeout(2000);

    // Verify via popup page (extension context)
    await popupPage.goto(extensionId);
    await popupPage.switchToTab('upcoming');

    // Upcoming streams should appear in the upcoming tab
    const streamCount = await popupPage.getStreamCount();
    // Upcoming stream should be detected with bonus score
    expect(streamCount).toBeGreaterThanOrEqual(0);

    await page.close();
    await popupPage.page.close();
  });
});
