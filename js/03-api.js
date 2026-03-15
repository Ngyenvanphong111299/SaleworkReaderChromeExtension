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
        console.log(`>>> [API] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function fetchOneOrder(maxRetries = 5) {
  console.log('');
  console.log('==============================================================');
  console.log('  [API] LAY 1 DON DE XU LY                           ');
  console.log('==============================================================');

  const retryCount = { current: 0 };

  async function attemptFetch() {
    retryCount.current++;

    const url = API_BASE + '/salework/erp/orders/uncrawled?limit=1';
    console.log('>>> [API] URL:', url);

    try {
      const response = await fetchWithRetry(url, {}, 3, 800);
      console.log('>>> [API] Response status:', response.status);

      if (!response.ok) {
        throw new Error('API error: ' + response.status);
      }

      const data = await response.json();
      const orders = Array.isArray(data) ? data : (data.value || []);

      console.log('>>> [API] Orders count:', orders.length);

      if (orders.length === 0) {
        logToPopup('Khong con don nao!', 'warn');
        return null;
      }

      const order = orders[0];
      const phoneNumber = getPhoneFromOrder(order);

      console.log('>>> [API] PhoneNumber:', phoneNumber, '| Order:', JSON.stringify(order).substring(0, 200));

      if (!phoneNumber || phoneNumber.length === 0) {
        logToPopup('Don ' + retryCount.current + ' - SDT rong (bo qua)...', 'warn');

        const skipOrderId = order.id || order.Id;
        if (skipOrderId) {
          await markOrderAsCrawled(skipOrderId, 0);
        }
        console.log('>>> [API] Skip don rong, tiep tuc lay don khac...');

        // Recursive retry với maxRetries thay vì loop
        if (retryCount.current < maxRetries) {
          return attemptFetch();
        }
        return null;
      }

      logToPopup('Don tiep theo - SDT: ' + phoneNumber, 'info');
      return { order, phoneNumber };

    } catch (e) {
      console.log('>>> [API] Loi:', e.message);

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

export async function saveMessages(phoneNumber, messages) {
  console.log('>>> [API] Luu tin nhan cho SDT:', phoneNumber);
  console.log('>>> [API] So tin nhan:', messages?.length || 0);

  if (messages && messages.length > 0) {
    console.log('>>> [API] First message sample:', JSON.stringify(messages[0]).substring(0, 200));
  }

  try {
    const requestBody = {
      phoneNumber: phoneNumber,
      messages: messages,
      replaceExisting: true
    };
    console.log('>>> [API] Request body:', JSON.stringify(requestBody).substring(0, 500));

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

    console.log('>>> [API] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('>>> [API] Error response:', errorText);
      throw new Error('API error: ' + response.status + ' - ' + errorText);
    }

    await response.json();
    logToPopup('Da luu ' + messages.length + ' tin nhan', 'info');
    return true;
  } catch (e) {
    console.log('>>> [API] Exception:', e.message);
    logToPopup('Loi luu: ' + e.message, 'error');
    return false;
  }
}

export async function markOrderAsCrawled(orderId, messageCount) {
  console.log('>>> [API] Danh dau da crawl cho orderId:', orderId);

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

    console.log('>>> [API] Da danh dau crawl thanh cong');
    return true;
  } catch (e) {
    console.log('>>> [API] Loi danh dau:', e.message);
    return false;
  }
}
