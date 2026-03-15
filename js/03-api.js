// Step 03: API functions - gọi backend với timeout và retry

import { API_BASE, TIMING } from './01-config.js';
import { logToPopup, getPhoneFromOrder } from './02-utils.js';

/**
 * Fetch với timeout và AbortController
 * @param {string} url - URL cần fetch
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout (ms)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Fetch với retry logic
 * @param {string} url - URL cần fetch
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Số lần retry tối đa
 * @param {number} baseDelay - Delay cơ bản (ms)
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        // Exponential backoff với jitter
        const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        logToPopup(`[API] Retry ${attempt + 1}/${maxRetries} sau ${Math.round(delay)}ms: ${error.message}`, 'warn');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function fetchOneOrder(maxRetries = 5) {
  const retryCount = { current: 0 };

  async function attemptFetch() {
    retryCount.current++;

    const url = API_BASE + '/salework/erp/orders/uncrawled?limit=1';
    logToPopup('[API] Lấy 1 đơn chưa crawl...', 'info');

    try {
      const response = await fetchWithRetry(url, {}, 3, 800);

      if (!response.ok) {
        throw new Error('API error: ' + response.status);
      }

      const data = await response.json();
      const orders = Array.isArray(data) ? data : (data.value || []);

      if (orders.length === 0) {
        logToPopup('Khong con don nao!', 'warn');
        return null;
      }

      const order = orders[0];
      const phoneNumber = getPhoneFromOrder(order);

      if (!phoneNumber || phoneNumber.length === 0) {
        logToPopup('Don ' + retryCount.current + ' - SDT rong (bo qua)...', 'warn');

        const skipOrderId = order.id || order.Id;
        if (skipOrderId) {
          await markOrderAsCrawled(skipOrderId, 0);
        }
        logToPopup('[API] Bỏ qua đơn không SĐT, lấy đơn khác...', 'warn');

        // Recursive retry với maxRetries thay vì loop
        if (retryCount.current < maxRetries) {
          return attemptFetch();
        }
        return null;
      }

      logToPopup('Don tiep theo - SDT: ' + phoneNumber, 'info');
      return { order, phoneNumber };

    } catch (e) {
      if (retryCount.current < maxRetries) {
        logToPopup('Loi API: ' + e.message + ', thu lai...', 'error');
        const delay = 1000 * Math.pow(2, retryCount.current - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptFetch();
      }

      logToPopup('Loi API: ' + e.message, 'error');
      return null;
    }
  }

  return attemptFetch();
}

/**
 * Preview payload - không lưu DB, dùng cho Manual Search test
 */
export async function previewMessages(phoneNumber, conversations) {
  const totalMsg = conversations?.reduce((s, c) => s + (c.messages?.length || 0), 0) || 0;
  logToPopup('[API] Preview SDT: ' + phoneNumber + ', ' + (conversations?.length || 0) + ' hội thoại, ' + totalMsg + ' tin nhắn', 'info');

  try {
    const requestBody = {
      phoneNumber: phoneNumber,
      conversations: conversations,
      replaceExisting: true
    };

    const response = await fetchWithRetry(
      API_BASE + '/salework/messages/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      },
      2,
      800
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('API error: ' + response.status + ' - ' + errorText);
    }

    const data = await response.json();
    return data;
  } catch (e) {
    logToPopup('Preview lỗi: ' + e.message, 'error');
    throw e;
  }
}

export async function saveMessages(phoneNumber, conversations) {
  const totalMsg = conversations?.reduce((s, c) => s + (c.messages?.length || 0), 0) || 0;
  logToPopup('[API] Lưu tin nhắn cho SDT: ' + phoneNumber + ', ' + (conversations?.length || 0) + ' hội thoại, ' + totalMsg + ' tin nhắn', 'info');

  try {
    const requestBody = {
      phoneNumber: phoneNumber,
      conversations: conversations,
      replaceExisting: true
    };

    const response = await fetchWithRetry(
      API_BASE + '/salework/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      },
      3,
      1000
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('API error: ' + response.status + ' - ' + errorText);
    }

    await response.json();
    logToPopup('Đã lưu ' + totalMsg + ' tin nhắn', 'info');
    return true;
  } catch (e) {
    logToPopup('Lỗi lưu: ' + e.message, 'error');
    return false;
  }
}

export async function markOrderAsCrawled(orderId, messageCount) {
  try {
    const response = await fetchWithRetry(
      API_BASE + '/salework/orders/crawled',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, messageCount: messageCount })
      },
      2,
      500
    );

    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }

    return true;
  } catch (e) {
    logToPopup('[API] Lỗi đánh dấu đã crawl: ' + e.message, 'error');
    return false;
  }
}
