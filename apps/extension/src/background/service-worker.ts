// Background service worker for AI UGCify Chrome Extension

// Default API URL - MUST be HTTPS for production security
// Environment variable should be set, but fallback to production URL for safety
const DEFAULT_API_URL = 'https://aiugcifyapi-production.up.railway.app/api/v1';

// Track active script generation
let isGeneratingScript = false;

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

    case 'GENERATE_SCRIPT':
      generateScriptInBackground(message.data).then(sendResponse);
      return true; // Keep channel open for async response

    case 'CHECK_SCRIPT_GENERATION_STATUS':
      sendResponse({ isGenerating: isGeneratingScript });
      return false;

    case 'VIDEO_COMPLETED':
      console.log('[AI UGCify] Video completed:', message.data);
      return false;

    case 'VIDEO_FAILED':
      console.log('[AI UGCify] Video failed:', message.data);
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

// Generate script in background - continues even if popup closes
async function generateScriptInBackground(data: {
  productData: unknown;
  videoStyle: string;
  apiBaseUrl?: string;
  options?: {
    tone?: string;
    targetDuration?: number;
    additionalNotes?: string;
  };
}): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (isGeneratingScript) {
    return { success: false, error: 'Script generation already in progress' };
  }

  isGeneratingScript = true;
  console.log('[AI UGCify] Starting background script generation');

  // Use provided API URL or default
  const apiUrl = data.apiBaseUrl || DEFAULT_API_URL;
  console.log('[AI UGCify] Using API URL:', apiUrl);

  // Update video-storage to show generation is in progress
  await updateVideoStorage({
    isGeneratingScript: true,
    scriptGenerationStep: 1,
    error: null,
    currentScript: null,
  });

  // Simulate progress steps
  const progressInterval = setInterval(async () => {
    const storage = await chrome.storage.local.get(['video-storage']);
    if (storage['video-storage']) {
      try {
        const storageData = JSON.parse(storage['video-storage']);
        const currentStep = storageData.state?.scriptGenerationStep || 1;
        if (currentStep < 3 && storageData.state?.isGeneratingScript) {
          await updateVideoStorage({ scriptGenerationStep: currentStep + 1 });
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, 2500);

  try {
    // Get auth token
    const { token } = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Prepare request body (exclude apiBaseUrl from what we send to API)
    const requestBody = {
      productData: data.productData,
      videoStyle: data.videoStyle,
      options: data.options,
    };

    // Make API request
    const response = await fetch(`${apiUrl}/videos/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    clearInterval(progressInterval);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Script generation failed');
    }

    const result = await response.json();
    const scriptData = result.data;

    console.log('[AI UGCify] Script generation completed:', scriptData.videoId);

    // Update storage with completed script
    await updateVideoStorage({
      currentScript: scriptData,
      editedScript: scriptData.script,
      isGeneratingScript: false,
      scriptGenerationStep: 0,
      isLoading: false,
    });

    isGeneratingScript = false;
    return { success: true, result: scriptData };
  } catch (error) {
    clearInterval(progressInterval);
    const errorMessage = (error as Error).message;
    console.error('[AI UGCify] Script generation failed:', errorMessage);

    // Update storage with error
    await updateVideoStorage({
      error: errorMessage,
      isGeneratingScript: false,
      scriptGenerationStep: 0,
      isLoading: false,
    });

    isGeneratingScript = false;
    return { success: false, error: errorMessage };
  }
}

// Helper to update video storage state
async function updateVideoStorage(updates: Record<string, unknown>): Promise<void> {
  const storage = await chrome.storage.local.get(['video-storage']);
  let data = { state: {} };

  if (storage['video-storage']) {
    try {
      data = JSON.parse(storage['video-storage']);
    } catch {
      // Use default
    }
  }

  data.state = {
    ...data.state,
    ...updates,
  };

  await chrome.storage.local.set({
    'video-storage': JSON.stringify(data),
  });
}
