/**
 * Parses YouTube's internal API responses to extract events, community posts,
 * upcoming streams, and other relevant content.
 */

/**
 * Deep search for renderers in nested YouTube response objects
 */
function findRenderers(obj, rendererTypes, results = []) {
  if (!obj || typeof obj !== 'object') return results;

  for (const key of Object.keys(obj)) {
    if (rendererTypes.includes(key)) {
      results.push({ type: key, data: obj[key] });
    }
    if (typeof obj[key] === 'object') {
      findRenderers(obj[key], rendererTypes, results);
    }
  }

  return results;
}

/**
 * Extract text from YouTube's text objects (can be simple string or runs array)
 */
function extractText(textObj) {
  if (!textObj) return '';
  if (typeof textObj === 'string') return textObj;
  if (textObj.simpleText) return textObj.simpleText;
  if (textObj.runs) {
    return textObj.runs.map(run => run.text).join('');
  }
  return '';
}

/**
 * Parse a community post (backstagePostRenderer)
 */
function parseCommunityPost(renderer) {
  try {
    const post = {
      type: 'community_post',
      id: renderer.postId,
      channelId: renderer.authorEndpoint?.browseEndpoint?.browseId || '',
      channelName: extractText(renderer.authorText),
      channelThumbnail: renderer.authorThumbnail?.thumbnails?.[0]?.url || '',
      content: extractText(renderer.contentText),
      publishedTime: extractText(renderer.publishedTimeText),
      voteCount: extractText(renderer.voteCount),
      replyCount: renderer.actionButtons?.commentActionButtonsRenderer?.replyButton?.buttonRenderer?.text?.simpleText || '0',
      images: [],
      poll: null,
      videoAttachment: null,
      extractedAt: Date.now()
    };

    // Extract images if present
    if (renderer.backstageImageRenderer) {
      post.images = renderer.backstageImageRenderer.image?.thumbnails || [];
    }
    if (renderer.images) {
      renderer.images.forEach(img => {
        if (img.backstageImageRenderer?.image?.thumbnails) {
          post.images.push(...img.backstageImageRenderer.image.thumbnails);
        }
      });
    }

    // Extract poll if present
    if (renderer.pollRenderer || renderer.backstagePollRenderer) {
      const pollData = renderer.pollRenderer || renderer.backstagePollRenderer;
      post.poll = {
        choices: (pollData.choices || []).map(choice => ({
          text: extractText(choice.text),
          votePercentage: extractText(choice.votePercentage)
        })),
        totalVotes: extractText(pollData.totalVotes)
      };
    }

    // Extract video attachment if present
    if (renderer.backstageAttachment?.videoRenderer) {
      const video = renderer.backstageAttachment.videoRenderer;
      post.videoAttachment = {
        videoId: video.videoId,
        title: extractText(video.title),
        thumbnail: video.thumbnail?.thumbnails?.[0]?.url || ''
      };
    }

    return post;
  } catch (e) {
    console.debug('[YT Event Aggregator] Failed to parse community post:', e);
    return null;
  }
}

/**
 * Parse a video (videoRenderer or richItemRenderer)
 */
function parseVideo(renderer) {
  try {
    // Handle richItemRenderer wrapper
    if (renderer.content?.videoRenderer) {
      renderer = renderer.content.videoRenderer;
    }

    const video = {
      type: 'video',
      id: renderer.videoId,
      title: extractText(renderer.title),
      channelId: renderer.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
                 renderer.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
      channelName: extractText(renderer.ownerText) || extractText(renderer.longBylineText),
      thumbnail: renderer.thumbnail?.thumbnails?.[0]?.url || '',
      duration: extractText(renderer.lengthText),
      viewCount: extractText(renderer.viewCountText) || extractText(renderer.shortViewCountText),
      publishedTime: extractText(renderer.publishedTimeText),
      description: extractText(renderer.descriptionSnippet),
      isLive: false,
      isUpcoming: false,
      isPremiere: false,
      scheduledStartTime: null,
      badges: [],
      extractedAt: Date.now()
    };

    // Check badges
    if (renderer.badges) {
      renderer.badges.forEach(badge => {
        const style = badge.metadataBadgeRenderer?.style;
        if (style) video.badges.push(style);
        if (style === 'BADGE_STYLE_TYPE_LIVE_NOW') video.isLive = true;
      });
    }

    // Check for upcoming/premiere
    if (renderer.upcomingEventData) {
      video.isUpcoming = true;
      video.scheduledStartTime = renderer.upcomingEventData.startTime;
    }

    // Check thumbnailOverlays for live/upcoming indicators
    if (renderer.thumbnailOverlays) {
      renderer.thumbnailOverlays.forEach(overlay => {
        if (overlay.thumbnailOverlayTimeStatusRenderer) {
          const style = overlay.thumbnailOverlayTimeStatusRenderer.style;
          if (style === 'LIVE') video.isLive = true;
          if (style === 'UPCOMING') video.isUpcoming = true;
        }
      });
    }

    // Check for premiere badge in title
    if (renderer.ownerBadges) {
      renderer.ownerBadges.forEach(badge => {
        if (badge.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED_ARTIST') {
          video.badges.push('VERIFIED_ARTIST');
        }
      });
    }

    return video;
  } catch (e) {
    console.debug('[YT Event Aggregator] Failed to parse video:', e);
    return null;
  }
}

