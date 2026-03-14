// Step 03: API functions - gọi backend

import { API_BASE } from './01-config.js';
import { logToPopup, getPhoneFromOrder } from './02-utils.js';

export async function fetchOneOrder(maxRetries = 50) {
  console.log('');
  console.log('==============================================================');
  console.log('  [API] LAY 1 DON DE XU LY                           ');
  console.log('==============================================================');

  let retries = 0;

  while (retries < maxRetries) {
    try {
      const url = API_BASE + '/salework/erp/orders/uncrawled?limit=1';
      console.log('>>> [API] URL:', url);

      const response = await fetch(url);
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
        retries++;
        logToPopup('Don ' + retries + ' - SDT rong (bo qua)...', 'warn');

        const skipOrderId = order.id || order.Id;
        if (skipOrderId) {
          await markOrderAsCrawled(skipOrderId, 0);
        }
        console.log('>>> [API] Skip don rong, tiep tuc lay don khac...');
        continue;
      }

      logToPopup('Don tiep theo - SDT: ' + phoneNumber, 'info');
      return { order, phoneNumber };

    } catch (e) {
      console.log('>>> [API] Loi:', e.message);
      logToPopup('Loi API: ' + e.message, 'error');
      return null;
    }
  }

  logToPopup('Khong tim thay don nao voi SDT!', 'error');
  return null;
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

    const response = await fetch(API_BASE + '/salework/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

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
    const response = await fetch(API_BASE + '/salework/orders/crawled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderId, messageCount: messageCount })
    });

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
