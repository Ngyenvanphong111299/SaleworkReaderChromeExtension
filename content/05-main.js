// Step 05: Luồng chính - fillAndSearchAndClick, message listener

var MAX_RETRIES = 5;
var POLL_INTERVAL_MS = 1500;
var BETWEEN_CONV_MS = 1000;

window.__extractedMessages = [];
window.__extractedPhone = '';

var INITIAL_WAIT_MS = 1500; // Đợi sau khi click search (1 kết quả có thể load nhanh/chậm khác)

/** Đợi conversation load xong bằng cách poll, tối đa MAX_RETRIES lần */
async function waitForConversationsLoaded() {
  await new Promise(r => setTimeout(r, INITIAL_WAIT_MS));
  for (let i = 1; i <= MAX_RETRIES; i++) {
    chrome.runtime.sendMessage({
      type: 'CONTENT_LOG',
      text: 'Kiem tra conversation da load... (lan ' + i + '/' + MAX_RETRIES + ')',
      logType: 'info'
    });
    const allConvs = findAllConversations();
    if (allConvs.length > 0) {
      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da load xong! Tim thay ' + allConvs.length + ' conversation', logType: 'success' });
      return allConvs;
    }
    if (i < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  return [];
}

/**
 * Lấy tên tư vấn viên từ tooltip của avatar nhỏ (z2-avatar-tooltip)
 * Trigger hover programmatically để Element UI render tooltip, đọc nội dung rồi ẩn lại
 * @param {Element} convElement - Conversation item element
 * @returns {Promise<string|null>} - Tên tư vấn viên hoặc null
 */
async function getStaffNameFromAvatarTooltip(convElement) {
  const avatarEl = convElement.querySelector('.z2-avatar-tooltip[aria-describedby]');
  if (!avatarEl) return null;

  const tooltipId = avatarEl.getAttribute('aria-describedby');
  if (!tooltipId) return null;

  avatarEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
  avatarEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));

  await new Promise(r => setTimeout(r, 400));

  const tooltipEl = document.getElementById(tooltipId);
  let staffName = null;
  if (tooltipEl) {
    staffName = tooltipEl.textContent?.trim().replace(/\s+/g, ' ') || null;
  }

  avatarEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, view: window }));
  avatarEl.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, view: window }));

  return staffName;
}

/** Trả về Promise<{ success, messages, error }> - đợi đến khi xong hoặc thất bại */
function fillAndSearchAndClick(phoneNumber) {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  BẮT ĐẦU QUY TRÌNH CHO SỐ: ' + phoneNumber + '  ║');
  console.log('╚══════════════════════════════════════╝');

  return new Promise(function (resolve) {
    let currentRetry = 0;

    async function doSearchAndCrawl() {
      if (window.__searchModule?.closeSaleworkDialog) {
        window.__searchModule.closeSaleworkDialog();
        await new Promise(r => setTimeout(r, 300));
      }

      const inputFilled = fillPhoneNumber(phoneNumber);
      if (!inputFilled) return null;

      const buttonClicked = findAndClickSearchButton();
      if (!buttonClicked) return null;

      const allConvs = await waitForConversationsLoaded();
      if (allConvs.length === 0) return [];

      return allConvs;
    }

    async function retrySearch() {
      console.log('>>> [RETRY] Lần thử: ' + (currentRetry + 1) + '/' + MAX_RETRIES);

      if (currentRetry >= MAX_RETRIES) {
        const errMsg = 'Khong tim thay conversation sau ' + MAX_RETRIES + ' lan thu';
        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: errMsg, logType: 'error' });
        resolve({ success: false, messages: [], error: errMsg });
        return;
      }

      currentRetry++;

      const allConvs = await doSearchAndCrawl();

      if (!allConvs) {
        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Loi fill/click, thu lai sau 1s...', logType: 'warn' });
        setTimeout(retrySearch, 1000);
        return;
      }

      if (allConvs.length === 0) {
        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Chua load xong, thu lai...', logType: 'warn' });
        setTimeout(retrySearch, 1000);
        return;
      }

      console.log('>>> TÌM THẤY ' + allConvs.length + ' CONVERSATIONS');

      const conversations = [];
      let conversationIndex = 0;

      for (const conv of allConvs) {
        conv.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise(r => setTimeout(r, 300));
        const staffName = (await getStaffNameFromAvatarTooltip(conv)) || 'Conv ' + (conversationIndex + 1);

        const clickResult = await clickConversation(conv, conversationIndex, allConvs.length);
        if (clickResult && clickResult.rateLimit) {
          chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Rate limit - khong co tin nhan sau khi click', logType: 'error' });
          resolve({ success: false, rateLimit: true, error: 'Rate limit - khong co tin nhan sau khi click' });
          return;
        }

        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: '[Conv ' + (conversationIndex + 1) + '/' + allConvs.length + '] Scroll load tin nhan...', logType: 'info' });
        await scrollUpToLoadMessages();

        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: '[Conv ' + (conversationIndex + 1) + '/' + allConvs.length + '] Trich xuat tin nhan...', logType: 'info' });
        const messages = extractMessages();
        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: '[Conv ' + (conversationIndex + 1) + '] Trich xuat duoc ' + messages.length + ' tin nhan', logType: messages.length > 0 ? 'success' : 'warn' });

        const messagesWithStaff = messages.map((msg, idx) => ({ ...msg, staffName: staffName, order: idx }));
        conversations.push({ staffName, messages: messagesWithStaff });

        conversationIndex++;
        if (conversationIndex < allConvs.length) {
          await new Promise(r => setTimeout(r, BETWEEN_CONV_MS));
        }
      }

      const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
      window.__extractedPhone = phoneNumber;
      const doneMsg = 'Hoan thanh crawl ' + allConvs.length + ' conversation, tong ' + totalMessages + ' tin nhan';
      console.log('>>> ' + doneMsg);
      chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: doneMsg, logType: 'success' });

      resolve({ success: true, conversations, conversationsCount: allConvs.length });
    }

    retrySearch();
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('>>> [CONTENT] Nhận message:', message.type);

  if (message.type === 'FILL_PHONE') {
    const success = fillPhoneNumber(message.phoneNumber);
    sendResponse({ success: success });
  }

  if (message.type === 'FILL_AND_SEARCH') {
    fillAndSearchAndClick(message.phoneNumber).then(function (result) {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === 'EXTRACT_MESSAGES') {
    setTimeout(() => {
      scrollUpToLoadMessages().then(() => {
        const messages = extractMessages();
        window.__extractedMessages = messages;
        sendResponse({ success: true, messages: messages });
      });
    }, 2000);
    return true;
  }

  if (message.type === 'GET_EXTRACTED_MESSAGES') {
    sendResponse({ success: true, messages: window.__extractedMessages || [] });
    return true;
  }

  return true;
});

console.log('========================================');
console.log('=== Content Script: SẴN SÀNG ===');
console.log('========================================');
