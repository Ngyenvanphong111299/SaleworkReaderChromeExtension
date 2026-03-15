// Step 01: Tìm và thao tác ô search, nút search với DOM caching

// Import dynamic waiting từ config (inline vì đây là content script)
const DYNAMIC_CONFIG = {
  minInterval: 300,
  maxInterval: 1500,
  defaultTimeout: 10000
};

async function waitForCondition(conditionFn, timeout = DYNAMIC_CONFIG.defaultTimeout, initialInterval = DYNAMIC_CONFIG.minInterval) {
  const startTime = Date.now();
  let currentInterval = initialInterval;

  while (Date.now() - startTime < timeout) {
    if (conditionFn()) return true;
    await new Promise(resolve => setTimeout(resolve, currentInterval));
    currentInterval = Math.min(currentInterval * 1.3, DYNAMIC_CONFIG.maxInterval);
  }

  return conditionFn();
}

// DOM Cache - tránh query lại nhiều lần
const domCache = {
  data: new Map(),
  get(key, fn) {
    if (this.data.has(key)) return this.data.get(key);
    const result = fn();
    if (result) this.data.set(key, result);
    return result;
  },
  clear() { this.data.clear(); }
};

console.log('>>> [CONTENT] 01-search.js loaded');

function findSearchInput() {
  console.log('');
  console.log('>>> [FIND_INPUT] Bắt đầu tìm ô input search...');
  console.log('>>> [FIND_INPUT] URL hiện tại:', window.location.href);

  // Sử dụng cache để tránh query lại
  return domCache.get('searchInput', () => {
    const selectors = [
      "#conversation-page-v2 > div.z2-conver-list-container > div:nth-child(1) > div.flex-container-line.px-12.pb-2.pt-1 > div > input",
      "input[placeholder*='tìm']",
      "input[placeholder*='search']",
      "input[type='search']",
      "#conversation-page-v2 input",
      "input.px-12",
      ".z2-search-input",
      "input[class*='search']"
    ];

    for (const selector of selectors) {
      try {
        const input = document.querySelector(selector);
        if (input) {
          console.log('>>> [FIND_INPUT] ✓ Tìm thấy input với selector:', selector);
          return input;
        }
      } catch (e) {
        console.log('>>> [FIND_INPUT] Lỗi với selector:', selector, e.message);
      }
    }
    return null;
  });
}

function fillPhoneNumber(phoneNumber) {
  console.log('');
  console.log('>>> [FILL_PHONE] Bắt đầu nhập số điện thoại:', phoneNumber);

  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dang tim input...', logType: 'info' });

  // Clear cache trước khi tìm lại
  domCache.clear();
  const input = findSearchInput();

  if (input) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'DA TIM THAY INPUT!', logType: 'info' });

    input.value = '';
    input.value = phoneNumber;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    console.log('>>> [FILL_PHONE] ✓ HOÀN THÀNH nhập số!');
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da dien SDT: ' + phoneNumber, logType: 'info' });
    return true;
  }

  console.log('>>> [FILL_PHONE] ✗ KHÔNG THỂ nhập số - không tìm thấy input');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG TIM THAY INPUT!', logType: 'error' });
  return false;
}

function findAndClickSearchButton() {
  console.log('');
  console.log('>>> [FIND_BUTTON] Bắt đầu tìm nút search...');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dang tim nut search...', logType: 'info' });

  // Sử dụng cache
  return domCache.get('searchButton', () => {
    const searchSelectors = [
      'button[type="submit"]',
      '#conversation-page-v2 button',
      'button i[class*="search"]',
      '.z2-search-button',
      'button[class*="search"]',
      'button:has(i[class*="search"])',
      '.z2-conver-list-container button'
    ];

    for (const selector of searchSelectors) {
      try {
        const btn = document.querySelector(selector);
        if (btn) {
          console.log('>>> [FIND_BUTTON] ✓ Tìm thấy button với selector:', selector);
          return btn;
        }
      } catch (e) {
        console.log('>>> [FIND_BUTTON] Lỗi với selector:', selector, e.message);
      }
    }
    return null;
  });
}

// Export for other modules
window.__searchModule = {
  findSearchInput,
  fillPhoneNumber,
  findAndClickSearchButton
};
