// Step 03: Scroll để load tin nhắn cũ

var MAX_NO_CHANGE = 5;
var SCROLL_WAIT_MS = 4000;
var MAX_SCROLL_ATTEMPTS = 100;
var WAIT_FOR_MESSAGES_MS = 2000; // Đợi panel conversation render xong

async function scrollUpToLoadMessages() {
  console.log('');
  console.log('>>> [SCROLL] Bắt đầu scroll để load toàn bộ tin nhắn');
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Doi panel conversation load...', logType: 'info' });
  }

  await new Promise(r => setTimeout(r, WAIT_FOR_MESSAGES_MS));

  for (let w = 0; w < 5; w++) {
    const cnt = document.querySelectorAll('.z2-message-container').length;
    if (cnt > 0) break;
    if (chrome.runtime) chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Cho message xuat hien... (' + (w + 1) + '/5)', logType: 'info' });
    await new Promise(r => setTimeout(r, 1000));
  }

  if (chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Bat dau scroll load tin nhan...', logType: 'info' });
  }

  const scrollContainer = document.querySelector("#conversation-page-v2 > div.d-flex.flex-grow-1 > div.d-flex.flex-grow-1.flex-column.justify-content-between.border-right > div.z2-conversation-body.scrollbar.pt-5");
  let fallbackContainer = document.querySelector('.z2-conversation-body');
  const currentContainer = scrollContainer || fallbackContainer;

  if (!currentContainer) {
    console.log('>>> [SCROLL] ✗ Không tìm thấy container, dừng lại');
    if (chrome.runtime) chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG tim thay scroll container!', logType: 'error' });
    return;
  }

  let lastCount = 0;
  let noChangeCount = 0;
  let i = 0;

  function getMessageCount() {
    let containers = document.querySelectorAll('.z2-message-container');
    if (containers.length === 0) containers = document.querySelectorAll('[class*="message-container"]');
    if (containers.length === 0) containers = document.querySelectorAll('div[class*="z2-message"]');
    return containers.length;
  }

  while (true) {
    i++;
    const countBefore = getMessageCount();

    console.log('>>> [SCROLL] Lần ' + i + ' - Trước scroll: ' + countBefore + ' tin nhắn');
    if (chrome.runtime && i <= 3) {
      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Scroll lan ' + i + ' - ' + countBefore + ' tin nhan', logType: 'info' });
    }

    currentContainer.scrollTop = -99999;
    await new Promise(r => setTimeout(r, SCROLL_WAIT_MS));

    const countAfter = getMessageCount();

    console.log('>>> [SCROLL] Lần ' + i + ' - Sau scroll: ' + countAfter + ' tin nhắn (+' + (countAfter - countBefore) + ')');

    if (countAfter === countBefore) {
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

    if (i >= MAX_SCROLL_ATTEMPTS) {
      console.log('>>> [SCROLL] ⚠ Đạt giới hạn tối đa ' + MAX_SCROLL_ATTEMPTS + ' lần scroll');
      if (chrome.runtime) chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dat gioi han scroll - ' + lastCount + ' tin nhan', logType: 'warn' });
      break;
    }
  }

  console.log('>>> [SCROLL] ✓ HOÀN THÀNH - Tổng cộng ' + i + ' lần scroll, ' + lastCount + ' tin nhắn');
}
