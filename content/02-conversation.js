// Step 02: Tìm và click vào conversation với dynamic waiting

function logToUI(text, logType) {
  try { chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: String(text), logType: logType || 'info' }); } catch (_) {}
}

var CONV_LOAD_MS = 3000;
var RATE_LIMIT_WAIT_MS = 30000;
var RATE_LIMIT_CHECK_INTERVAL_MS = 1000;

// DOM Cache
const domCache = {
  data: new Map(),
  get(key, fn) {
    if (this.data.has(key)) return this.data.get(key);
    const result = fn();
    if (result) this.data.set(key, result);
    return result;
  },
  clear() { this.data.clear(); },
  invalidate(key) { this.data.delete(key); }
};

// Dynamic waiting config
const DYNAMIC_CONFIG = {
  minInterval: 300,
  maxInterval: 1500,
  defaultTimeout: 15000
};

async function waitForCondition(conditionFn, timeout = DYNAMIC_CONFIG.defaultTimeout) {
  const startTime = Date.now();
  let currentInterval = DYNAMIC_CONFIG.minInterval;

  while (Date.now() - startTime < timeout) {
    if (conditionFn()) return true;
    await new Promise(resolve => setTimeout(resolve, currentInterval));
    currentInterval = Math.min(currentInterval * 1.3, DYNAMIC_CONFIG.maxInterval);
  }

  return conditionFn();
}

function findConversation() {
  console.log('');
  console.log('>>> [FIND_CONV] Bắt đầu tìm conversation...');

  return domCache.get('singleConv', () => {
    const convSelectors = [
      ".z2-conv-item-container",
      "[class*='conv-item-container']",
      ".z2-conversation-list > div > div:first-child",
      ".z2-conversation-list .z2-conv-item-container:first-child"
    ];

    for (const selector of convSelectors) {
      try {
        const conv = document.querySelector(selector);
        if (conv) {
          console.log('>>> [FIND_CONV] ✓ Tìm thấy conversation!');
          return conv;
        }
      } catch (e) {
        console.log('>>> [FIND_CONV] Lỗi với selector:', selector, e.message);
      }
    }

    console.log('>>> [FIND_CONV] ✗ KHÔNG TÌM THẤY conversation!');
    return null;
  });
}

function findAllConversations() {
  console.log('');
  console.log('>>> [FIND_ALL_CONV] Tìm tất cả conversations...');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dang tim danh sach conversation...', logType: 'info' });

  // Invalidate cache để đảm bảo fresh data
  domCache.invalidate('allConvs');

  // Chỉ dùng .z2-conversation-list - danh sách thực sự, tránh match search bar
  const convList = document.querySelector('.z2-conversation-list') ||
    document.querySelector('.z2-conver-list-container .z2-conversation-list');

  if (!convList) {
    console.log('>>> [FIND_ALL_CONV] ✗ Không tìm thấy danh sách conversation');
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG tim thay danh sach conversation!', logType: 'error' });
    return [];
  }

  // Cấu trúc: .z2-conversation-list > div (wrapper) > div.z2-conv-item-container (mỗi item)
  let allConvs = convList.querySelectorAll('.z2-conv-item-container');
  if (allConvs.length === 0) {
    allConvs = convList.querySelectorAll('[class*="conv-item-container"]');
  }
  if (allConvs.length === 0) {
    allConvs = convList.querySelectorAll('.pointer.hover-highlight.border-bottom');
  }
  if (allConvs.length === 0) {
    allConvs = convList.querySelectorAll(':scope > div > div.pointer');
  }
  if (allConvs.length === 0) {
    allConvs = convList.querySelectorAll(':scope > div > div');
    if (allConvs.length > 0) {
      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Fallback: lay ' + allConvs.length + ' children', logType: 'info' });
    }
  }
  // Fallback cuối: tìm theo name-conversation
  if (allConvs.length === 0) {
    const nameEls = convList.querySelectorAll('.name-conversation');
    const rows = [];
    nameEls.forEach(function (el) {
      const row = el.closest('.z2-conv-item-container') ||
        el.closest('.pointer.hover-highlight') ||
        el.closest('[class*="conv-item"]') ||
        el.closest('.border-bottom.pointer');
      if (row && !rows.includes(row)) rows.push(row);
    });
    allConvs = rows;
    if (allConvs.length > 0) {
      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Fallback name-conversation: ' + allConvs.length + ' item', logType: 'info' });
    }
  }

  // Filter out search input
  let result = Array.from(allConvs).filter(function (el) {
    return !el.querySelector('input[type="search"], input[placeholder*="tìm"], input[placeholder*="search"]');
  });
  if (result.length === 0 && allConvs.length > 0) {
    result = Array.from(allConvs);
  }

  const count = result.length;
  chrome.runtime.sendMessage({
    type: 'CONTENT_LOG',
    text: 'Tim thay ' + count + ' conversation' + (count === 0 ? ' (khong co ket qua)' : ''),
    logType: count > 0 ? 'success' : 'warn'
  });

  // Cache kết quả
  if (result.length > 0) {
    domCache.data.set('allConvs', result);
  }

  return result;
}

function getMessageCountForRateLimit() {
  let c = document.querySelectorAll('.z2-message-container');
  if (c.length === 0) c = document.querySelectorAll('[class*="message-container"]');
  if (c.length === 0) c = document.querySelectorAll('div[class*="z2-message"]');
  return c.length;
}

async function clickConversation(conv, index, total) {
  const msg = 'Click vao conversation ' + (index + 1) + '/' + total + '...';
  console.log('>>> [CLICK_CONV] ' + msg);
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: msg, logType: 'info' });

  conv.click();

  // Poll mỗi 1s, tối đa 30s - nếu không có message = rate limit
  const hasMessage = await waitForCondition(
    () => getMessageCountForRateLimit() >= 1,
    RATE_LIMIT_WAIT_MS,
    RATE_LIMIT_CHECK_INTERVAL_MS,
    RATE_LIMIT_CHECK_INTERVAL_MS
  );

  if (!hasMessage) {
    console.log('>>> [CLICK_CONV] Rate limit: Khong co tin nhan sau ' + (RATE_LIMIT_WAIT_MS / 1000) + 's');
    chrome.runtime.sendMessage({
      type: 'CONTENT_LOG',
      text: 'Rate limit: Khong co tin nhan sau ' + (RATE_LIMIT_WAIT_MS / 1000) + 's - Reload trang va thu lai...',
      logType: 'warn'
    });
    return { rateLimit: true };
  }

  console.log('>>> [CLICK_CONV] ✓ Đã load conversation (có tin nhắn)');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da load conversation ' + (index + 1), logType: 'info' });
  return { success: true };
}

// Export
window.__conversationModule = {
  findConversation,
  findAllConversations,
  clickConversation
};
