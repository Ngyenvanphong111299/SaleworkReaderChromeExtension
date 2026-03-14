// Step 02: Tìm và click vào conversation

var CONV_LOAD_MS = 3000;

console.log('>>> [CONTENT] 02-conversation.js loaded');

function findConversation() {
  console.log('');
  console.log('>>> [FIND_CONV] Bắt đầu tìm conversation...');

  const convSelectors = [
    ".z2-conv-item-container",
    "[class*='conv-item-container']",
    ".z2-conversation-list > div > div:first-child",
    ".z2-conversation-list .z2-conv-item-container:first-child"
  ];

  for (let i = 0; i < convSelectors.length; i++) {
    try {
      const conv = document.querySelector(convSelectors[i]);
      if (conv) {
        console.log('>>> [FIND_CONV] ✓ Tìm thấy conversation!');
        return conv;
      }
    } catch (e) {
      console.log('>>> [FIND_CONV] Lỗi với selector:', convSelectors[i], e.message);
    }
  }

  console.log('>>> [FIND_CONV] ✗ KHÔNG TÌM THẤY conversation!');
  return null;
}

function findAllConversations() {
  console.log('');
  console.log('>>> [FIND_ALL_CONV] Tìm tất cả conversations...');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dang tim danh sach conversation...', logType: 'info' });

  // Chỉ dùng .z2-conversation-list - danh sách thực sự, tránh match search bar
  const convList = document.querySelector('.z2-conversation-list') ||
    document.querySelector('.z2-conver-list-container .z2-conversation-list');

  if (!convList) {
    console.log('>>> [FIND_ALL_CONV] ✗ Không tìm thấy danh sách conversation');
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG tim thay danh sach conversation!', logType: 'error' });
    return [];
  }

  // Cấu trúc: .z2-conversation-list > div (wrapper) > div.z2-conv-item-container (mỗi item)
  // Trường hợp 1 kết quả: cấu trúc có thể tương tự nhưng cần thêm fallback
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
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Fallback: lay ' + allConvs.length + ' children', logType: 'info' });
  }
  // Fallback cuối: tìm theo name-conversation (có trong cả list và single)
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
  return result;
}

async function clickConversation(conv, index, total) {
  const msg = 'Click vao conversation ' + (index + 1) + '/' + total + '...';
  console.log('>>> [CLICK_CONV] ' + msg);
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: msg, logType: 'info' });

  conv.click();
  await new Promise(r => setTimeout(r, CONV_LOAD_MS));
  console.log('>>> [CLICK_CONV] ✓ Đã load conversation');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da load conversation ' + (index + 1), logType: 'info' });
}
