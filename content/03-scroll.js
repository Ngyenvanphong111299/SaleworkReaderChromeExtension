// Step 03: Scroll để load tin nhắn cũ với dynamic waiting

var MAX_NO_CHANGE = 5;
var SCROLL_WAIT_MS = 4000;
var MAX_SCROLL_ATTEMPTS = 100;
var WAIT_FOR_MESSAGES_MS = 2000;

// Dynamic waiting config
const DYNAMIC_CONFIG = {
  minInterval: 300,
  maxInterval: 1500,
  scrollMaxInterval: 2000,
  scrollTimeout: 30000
};

async function waitForCondition(conditionFn, timeout = DYNAMIC_CONFIG.scrollTimeout, initialInterval = DYNAMIC_CONFIG.minInterval, maxInterval = DYNAMIC_CONFIG.maxInterval) {
  const startTime = Date.now();
  let currentInterval = initialInterval;

  while (Date.now() - startTime < timeout) {
    if (conditionFn()) return true;
    await new Promise(resolve => setTimeout(resolve, currentInterval));
    currentInterval = Math.min(currentInterval * 1.3, maxInterval);
  }

  return conditionFn();
}

function getMessageCount() {
  let containers = document.querySelectorAll('.z2-message-container');
  if (containers.length === 0) containers = document.querySelectorAll('[class*="message-container"]');
  if (containers.length === 0) containers = document.querySelectorAll('div[class*="z2-message"]');
  return containers.length;
}

async function scrollUpToLoadMessages() {
  console.log('');
  console.log('>>> [SCROLL] Bắt đầu scroll để load toàn bộ tin nhắn');

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Doi panel conversation load...', logType: 'info' });
  }

  // Dynamic wait cho message container xuất hiện
  await waitForCondition(
    () => document.querySelectorAll('.z2-message-container').length > 0 ||
          document.querySelectorAll('[class*="message-container"]').length > 0,
    8000,
    500,
    1500
  );

  // Đợi thêm một chút để render
  await new Promise(r => setTimeout(r, 500));

  // Tìm scroll container với cache
  let scrollContainer = document.querySelector("#conversation-page-v2 > div.d-flex.flex-grow-1 > div.d-flex.flex-grow-1.flex-column.justify-content-between.border-right > div.z2-conversation-body.scrollbar.pt-5");
  let fallbackContainer = document.querySelector('.z2-conversation-body');
  let currentContainer = scrollContainer || fallbackContainer;

  if (!currentContainer) {
    console.log('>>> [SCROLL] ✗ Không tìm thấy container, thử fallback...');
    currentContainer = document.querySelector('.z2-conversation-body, [class*="conversation-body"], .scrollbar');
  }

  if (!currentContainer) {
    console.log('>>> [SCROLL] ✗ Không tìm thấy container, dừng lại');
    if (chrome.runtime) chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG tim thay scroll container!', logType: 'error' });
    return;
  }

  if (chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Bat dau scroll load tin nhan...', logType: 'info' });
  }

  let lastCount = 0;
  let noChangeCount = 0;
  let i = 0;

  while (true) {
    i++;
    const countBefore = getMessageCount();

    console.log('>>> [SCROLL] Lần ' + i + ' - Trước scroll: ' + countBefore + ' tin nhắn');
    if (chrome.runtime && i <= 3) {
      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Scroll lan ' + i + ' - ' + countBefore + ' tin nhan', logType: 'info' });
    }

    // Scroll lên
    currentContainer.scrollTop = 0;

    // Dynamic wait - kiểm tra sau mỗi interval thay vì cố định 4s
    let hasProgress = await waitForCondition(
      () => {
        const countAfter = getMessageCount();
        return countAfter > countBefore;
      },
      5000, // 5s timeout cho mỗi scroll
      500,  // Bắt đầu với 500ms
      DYNAMIC_CONFIG.scrollMaxInterval
    );

    const countAfter = getMessageCount();
    const newMessages = countAfter - countBefore;

    console.log('>>> [SCROLL] Lần ' + i + ' - Sau scroll: ' + countAfter + ' tin nhắn (+' + newMessages + ')');

    if (countAfter === countBefore || !hasProgress) {
      noChangeCount++;
      if (noChangeCount >= MAX_NO_CHANGE) {
        console.log('>>> [SCROLL] ✓ Đã đến đầu cuộc trò chuyện, dừng scroll');
        if (chrome.runtime) chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Scroll xong - ' + lastCount + ' tin nhan', logType: 'info' });
        break;
      }
    } else {
      noChangeCount = 0;
    }

    lastCount = countAfter;
    totalMessages = countAfter;

    if (i >= MAX_SCROLL_ATTEMPTS) {
      console.log('>>> [SCROLL] ⚠ Đạt giới hạn tối đa ' + MAX_SCROLL_ATTEMPTS + ' lần scroll');
      if (chrome.runtime) chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dat gioi han scroll - ' + lastCount + ' tin nhan', logType: 'warn' });
      break;
    }
  }

  console.log('>>> [SCROLL] ✓ HOÀN THÀNH - Tổng cộng ' + i + ' lần scroll, ' + lastCount + ' tin nhắn');
}

window.__scrollModule = {
  scrollUpToLoadMessages,
  getMessageCount
};
