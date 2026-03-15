// Step 05: Background script - Entry point, message handling (v2.1)

import { logToPopup } from './02-utils.js';
import { getCrawlState, stopCrawl, startCrawl, skipCurrentOrder } from './04-crawl.js';
import { getConfig, refreshConfig, getApiBase, ENV_CONFIG } from './01-config.js';
import { initSettings } from './00-settings.js';

// Init settings trước khi sử dụng
initSettings().then((settings) => {
  logToPopup('Background script v2.1 đã tải. API: ' + settings.apiBaseUrl, 'info');
});

logToPopup('Background script v2.1 đang khởi tạo...', 'info');

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
  if (message.type === 'START_CRAWL') {
    const orderLimit = message.orderLimit ?? 99999;
    logToPopup('[MSG] Bắt đầu crawl (tối đa ' + orderLimit + ' đơn)', 'info');
    startCrawl(orderLimit).then((result) => {
      sendResponse(result);
    });
    return true;

  } else if (message.type === 'STOP_CRAWL') {
    stopCrawl();
    logToPopup('Da dung crawl', 'warn');
    sendResponse({ success: true });

  } else if (message.type === 'SKIP_CURRENT_ORDER') {
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
    if (message.error) {
      logToPopup('Loi content: ' + message.error, 'error');
    } else {
      logToPopup('Content: Trich xuat ' + (message.messages?.length || 0) + ' tin nhan', 'info');
    }
  }
});

logToPopup('Background script sẵn sàng', 'info');
