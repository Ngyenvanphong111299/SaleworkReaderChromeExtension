// Step 05: Background script - Entry point, message handling (v2.1)

import { logToPopup } from './02-utils.js';
import { getCrawlState, stopCrawl, startCrawl, skipCurrentOrder } from './04-crawl.js';
import { API_BASE, ENV_CONFIG } from './01-config.js';

logToPopup('Background script v2.1 đã tải. ENV: ' + ENV_CONFIG.mode, 'info');

// Keep-alive: Chrome MV3 service worker bị kill sau ~30s idle. Crawl dài (scroll nhiều) khiến worker chết
// → "message channel closed before response received". Alarm mỗi 20s giữ worker sống.
const KEEP_ALIVE_ALARM = 'crawl-keep-alive';
const KEEP_ALIVE_PERIOD_MINUTES = 0.5; // 30 giây - tối thiểu theo Chrome

function startKeepAlive() {
  chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: KEEP_ALIVE_PERIOD_MINUTES });
}

function stopKeepAlive() {
  chrome.alarms.clear(KEEP_ALIVE_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // No-op - chỉ cần handler chạy để giữ worker alive
  }
});

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
    startKeepAlive();
    startCrawl(orderLimit)
      .then((result) => {
        sendResponse(result);
      })
      .catch((err) => {
        sendResponse({ success: false, error: err?.message || 'Lỗi' });
      })
      .finally(() => {
        stopKeepAlive();
      });
    return true;

  } else if (message.type === 'STOP_CRAWL') {
    stopCrawl();
    stopKeepAlive();
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
  } else if (message.type === 'GET_CAPTURED_AAC_URLS') {
    sendResponse({ urls: [...capturedAacUrls] });
  } else if (message.type === 'CLEAR_CAPTURED_AAC_URLS') {
    capturedAacUrls.length = 0;
    sendResponse({ ok: true });
  }
  return true;
});

// Lưu tất cả URL *.aac đã bắt được (khi user click play trên Salework)
const capturedAacUrls = [];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url || '';
    if (!/\.aac$/i.test(url) || !url.includes('zdn.vn')) return;
    if (!capturedAacUrls.includes(url)) {
      capturedAacUrls.push(url);
      logToPopup('Bắt được .aac: ' + url.slice(-30), 'success');
    }
    if (details.tabId > 0) {
      chrome.tabs.sendMessage(details.tabId, { type: 'AUDIO_URL_CAPTURED', url }).catch(() => {});
    }
  },
  { urls: ['<all_urls>'] }
);

logToPopup('Background script sẵn sàng', 'info');
