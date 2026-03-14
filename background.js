// Background script - Xử lý logic chính cho Salework Message Crawler

console.log('');
console.log('==============================================================');
console.log('         BACKGROUND SCRIPT: DA TAI                      ');
console.log('==============================================================');
console.log('');

// ============ CONFIG ============
const API_BASE = 'http://localhost:5153/api/v1';

console.log('>>> [CONFIG] API_BASE:', API_BASE);

// ============ STATE ============
let currentPhoneNumber = null;
let isProcessing = false;

console.log('>>> [STATE] isProcessing:', isProcessing);

// ============ LOG TO POPUP ============
function logToPopup(message, type = 'info') {
  chrome.runtime.sendMessage({
    type: 'LOG_MESSAGE',
    message: message,
    logType: type
  });
}

// ============ HELPER FUNCTIONS ============
function getPhoneFromOrder(order) {
  return order.phoneNumber || order.phone || order.phone_number || null;
}

console.log('>>> [STATE] isProcessing:', isProcessing);
console.log('>>> [STATE] currentPhoneNumber:', currentPhoneNumber);

// ============ API FUNCTIONS ============

async function fetchOneOrder(limit = 1) {
  console.log('');
  console.log('==============================================================');
  console.log('  [API] LAY 1 DON DE XU LY                           ');
  console.log('==============================================================');

  try {
    const url = API_BASE + '/salework/erp/orders/uncrawled?limit=' + limit;
    console.log('>>> [API] URL:', url);

    const response = await fetch(url);
    console.log('>>> [API] Response status:', response.status);

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

    logToPopup('Don tiep theo - SDT: ' + (phoneNumber || 'khong co'), 'info');

    return { order, phoneNumber };

  } catch (e) {
    console.log('>>> [API] Loi:', e.message);
    logToPopup('Loi API: ' + e.message, 'error');
    return null;
  }
}

async function saveMessages(phoneNumber, messages) {
  console.log('>>> [API] Luu tin nhan cho SDT:', phoneNumber);

  try {
    const response = await fetch(API_BASE + '/salework/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumber, messages: messages })
    });

    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }

    const result = await response.json();
    logToPopup('Da luu ' + messages.length + ' tin nhan', 'info');
    return true;
  } catch (e) {
    logToPopup('Loi luu: ' + e.message, 'error');
    return false;
  }
}

// Danh dau don da crawl (ke ca khi 0 tin nhan)
async function markOrderAsCrawled(phoneNumber, messageCount) {
  console.log('>>> [API] Danh dau da crawl cho SDT:', phoneNumber);

  try {
    const response = await fetch(API_BASE + '/salework/orders/crawled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumber, messageCount: messageCount })
    });

    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }

    logToPopup('Da danh dau crawl (0 tin nhan)', 'info');
    return true;
  } catch (e) {
    logToPopup('Loi danh dau: ' + e.message, 'error');
    return false;
  }
}

// ============ CRAWL LOGIC ============

async function processPhone(phoneNumber) {
  console.log('');
  console.log('==============================================================');
  console.log('  [PROCESS] XU LY SDT: ' + phoneNumber);
  console.log('==============================================================');

  logToPopup('=== Bat dau xu ly SDT: ' + phoneNumber + ' ===', 'info');

  try {
    // Bước 1: Lấy tab hiện tại
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('>>> [PROCESS] So tabs:', tabs.length);

    if (!tabs[0]) {
      logToPopup('Khong tim thay tab!', 'error');
      return null;
    }

    const tabId = tabs[0].id;
    const tabUrl = tabs[0].url || '';

    // Bước 2: Kiểm tra Salework
    if (!tabUrl.includes('salework.net')) {
      logToPopup('Dang chuyen den Salework...', 'info');
      await chrome.tabs.update(tabId, { url: 'https://zalo.salework.net/' });
      await new Promise(r => setTimeout(r, 3000));
    }

    // Bước 3: Inject content script
    logToPopup('Dang inject script...', 'info');
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    await new Promise(r => setTimeout(r, 1000));

    // Bước 4: Gửi message FILL_AND_SEARCH
    logToPopup('Dien SDT: ' + phoneNumber + ' va tim kiem...', 'info');

    await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'FILL_AND_SEARCH',
        phoneNumber: phoneNumber
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('>>> Loi sendMessage:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    });

    // Bước 5: Đợi xử lý (15s)
    logToPopup('Dang cho trich xuat tin nhan...', 'info');

    for (let i = 15; i > 0; i--) {
      await new Promise(r => setTimeout(r, 1000));
    }

    // Bước 6: Trích xuất tin nhắn
    let result;
    try {
      result = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'EXTRACT_MESSAGES'
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
    } catch (e) {
      result = null;
    }

    const messageCount = result?.messages?.length || 0;
    logToPopup('Trich xuat: ' + messageCount + ' tin nhan', 'info');

    return result?.messages || [];

  } catch (e) {
    console.log('>>> [PROCESS] Loi:', e.message);
    logToPopup('Loi: ' + e.message, 'error');
    return null;
  }
}

// ============ ACTION CLICK - OPEN SIDE PANEL ============

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// ============ MESSAGE HANDLING ============

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
    isProcessing = false;
    logToPopup('Da dung crawl', 'warn');
    sendResponse({ success: true });

  } else if (message.type === 'GET_STATUS') {
    sendResponse({
      isProcessing: isProcessing,
      currentPhone: currentPhoneNumber
    });

  } else if (message.type === 'CONTENT_LOG') {
    // Log from content script
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

async function startCrawl() {
  console.log('');
  console.log('==============================================================');
  console.log('  [START] BAT DAU CRAWL                               ');
  console.log('==============================================================');

  if (isProcessing) {
    logToPopup('Dang xu ly...', 'warn');
    return { success: false, error: 'Dang xu ly' };
  }

  isProcessing = true;
  logToPopup('Dang lay don tu API...', 'info');

  // Lay 1 don tu API
  const result = await fetchOneOrder(1);

  if (!result || !result.phoneNumber) {
    logToPopup('Khong con don nao de xu ly!', 'warn');
    isProcessing = false;
    return { success: true, count: 0, message: 'Khong con don' };
  }

  const { order, phoneNumber } = result;
  currentPhoneNumber = phoneNumber;

  // Gui cap nhat trang thai
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    status: 'processing',
    current: 1,
    total: 1,
    phone: phoneNumber
  });

  // Xu ly sdt
  logToPopup('Xu ly SDT: ' + phoneNumber, 'info');

  const messages = await processPhone(phoneNumber);

  if (messages && messages.length > 0) {
    await saveMessages(phoneNumber, messages);
  } else {
    logToPopup('Khong co tin nhan de luu', 'warn');

    // Van goi API danh dau da crawl (vi du lieu trang web co the thay doi)
    await markOrderAsCrawled(phoneNumber, 0);
  }

  isProcessing = false;
  currentPhoneNumber = null;

  // Gui trang thai hoan thanh
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'done' });

  logToPopup('=== HOAN THANH 1 SDT ===', 'success');

  return { success: true, count: 1 };
}

console.log('');
console.log('==============================================================');
console.log('         BACKGROUND SCRIPT: SAN SANG                     ');
console.log('==============================================================');
console.log('');
