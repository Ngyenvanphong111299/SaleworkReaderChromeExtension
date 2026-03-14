// Step 01: Tìm và thao tác ô search, nút search

console.log('>>> [CONTENT] 01-search.js loaded');

function findSearchInput() {
  console.log('');
  console.log('>>> [FIND_INPUT] Bắt đầu tìm ô input search...');
  console.log('>>> [FIND_INPUT] URL hiện tại:', window.location.href);

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

  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    try {
      const input = document.querySelector(selector);
      if (input) {
        console.log('>>> [FIND_INPUT] ✓ Tìm thấy input!');
        return input;
      }
    } catch (e) {
      console.log('>>> [FIND_INPUT] Lỗi với selector:', selector, e.message);
    }
  }
  console.log('>>> [FIND_INPUT] ✗ KHÔNG TÌM THẤY input search!');
  return null;
}

function fillPhoneNumber(phoneNumber) {
  console.log('');
  console.log('>>> [FILL_PHONE] Bắt đầu nhập số điện thoại:', phoneNumber);

  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dang tim input...', logType: 'info' });

  const input = findSearchInput();
  if (input) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'DA TIM THAY INPUT!', logType: 'info' });

    input.value = '';
    input.value = phoneNumber;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

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

  const searchSelectors = [
    'button[type="submit"]',
    '#conversation-page-v2 button',
    'button i[class*="search"]',
    '.z2-search-button',
    'button[class*="search"]',
    'button:has(i[class*="search"])',
    '.z2-conver-list-container button'
  ];

  for (let i = 0; i < searchSelectors.length; i++) {
    const selector = searchSelectors[i];
    try {
      const btn = document.querySelector(selector);
      if (btn) {
        console.log('>>> [FIND_BUTTON] ✓ Tìm thấy button!');
        btn.click();
        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da click nut search!', logType: 'info' });
        return true;
      }
    } catch (e) {
      console.log('>>> [FIND_BUTTON] Lỗi với selector:', selector, e.message);
    }
  }
  console.log('>>> [FIND_BUTTON] ✗ KHÔNG TÌM THẤY nút search!');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG tim thay nut search!', logType: 'error' });
  return false;
}