/**
 * Parse subscription/channel info from guide renderer
 */
function parseSubscription(renderer) {
  try {
    return {
      type: 'subscription',
      channelId: renderer.navigationEndpoint?.browseEndpoint?.browseId || '',
      channelName: extractText(renderer.title) || extractText(renderer.formattedTitle),
      thumbnail: renderer.thumbnail?.thumbnails?.[0]?.url || '',
      extractedAt: Date.now()
    };
  } catch (e) {
    return null;
  }
}

/**
 * Main parser function - extracts all relevant items from a YouTube API response
 */
export function parseYouTubeResponse(data, endpointType) {
  const results = {
    communityPosts: [],
    videos: [],
    upcomingStreams: [],
    subscriptions: [],
    raw: null // For debugging
  };

  if (!data) return results;

  // Find all renderers we care about
  const rendererTypes = [
    'backstagePostRenderer',
    'videoRenderer',
    'richItemRenderer',
    'gridVideoRenderer',
    'compactVideoRenderer',
    'guideEntryRenderer',
    'guideCollapsibleEntryRenderer'
  ];

  const renderers = findRenderers(data, rendererTypes);

  for (const { type, data: rendererData } of renderers) {
    switch (type) {
      case 'backstagePostRenderer':
        const post = parseCommunityPost(rendererData);
        if (post) results.communityPosts.push(post);
        break;

      case 'videoRenderer':
      case 'richItemRenderer':
      case 'gridVideoRenderer':
      case 'compactVideoRenderer':
        const video = parseVideo(rendererData);
        if (video) {
          results.videos.push(video);
          if (video.isUpcoming || video.isLive) {
            results.upcomingStreams.push(video);
          }
        }
        break;

      case 'guideEntryRenderer':
        // Subscriptions from the guide sidebar
        if (rendererData.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC')) {
          const sub = parseSubscription(rendererData);
          if (sub) results.subscriptions.push(sub);
        }
        break;

      case 'guideCollapsibleEntryRenderer':
        // Collapsed subscriptions section
        if (rendererData.expandableItems) {
          rendererData.expandableItems.forEach(item => {
            if (item.guideEntryRenderer?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC')) {
              const sub = parseSubscription(item.guideEntryRenderer);
              if (sub) results.subscriptions.push(sub);
            }
          });
        }
        break;
    }
  }

  return results;
}

/**
 * Extract browse ID to determine what kind of page/feed this is
 */
export function getBrowseContext(data) {
  // Try to find browseId in various places
  const browseId = data?.responseContext?.serviceTrackingParams?.find(
    p => p.params?.find(param => param.key === 'browse_id')
  )?.params?.find(param => param.key === 'browse_id')?.value;

  // Or from the response itself
  const header = data?.header?.c4TabbedHeaderRenderer;

  return {
    browseId: browseId || header?.channelId || null,
    channelName: header ? extractText(header.title) : null,
    isSubscriptionFeed: browseId === 'FEsubscriptions',
    isCommunityTab: data?.tabRenderer?.selected &&
                    data?.tabRenderer?.endpoint?.browseEndpoint?.params === 'community'
  };
}
