// Step 04: Logic crawl - processPhone, startCrawl (Optimized + Robust)

import { TIMING, ENV_CONFIG } from './01-config.js';
import { logToPopup } from './02-utils.js';
import { fetchOneOrder, saveMessages, markOrderAsCrawled } from './03-api.js';

let currentPhoneNumber = null;
let isProcessing = false;

export function getCrawlState() {
  return { isProcessing, currentPhoneNumber };
}

export function setCrawlState(processing, phone = null) {
  isProcessing = processing;
  currentPhoneNumber = phone;
}

export function stopCrawl() {
  isProcessing = false;
}

let shouldSkipCurrentOrder = false;

export function skipCurrentOrder() {
  shouldSkipCurrentOrder = true;
}

function resetSkipFlag() {
  shouldSkipCurrentOrder = false;
}

/**
 * Gửi message tới content script với timeout
 */
function sendMessageWithTimeout(tabId, message, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Message timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response || { success: false, messages: [], error: 'No response' });
      }
    });
  });
}

/**
 * Chờ tab load xong sau khi reload
 */
function waitForTabLoad(tabId, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeoutId);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
  });
}

export async function processPhone(phoneNumber, rateLimitRetryCount = 0) {
  logToPopup('=== Bắt đầu xử lý SDT: ' + phoneNumber + ' ===', 'info');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tabs[0]) {
      logToPopup('Khong tim thay tab!', 'error');
      return null;
    }

    const tabId = tabs[0].id;
    const tabUrl = tabs[0].url || '';

    if (!tabUrl.includes('salework.net')) {
      logToPopup('Dang chuyen den Salework...', 'info');
      await chrome.tabs.update(tabId, { url: 'https://zalo.salework.net/' });
      await new Promise(r => setTimeout(r, TIMING.SALEWORK_LOAD));
    }

    logToPopup('Dang inject script...', 'info');

    // Optimized: Inject 1 bundle thay vì 5 files riêng biệt
    // Với retry nếu fail
    let scriptInjected = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/bundle.js']
        });
        scriptInjected = true;
        break;
      } catch (e) {
        logToPopup('[INJECT] Lần ' + attempt + ' thất bại: ' + e.message, 'warn');
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!scriptInjected) {
      logToPopup('Loi inject script!', 'error');
      return null;
    }

    await new Promise(r => setTimeout(r, TIMING.SCRIPT_INJECT_DELAY));

    logToPopup('Dien SDT: ' + phoneNumber + ' va tim kiem...', 'info');

    let result;
    try {
      // Sử dụng timeout cho sendMessage
      result = await sendMessageWithTimeout(
        tabId,
        { type: 'FILL_AND_SEARCH', phoneNumber: phoneNumber },
        TIMING.PROCESS_WAIT
      );
    } catch (e) {
      logToPopup('[SEND_MSG] Lỗi: ' + e.message, 'error');
      result = { success: false, messages: [], error: e.message };
    }

    if (result.error) {
      logToPopup('Loi: ' + result.error, 'error');
    }

    // Rate limit: reload trang và thử lại từ đầu
    if (result?.rateLimit) {
      const maxRetry = TIMING.RATE_LIMIT_RETRY_MAX ?? 3;
      if (rateLimitRetryCount >= maxRetry) {
        logToPopup('Rate limit: Da thu lai ' + maxRetry + ' lan, bo qua SDT nay', 'error');
        return null;
      }

      logToPopup('Rate limit phat hien! Reload trang va thu lai (lan ' + (rateLimitRetryCount + 1) + '/' + maxRetry + ')...', 'warn');
      const loadPromise = waitForTabLoad(tabId);
      await chrome.tabs.reload(tabId);
      await loadPromise;
      await new Promise(r => setTimeout(r, TIMING.SALEWORK_LOAD));

      return processPhone(phoneNumber, rateLimitRetryCount + 1);
    }

    const conversations = result?.conversations || [];
    const messageCount = conversations.reduce((s, c) => s + (c.messages?.length || 0), 0);
    const conversationsCount = conversations.length;
    logToPopup('Trich xuat: ' + messageCount + ' tin nhan (' + conversationsCount + ' cuoc hoi thoai)', messageCount > 0 ? 'info' : 'warn');

    return { conversations, conversationsCount };

  } catch (e) {
    logToPopup('Lỗi xử lý: ' + e.message, 'error');
    return null;
  }
}

