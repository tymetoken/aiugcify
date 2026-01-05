// Background service worker for AI UGCify Chrome Extension

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[AI UGCify] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[AI UGCify] Extension updated');
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AI UGCify] Received message:', message.type);

  switch (message.type) {
    case 'PRODUCT_SCRAPED':
      handleProductScraped(message.data, sender.tab?.id);
      return false;

    case 'CHECK_TAB_STATUS':
      checkTabStatus(sender.tab?.id).then(sendResponse);
      return true; // Keep channel open for async response

    case 'GET_AUTH_TOKEN':
      getAuthToken().then(sendResponse);
      return true;

    case 'SET_AUTH_TOKEN':
      setAuthToken(message.data).then(sendResponse);
      return true;

    case 'VIDEO_COMPLETED':
      showVideoCompletedNotification(message.data);
      return false;

    case 'VIDEO_FAILED':
      showVideoFailedNotification(message.data);
      return false;

    default:
      console.log('[AI UGCify] Unknown message type:', message.type);
      return false;
  }
});

// Handle product scraped from content script
function handleProductScraped(productData: unknown, tabId?: number) {
  if (!productData || !tabId) return;

  // Store the product data temporarily
  chrome.storage.session.set({
    [`product_${tabId}`]: productData,
  });

  // Update badge to indicate product is available
  chrome.action.setBadgeText({ text: '1', tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId });
}

// Check if current tab is a product page
async function checkTabStatus(tabId?: number): Promise<{ isProductPage: boolean }> {
  if (!tabId) return { isProductPage: false };

  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';

    const isProductPage =
      url.includes('tiktok.com') &&
      (url.includes('/product/') || url.includes('/shop/pdp/') || url.includes('shop.tiktok.com'));

    return { isProductPage };
  } catch {
    return { isProductPage: false };
  }
}

// Get auth token from storage
async function getAuthToken(): Promise<{ token: string | null }> {
  const result = await chrome.storage.local.get(['auth-storage']);
  if (result['auth-storage']) {
    try {
      const data = JSON.parse(result['auth-storage']);
      return { token: data.state?.accessToken || null };
    } catch {
      return { token: null };
    }
  }
  return { token: null };
}

// Set auth token in storage
async function setAuthToken(data: {
  accessToken: string;
  refreshToken: string;
}): Promise<{ success: boolean }> {
  try {
    const result = await chrome.storage.local.get(['auth-storage']);
    let authData = { state: {} };

    if (result['auth-storage']) {
      try {
        authData = JSON.parse(result['auth-storage']);
      } catch {
        // Use default
      }
    }

    authData.state = {
      ...authData.state,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    await chrome.storage.local.set({
      'auth-storage': JSON.stringify(authData),
    });

    return { success: true };
  } catch {
    return { success: false };
  }
}

// Listen for tab updates to clear badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Clear badge when navigating
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

// Keep service worker alive with periodic heartbeat
setInterval(() => {
  // Just a heartbeat to prevent service worker from dying
}, 20000);
