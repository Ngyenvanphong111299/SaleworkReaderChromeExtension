// Step 01: Tìm và thao tác ô search, nút search với DOM caching

function logToUI(text, logType) {
  try { chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: String(text), logType: logType || 'info' }); } catch (_) {}
}

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

logToUI('[CONTENT] 01-search.js loaded');

function findSearchInput() {
  logToUI('[FIND_INPUT] Bắt đầu tìm ô input search...');

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
          logToUI('[FIND_INPUT] Tìm thấy input');
          return input;
        }
      } catch (e) {
        logToUI('[FIND_INPUT] Lỗi selector: ' + e.message, 'warn');
      }
    }
    return null;
  });
}

function fillPhoneNumber(phoneNumber) {
  logToUI('[FILL_PHONE] Bắt đầu nhập SĐT: ' + phoneNumber);

  // Clear cache trước khi tìm lại
  domCache.clear();
  const input = findSearchInput();

  if (input) {
    logToUI('Đã tìm thấy input');

    input.value = '';
    input.value = phoneNumber;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    logToUI('Đã nhập SĐT: ' + phoneNumber, 'success');
    return true;
  }

  logToUI('Không tìm thấy input để nhập số', 'error');
  return false;
}

/** Đóng dialog Salework nếu đang mở (tránh chặn ô search / kết quả) */
function closeSaleworkDialog() {
  const selectors = [
    'body > div.bg-white > div > div > div.el-dialog__wrapper > div > div.el-dialog__header > button',
    '.el-dialog__wrapper .el-dialog__header button',
    '.el-dialog__headerbtn'
  ];
  for (const sel of selectors) {
    try {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        return true;
      }
    } catch (_) {}
  }
  return false;
}

function findAndClickSearchButton() {
  logToUI('[FIND_BUTTON] Đang tìm nút search...');

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
          logToUI('[FIND_BUTTON] Tìm thấy nút search');
          return btn;
        }
      } catch (e) {
        logToUI('[FIND_BUTTON] Lỗi selector: ' + e.message, 'warn');
      }
    }
    return null;
  });
}

// Export for other modules
window.__searchModule = {
  findSearchInput,
  fillPhoneNumber,
  findAndClickSearchButton,
  closeSaleworkDialog
};
