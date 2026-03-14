// Step 05: Background script - Entry point, message handling

import { logToPopup } from './02-utils.js';
import { getCrawlState, stopCrawl, startCrawl } from './04-crawl.js';
import { API_BASE } from './01-config.js';

console.log('');
console.log('==============================================================');
console.log('         BACKGROUND SCRIPT: DA TAI                      ');
console.log('==============================================================');
console.log('');
console.log('>>> [CONFIG] API_BASE:', API_BASE);

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

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
    stopCrawl();
    logToPopup('Da dung crawl', 'warn');
    sendResponse({ success: true });

  } else if (message.type === 'GET_STATUS') {
    const state = getCrawlState();
    sendResponse({
      isProcessing: state.isProcessing,
      currentPhone: state.currentPhoneNumber
    });

  } else if (message.type === 'CONTENT_LOG') {
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

console.log('');
console.log('==============================================================');
console.log('         BACKGROUND SCRIPT: SAN SANG                     ');
console.log('==============================================================');
console.log('');
