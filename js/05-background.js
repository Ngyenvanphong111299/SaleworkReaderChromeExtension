// Step 05: Background script - Entry point, message handling (v2.1)

import { logToPopup } from './02-utils.js';
import { getCrawlState, stopCrawl, startCrawl, skipCurrentOrder } from './04-crawl.js';
import { API_BASE, ENV_CONFIG } from './01-config.js';

console.log('');
console.log('==============================================================');
console.log('         BACKGROUND SCRIPT: DA TAI v2.1                 ');
console.log('==============================================================');
console.log('');
console.log('>>> [CONFIG] API_BASE:', API_BASE);
console.log('>>> [CONFIG] ENV:', ENV_CONFIG.mode);

// Rate Limiting
const RATE_LIMIT = {
  requestsPerSecond: 2,    // Tối đa 2 requests/giây
  requestsPerMinute: 50,   // Tối đa 50 requests/phút
  cooldownMs: 500          // Cooldown 500ms giữa các requests
};

let lastRequestTime = 0;
let requestCount = 0;
let lastMinuteReset = Date.now();
let isRateLimited = false;

function resetRateLimit() {
  const now = Date.now();
  if (now - lastMinuteReset >= 60000) {
    requestCount = 0;
    lastMinuteReset = now;
  }
}

function checkRateLimit() {
  resetRateLimit();

  if (isRateLimited) {
    const cooldownRemaining = Math.max(0, RATE_LIMIT.cooldownMs - (Date.now() - lastRequestTime));
    if (cooldownRemaining > 0) {
      return { limited: true, waitMs: cooldownRemaining };
    }
    isRateLimited = false;
  }

  if (requestCount >= RATE_LIMIT.requestsPerMinute) {
    isRateLimited = true;
    return { limited: true, waitMs: 60000 - (Date.now() - lastMinuteReset) };
  }

  return { limited: false };
}

function recordRequest() {
  const now = Date.now();
  if (now - lastRequestTime < RATE_LIMIT.cooldownMs) {
    isRateLimited = true;
  }
  lastRequestTime = now;
  requestCount++;
}

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('>>> [MSG] Nhan message:', message.type);

  if (message.type === 'START_CRAWL') {
    console.log('>>> [MSG] Bat dau crawl');
    startCrawl().then((result) => {
      sendResponse(result);
    });
    return true;

  } else if (message.type === 'STOP_CRAWL') {
    console.log('>>> [MSG] Dung crawl');
    stopCrawl();
    logToPopup('Da dung crawl', 'warn');
    sendResponse({ success: true });

  } else if (message.type === 'SKIP_CURRENT_ORDER') {
    console.log('>>> [MSG] Skip current order');
    skipCurrentOrder();
    logToPopup('Da skip order hien tai', 'warn');
    sendResponse({ success: true });

  } else if (message.type === 'GET_STATUS') {
    const state = getCrawlState();
    const rateLimitStatus = checkRateLimit();
    sendResponse({
      isProcessing: state.isProcessing,
      currentPhone: state.currentPhoneNumber,
      rateLimited: rateLimitStatus.limited,
      rateLimitWait: rateLimitStatus.waitMs
    });

  } else if (message.type === 'CONTENT_LOG') {
    logToPopup('Content: ' + message.text, message.logType || 'info');

  } else if (message.type === 'MESSAGES_EXTRACTED') {
    console.log('>>> [MSG] Tin nhan tu content:', message.messages?.length || 0);
    if (message.error) {
      logToPopup('Loi content: ' + message.error, 'error');
    } else {
      logToPopup('Content: Trich xuat ' + (message.messages?.length || 0) + ' tin nhan', 'info');
    }
  }
});

console.log('');
console.log('==============================================================');
console.log('         BACKGROUND SCRIPT: SAN SANG                     ');
console.log('==============================================================');
console.log('');