export async function startCrawl(orderLimit = 99999) {
  if (isProcessing) {
    logToPopup('Dang xu ly...', 'warn');
    return { success: false, error: 'Dang xu ly' };
  }

  isProcessing = true;

  let totalCrawled = 0;
  let totalConversations = 0;
  let totalMessages = 0;
  let lastOrderProcessTime = 0;

  while (isProcessing) {
    // Reset skip flag at start of each iteration
    resetSkipFlag();

    logToPopup('=== Lay don tiep theo... ===', 'info');

    try {
      const startTime = Date.now();
      const result = await fetchOneOrder();

      if (!result || !result.phoneNumber) {
        logToPopup('Khong con don nao de xu ly!', 'warn');
        break;
      }

      const { order, phoneNumber } = result;
      currentPhoneNumber = phoneNumber;
      totalCrawled++;

      if (totalCrawled > orderLimit) {
        logToPopup('Da dat gioi han ' + orderLimit + ' don, dung lai', 'info');
        break;
      }

      chrome.runtime.sendMessage({
        type: 'STATUS_UPDATE',
        status: 'processing',
        current: totalCrawled,
        total: totalCrawled,
        phone: phoneNumber,
        lastOrderTime: lastOrderProcessTime
      });

      logToPopup('Xu ly SDT: ' + phoneNumber + ' (don ' + totalCrawled + ')', 'info');

      const processResult = await processPhone(phoneNumber);

      // Check if we should skip this order
      if (shouldSkipCurrentOrder) {
        logToPopup('Skip order: ' + phoneNumber, 'warn');
        resetSkipFlag();
        continue;
      }

      const conversations = processResult?.conversations || [];
      const messageCount = conversations.reduce((s, c) => s + (c.messages?.length || 0), 0);
      const convCount = processResult?.conversationsCount || 0;

      // Track time for ETA
      lastOrderProcessTime = Date.now() - startTime;

      totalConversations += convCount;
      totalMessages += messageCount;

      const orderId = order.id || order.Id;

      // Chỉ đánh dấu crawled trong 2 trường hợp:
      // 1. Thành công: đã crawl đầy đủ tin nhắn (conversations.length > 0)
      // 2. Search phone nhưng không có conversation nào (conversations.length === 0, processResult != null)
      // Không đánh dấu khi processResult = null (lỗi, rate limit, inject fail...)
      const shouldMarkCrawled = processResult != null;
      if (shouldMarkCrawled) {
        await markOrderAsCrawled(orderId, messageCount);
      } else {
        logToPopup('Crawl that bai - KHONG danh dau don da crawl, se thu lai sau', 'warn');
      }

      if (conversations.length > 0) {
        const saved = await saveMessages(phoneNumber, conversations);
        if (saved) {
          logToPopup('Da luu ' + messageCount + ' tin nhan', 'success');
        }
      } else {
        logToPopup('Khong co tin nhan de luu', 'warn');
      }

      // Sử dụng dynamic delay thay vì fixed
      logToPopup('Doi ' + (TIMING.BETWEEN_ORDERS / 1000) + 's roi tiep tuc...', 'info');
      await new Promise(r => setTimeout(r, TIMING.BETWEEN_ORDERS));

      currentPhoneNumber = null;

    } catch (e) {
      logToPopup('Lỗi vòng lặp: ' + e.message, 'error');
    }
  }

  isProcessing = false;

  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    status: 'done',
    totalOrders: totalCrawled,
    totalConversations,
    totalMessages
  });

  logToPopup('=== HOAN THANH TAT CA ===', 'success');
  logToPopup('Don: ' + totalCrawled + ' | Hoi thoai: ' + totalConversations + ' | Tin nhan: ' + totalMessages, 'success');

  return { success: true, count: totalCrawled, totalConversations, totalMessages };
}
