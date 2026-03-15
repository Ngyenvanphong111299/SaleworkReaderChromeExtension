// Step 02: Tìm và click vào conversation với dynamic waiting

var CONV_LOAD_MS = 3000;

console.log('>>> [CONTENT] 02-conversation.js loaded');

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

async function clickConversation(conv, index, total) {
  const msg = 'Click vao conversation ' + (index + 1) + '/' + total + '...';
  console.log('>>> [CLICK_CONV] ' + msg);
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: msg, logType: 'info' });

  conv.click();

  // Thay vì cố định 3s, dùng dynamic waiting
  await waitForCondition(
    () => {
      // Kiểm tra conversation đã load chưa
      const msgContainer = document.querySelector('.z2-message-container, [class*="message-container"]');
      return msgContainer !== null;
    },
    8000 // 8s timeout
  );

  console.log('>>> [CLICK_CONV] ✓ Đã load conversation');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da load conversation ' + (index + 1), logType: 'info' });
}

// Export
window.__conversationModule = {
  findConversation,
  findAllConversations,
  clickConversation
};
