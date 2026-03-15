// Step 04: Logic crawl - processPhone, startCrawl (Optimized + Robust)

import { TIMING, ENV_CONFIG } from './01-config.js';
import { logToPopup } from './02-utils.js';
import { fetchOneOrder, saveMessages, markOrderAsCrawled } from './03-api.js';

let currentPhoneNumber = null;
let isProcessing = false;

// Circuit Breaker state
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5; // Dừng sau 5 lần thất bại liên tiếp

export function getCrawlState() {
  return { isProcessing, currentPhoneNumber, consecutiveFailures };
}

export function setCrawlState(processing, phone = null) {
  isProcessing = processing;
  currentPhoneNumber = phone;
}

export function stopCrawl() {
  isProcessing = false;
  consecutiveFailures = 0; // Reset circuit breaker
}

function resetCircuitBreaker() {
  consecutiveFailures = 0;
}

function incrementFailure() {
  consecutiveFailures++;
  console.log('>>> [CIRCUIT] consecutiveFailures:', consecutiveFailures);
}

function isCircuitOpen() {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
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

export async function processPhone(phoneNumber) {
  console.log('');
  console.log('==============================================================');
  console.log('  [PROCESS] XU LY SDT: ' + phoneNumber);
  console.log('==============================================================');

  logToPopup('=== Bat dau xu ly SDT: ' + phoneNumber + ' ===', 'info');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('>>> [PROCESS] So tabs:', tabs.length);

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
        console.log('>>> [INJECT] Attempt', attempt, 'failed:', e.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!scriptInjected) {
      logToPopup('Loi inject script!', 'error');
      incrementFailure();
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
      console.log('>>> [SEND_MSG] Error:', e.message);
      result = { success: false, messages: [], error: e.message };
    }

    if (result.error) {
      logToPopup('Loi: ' + result.error, 'error');
      incrementFailure();
    } else {
      resetCircuitBreaker(); // Thành công → reset counter
    }

    const messageCount = result?.messages?.length || 0;
    const conversationsCount = result?.conversationsCount || 0;
    logToPopup('Trich xuat: ' + messageCount + ' tin nhan (' + conversationsCount + ' cuoc hoi thoai)', messageCount > 0 ? 'info' : 'warn');

    return { messages: result?.messages || [], conversationsCount };

  } catch (e) {
    console.log('>>> [PROCESS] Loi:', e.message);
    logToPopup('Loi: ' + e.message, 'error');
    incrementFailure();
    return null;
  }
}

export async function startCrawl() {
  console.log('');
  console.log('==============================================================');
  console.log('  [START] BAT DAU CRAWL (ROBUST)                         ');
  console.log('==============================================================');

  if (isProcessing) {
    logToPopup('Dang xu ly...', 'warn');
    return { success: false, error: 'Dang xu ly' };
  }

  // Kiểm tra circuit breaker
  if (isCircuitOpen()) {
    logToPopup('Circuit breaker OPEN! Da qua ' + MAX_CONSECUTIVE_FAILURES + ' loi lien tiep. Vui long thu lai sau!', 'error');
    return { success: false, error: 'Circuit breaker open' };
  }

  isProcessing = true;
  resetCircuitBreaker();

  let totalCrawled = 0;
  let totalConversations = 0;
  let totalMessages = 0;

  while (isProcessing) {
    // Kiểm tra circuit breaker trong mỗi vòng lặp
    if (isCircuitOpen()) {
      logToPopup('Circuit breaker triggered! Dung lai sau ' + MAX_CONSECUTIVE_FAILURES + ' loi.', 'error');
      break;
    }

    logToPopup('=== Lay don tiep theo... ===', 'info');

    try {
      const result = await fetchOneOrder();

      if (!result || !result.phoneNumber) {
        logToPopup('Khong con don nao de xu ly!', 'warn');
        break;
      }

      const { order, phoneNumber } = result;
      currentPhoneNumber = phoneNumber;
      totalCrawled++;

      chrome.runtime.sendMessage({
        type: 'STATUS_UPDATE',
        status: 'processing',
        current: totalCrawled,
        total: totalCrawled,
        phone: phoneNumber
      });

      logToPopup('Xu ly SDT: ' + phoneNumber + ' (don ' + totalCrawled + ')', 'info');

      const processResult = await processPhone(phoneNumber);
      const messages = processResult?.messages || [];
      const convCount = processResult?.conversationsCount || 0;

      totalConversations += convCount;
      totalMessages += messages.length;

      const orderId = order.id || order.Id;
      await markOrderAsCrawled(orderId, messages.length);

      if (messages.length > 0) {
        const saved = await saveMessages(phoneNumber, messages);
        if (saved) {
          logToPopup('Da luu ' + messages.length + ' tin nhan', 'success');
        }
      } else {
        logToPopup('Khong co tin nhan de luu', 'warn');
      }

      // Sử dụng dynamic delay thay vì fixed
      logToPopup('Doi ' + (TIMING.BETWEEN_ORDERS / 1000) + 's roi tiep tuc...', 'info');
      await new Promise(r => setTimeout(r, TIMING.BETWEEN_ORDERS));

      currentPhoneNumber = null;

    } catch (e) {
      console.log('>>> [CRAWL] Loop error:', e.message);
      logToPopup('Loi: ' + e.message, 'error');
      incrementFailure();
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
