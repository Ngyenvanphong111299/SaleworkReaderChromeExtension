// Content script chạy trên trang salework.com
// Lắng nghe message từ background script để nhập số điện thoại

console.log('========================================');
console.log('=== Content Script: ĐÃ TẢI ===');
console.log('========================================');

// Biến toàn cục để lưu trữ tin nhắn
window.__extractedMessages = [];
window.__extractedPhone = '';

// Tìm ô input search trên Salework
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

  console.log('>>> [FIND_INPUT] Sẽ thử ' + selectors.length + ' selectors...');

  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    console.log('>>> [FIND_INPUT] Thử selector #' + (i + 1) + ': ' + selector);
    try {
      const input = document.querySelector(selector);
      if (input) {
        console.log('>>> [FIND_INPUT] ✓ Tìm thấy input!');
        console.log('>>> [FIND_INPUT]   - Tag:', input.tagName);
        console.log('>>> [FIND_INPUT]   - ID:', input.id || 'không có');
        console.log('>>> [FIND_INPUT]   - Class:', input.className || 'không có');
        console.log('>>> [FIND_INPUT]   - Placeholder:', input.placeholder || 'không có');
        console.log('>>> [FIND_INPUT]   - Value hiện tại:', input.value || '(trống)');
        return input;
      }
    } catch (e) {
      console.log('>>> [FIND_INPUT] Lỗi với selector:', selector, e.message);
    }
  }
  console.log('>>> [FIND_INPUT] ✗ KHÔNG TÌM THẤY input search!');
  return null;
}

// Hàm nhập số điện thoại vào ô search
function fillPhoneNumber(phoneNumber) {
  console.log('');
  console.log('========================================');
  console.log('>>> [FILL_PHONE] Bắt đầu nhập số điện thoại');
  console.log('>>> [FILL_PHONE] Số cần nhập:', phoneNumber);
  console.log('========================================');

  // Log to background
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Dang tim input...', logType: 'info' });

  const input = findSearchInput();
  if (input) {
    console.log('>>> [FILL_PHONE] Đã tìm thấy input, đang nhập số...');
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'DA TIM THAY INPUT!', logType: 'info' });

    // Xóa giá trị cũ
    input.value = '';
    console.log('>>> [FILL_PHONE] Đã xóa giá trị cũ');

    // Nhập số mới
    input.value = phoneNumber;
    console.log('>>> [FILL_PHONE] Đã nhập số:', phoneNumber);

    // Dispatch các events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('>>> [FILL_PHONE] Đã dispatch event: input');

    input.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('>>> [FILL_PHONE] Đã dispatch event: change');

    // Kiểm tra lại giá trị
    console.log('>>> [FILL_PHONE] Giá trị sau khi nhập:', input.value);
    console.log('>>> [FILL_PHONE] ✓ HOÀN THÀNH nhập số!');
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da dien SDT: ' + phoneNumber, logType: 'info' });

    return true;
  }

  console.log('>>> [FILL_PHONE] ✗ KHÔNG THỂ nhập số - không tìm thấy input');
  chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG TIM THAY INPUT!', logType: 'error' });
  return false;
}

// Tìm và click nút search
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

  console.log('>>> [FIND_BUTTON] Sẽ thử ' + searchSelectors.length + ' selectors...');

  for (let i = 0; i < searchSelectors.length; i++) {
    const selector = searchSelectors[i];
    console.log('>>> [FIND_BUTTON] Thử selector #' + (i + 1) + ': ' + selector);
    try {
      const btn = document.querySelector(selector);
      if (btn) {
        console.log('>>> [FIND_BUTTON] ✓ Tìm thấy button!');
        console.log('>>> [FIND_BUTTON]   - Tag:', btn.tagName);
        console.log('>>> [FIND_BUTTON]   - Text:', btn.textContent?.substring(0, 50) || 'trống');
        console.log('>>> [FIND_BUTTON]   - Class:', btn.className || 'không có');

        btn.click();
        console.log('>>> [FIND_BUTTON] ✓ Đã CLICK vào nút search!');
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

// Tìm conversation trong danh sách
function findConversation() {
  console.log('');
  console.log('>>> [FIND_CONV] Bắt đầu tìm conversation...');

  const convSelectors = [
    "#conversation-page-v2 > div.z2-conver-list-container > div.z2-conversation-list > div:nth-child(1) > div",
    ".z2-conversation-list > div:first-child > div",
    ".z2-conversation-item:first-child",
    "[class*='conversation-list'] > div:first-child",
    ".z2-conversation-item",
    "[class*='conversation'] > div"
  ];

  console.log('>>> [FIND_CONV] Sẽ thử ' + convSelectors.length + ' selectors...');

  for (let i = 0; i < convSelectors.length; i++) {
    const selector = convSelectors[i];
    console.log('>>> [FIND_CONV] Thử selector #' + (i + 1) + ': ' + selector);
    try {
      const conv = document.querySelector(selector);
      if (conv) {
        console.log('>>> [FIND_CONV] ✓ Tìm thấy conversation!');
        console.log('>>> [FIND_CONV]   - Tag:', conv.tagName);
        console.log('>>> [FIND_CONV]   - Class:', conv.className || 'không có');

        // Thử lấy số điện thoại từ conversation
        const phoneEl = conv.querySelector('[class*="phone"], [class*="number"], [class*="name"]');
        if (phoneEl) {
          console.log('>>> [FIND_CONV]   - Phone element text:', phoneEl.textContent?.substring(0, 30));
        }

        return conv;
      }
    } catch (e) {
      console.log('>>> [FIND_CONV] Lỗi với selector:', selector, e.message);
    }
  }

  // Thử lấy tất cả conversation để debug
  console.log('>>> [FIND_CONV] Debug: Lấy tất cả conversation items...');
  const allConvs = document.querySelectorAll('[class*="conversation"]');
  console.log('>>> [FIND_CONV] Tìm thấy ' + allConvs.length + ' elements có "conversation" trong class');

  console.log('>>> [FIND_CONV] ✗ KHÔNG TÌM THẤY conversation!');
  return null;
}

// Scroll để load tin nhắn cũ
async function scrollUpToLoadMessages(times) {
  console.log('');
  console.log('>>> [SCROLL] Bắt đầu scroll để load tin nhắn cũ');
  console.log('>>> [SCROLL] Số lần scroll:', times);

  for (let i = 0; i < times; i++) {
    console.log('>>> [SCROLL] Scroll lần ' + (i + 1) + '/' + times);

    // Scroll lên đầu
    window.scrollTo(0, 0);
    console.log('>>> [SCROLL] Đã scroll lên đỉnh');

    // Đợi load
    await new Promise(r => setTimeout(r, 1000));
    console.log('>>> [SCROLL] Đợi xong 1s');

    // Kiểm tra xem có tin nhắn mới không
    const msgContainers = document.querySelectorAll('.z2-message-container');
    console.log('>>> [SCROLL] Số message containers hiện tại:', msgContainers.length);
  }

  console.log('>>> [SCROLL] ✓ HOÀN THÀNH scroll ' + times + ' lần');
}

// Trích xuất tin nhắn từ conversation
function extractMessages() {
  console.log('');
  console.log('========================================');
  console.log('>>> [EXTRACT] Bắt đầu trích xuất tin nhắn...');
  console.log('========================================');

  const messages = [];
  const allContainers = document.querySelectorAll('.z2-message-container');

  console.log('>>> [EXTRACT] Tìm thấy ' + allContainers.length + ' message containers');

  if (allContainers.length === 0) {
    console.log('>>> [EXTRACT] ✗ KHÔNG CÓ tin nhắn nào!');

    // Debug: Thử tìm các element khác
    console.log('>>> [EXTRACT] Debug: Tìm các element khác...');
    const allDivs = document.querySelectorAll('div');
    console.log('>>> [EXTRACT] Tổng số divs:', allDivs.length);

    // Tìm các element có chứa tin nhắn
    const msgDivs = document.querySelectorAll('div[class*="message"]');
    console.log('>>> [EXTRACT] Elements có "message" trong class:', msgDivs.length);
  }

  allContainers.forEach((container, index) => {
    try {
      // Kiểm tra timestamp (ngày chia tin nhắn)
      const timestampMarker = container.querySelector('div.w-100.text-center span');
      if (timestampMarker) {
        const dateTime = timestampMarker.textContent.trim();
        if (dateTime) {
          messages.push({
            id: 'timestamp_' + index,
            content: dateTime,
            time: dateTime,
            type: 'timestamp',
            messageType: 'timestamp'
          });
          console.log('>>> [EXTRACT] #' + index + ': TIMESTAMP - ' + dateTime);
        }
        return;
      }

      // Xác định loại tin nhắn (gửi hoặc nhận)
      const isRight = container.querySelector('.z2-message-item-right-container') !== null;
      const msgType = isRight ? 'sent' : 'received';
      console.log('>>> [EXTRACT] #' + index + ': Loại = ' + msgType);

      // Lấy thời gian
      let time = '';
      const timeEl = container.querySelector('.z2-message-item-right-footer .el-tooltip') ||
                     container.querySelector('.z2-message-item-left-footer .el-tooltip');
      if (timeEl) {
        time = timeEl.textContent.trim();
        console.log('>>> [EXTRACT] #' + index + ': Thời gian = ' + time);
      }

      const msgId = container.id || 'msg_' + index;

      // Lấy Reply/Mention
      const quotedContentEl = container.querySelector('.z2-message-reply-quoted-content');
      const quotedSenderEl = container.querySelector('.z2-message-reply-quoted-sender');
      const quotedContent = quotedContentEl?.textContent?.trim();
      const quotedSender = quotedSenderEl?.textContent?.trim();

      if (quotedContent) {
        console.log('>>> [EXTRACT] #' + index + ': Reply từ ' + (quotedSender || 'unknown') + ': ' + quotedContent?.substring(0, 30));
      }

      // Lấy nội dung text
      let content = '';
      const textEl = container.querySelector('.z2-message-item-content-text') ||
                     container.querySelector('[class*="message-content"]');
      if (textEl) {
        content = textEl.textContent.trim();
        console.log('>>> [EXTRACT] #' + index + ': Nội dung = ' + (content?.substring(0, 50) || '(trống)'));
      }

      // Lấy hình ảnh
      const imageEl = container.querySelector('img[class*="message-image"]');
      const imageUrl = imageEl?.src;
      if (imageEl) {
        console.log('>>> [EXTRACT] #' + index + ': Có HÌNH ẢNH');
        if (!content) content = '[Image]';
      }

      if (content || imageUrl) {
        messages.push({
          id: msgId,
          content: content,
          time: time,
          type: msgType,
          messageType: imageUrl ? 'image' : 'text',
          imageUrl: imageUrl,
          quotedContent: quotedContent,
          quotedSender: quotedSender
        });
        console.log('>>> [EXTRACT] #' + index + ': ✓ Đã thêm vào mảng');
      } else {
        console.log('>>> [EXTRACT] #' + index + ': ✗ Bỏ qua (không có nội dung)');
      }
    } catch (e) {
      console.log('>>> [EXTRACT] ✗ Lỗi trích xuất tin nhắn #' + index + ':', e.message);
    }
  });

  console.log('');
  console.log('========================================');
  console.log('>>> [EXTRACT] ✓ HOÀN THÀNH!');
  console.log('>>> [EXTRACT] Tổng số tin nhắn trích xuất được: ' + messages.length);
  console.log('========================================');
  console.log('');

  return messages;
}

// Fill phone + click search + click conversation + trích xuất tin nhắn
function fillAndSearchAndClick(phoneNumber) {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  BẮT ĐẦU QUY TRÌNH CHO SỐ: ' + phoneNumber + '  ║');
  console.log('╚══════════════════════════════════════╝');

  const MAX_RETRIES = 5;
  let currentRetry = 0;

  function retrySearch() {
    console.log('');
    console.log('>>> [RETRY] ═══════════════════════════════');
    console.log('>>> [RETRY] Lần thử: ' + (currentRetry + 1) + '/' + MAX_RETRIES);
    console.log('>>> [RETRY] ═══════════════════════════════');

    if (currentRetry >= MAX_RETRIES) {
      console.log('');
      console.log('╔══════════════════════════════════════╗');
      console.log('║  ✗ ĐÃ RETRY ' + MAX_RETRIES + ' LẦN MÀ KHÔNG THÀNH CÔNG!  ║');
      console.log('╚══════════════════════════════════════╝');
      console.log('');

      chrome.runtime.sendMessage({
        type: 'MESSAGES_EXTRACTED',
        phoneNumber: phoneNumber,
        messages: [],
        error: 'Không tìm thấy conversation sau ' + MAX_RETRIES + ' lần thử'
      });
      return;
    }

    currentRetry++;
    console.log('>>> [RETRY] Bắt đầu retry lần ' + currentRetry);

    // Bước 1: Nhập số điện thoại
    console.log('');
    console.log('>>> ═══════════════════════════════════');
    console.log('>>> BƯỚC 1: NHẬP SỐ ĐIỆN THOẠI');
    console.log('>>> ═══════════════════════════════════');
    const inputFilled = fillPhoneNumber(phoneNumber);

    if (!inputFilled) {
      console.log('>>> [RETRY] Chưa tìm thấy input, đợi 1s rồi thử lại...');
      setTimeout(retrySearch, 1000);
      return;
    }

    // Bước 2: Click nút search
    console.log('');
    console.log('>>> ═══════════════════════════════════');
    console.log('>>> BƯỚC 2: CLICK NÚT SEARCH');
    console.log('>>> ═══════════════════════════════════');
    const buttonClicked = findAndClickSearchButton();

    if (!buttonClicked) {
      console.log('>>> [RETRY] Không tìm thấy nút search, đợi 1s rồi thử lại...');
      setTimeout(retrySearch, 1000);
      return;
    }

    // Bước 3: Đợi kết quả search và click conversation
    console.log('');
    console.log('>>> ═══════════════════════════════════');
    console.log('>>> BƯỚC 3: ĐỢI KẾT QUẢ SEARCH (4s)');
    console.log('>>> ═══════════════════════════════════');
    console.log('>>> [RETRY] Đợi load kết quả search...');

    setTimeout(() => {
      console.log('>>> [RETRY] Đợi xong, tìm conversation...');

      // Kiểm tra xem có kết quả search không
      const searchResults = document.querySelectorAll('[class*="result"], [class*="conversation"]');
      console.log('>>> [RETRY] Số elements liên quan đến conversation:', searchResults.length);

      const conv = findConversation();

      if (conv) {
        console.log('');
        console.log('>>> ═══════════════════════════════════');
        console.log('>>> BƯỚC 4: CLICK VÀO CONVERSATION');
        console.log('>>> ═══════════════════════════════════');

        conv.click();
        console.log('>>> [RETRY] ✓ Đã click vào conversation!');

        // Bước 5: Đợi load tin nhắn
        console.log('');
        console.log('>>> ═══════════════════════════════════');
        console.log('>>> BƯỚC 5: ĐỢI LOAD TIN NHẮN (4s)');
        console.log('>>> ═══════════════════════════════════');

        setTimeout(() => {
          // Bước 6: Scroll để load tin nhắn cũ
          console.log('');
          console.log('>>> ═══════════════════════════════════');
          console.log('>>> BƯỚC 6: SCROLL ĐỂ LOAD TIN NHẮN CŨ');
          console.log('>>> ═══════════════════════════════════');

          scrollUpToLoadMessages(5).then(() => {
            // Bước 7: Trích xuất tin nhắn
            console.log('');
            console.log('>>> ═══════════════════════════════════');
            console.log('>>> BƯỚC 7: TRÍCH XUẤT TIN NHẮN');
            console.log('>>> ═══════════════════════════════════');

            const messages = extractMessages();
            window.__extractedMessages = messages;
            window.__extractedPhone = phoneNumber;

            console.log('');
            console.log('╔══════════════════════════════════════╗');
            console.log('║  GỬI TIN NHẮN VỀ BACKGROUND          ║');
            console.log('║  Số điện thoại: ' + phoneNumber + '              ║');
            console.log('║  Số tin nhắn: ' + messages.length + '                    ║');
            console.log('╚══════════════════════════════════════╝');
            console.log('');

            chrome.runtime.sendMessage({
              type: 'MESSAGES_EXTRACTED',
              phoneNumber: phoneNumber,
              messages: messages
            }, (response) => {
              console.log('>>> [RETRY] ✓ Đã gửi tin nhắn về background');
              console.log('>>> [RETRY] Response:', response);
            });
          });
        }, 4000);
      } else {
        console.log('');
        console.log('>>> [RETRY] ✗ Không tìm thấy conversation!');
        console.log('>>> [RETRY] Thử lại...');
        retrySearch();
      }
    }, 4000);
  }

  retrySearch();
  return { success: true };
}

// Lắng nghe message từ background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  CONTENT SCRIPT NHẬN MESSAGE         ║');
  console.log('║  Type: ' + message.type.padEnd(25) + '║');
  console.log('╚══════════════════════════════════════╝');

  if (message.type === 'FILL_PHONE') {
    console.log('>>> Yêu cầu: Nhập số điện thoại');
    console.log('>>> Số:', message.phoneNumber);
    const success = fillPhoneNumber(message.phoneNumber);
    sendResponse({ success: success });
  }

  if (message.type === 'FILL_AND_SEARCH') {
    console.log('>>> Yêu cầu: Tìm kiếm và trích xuất');
    console.log('>>> Số điện thoại:', message.phoneNumber);
    const result = fillAndSearchAndClick(message.phoneNumber);
    sendResponse(result);
  }

  if (message.type === 'EXTRACT_MESSAGES') {
    console.log('>>> Yêu cầu: Trích xuất tin nhắn');
    setTimeout(() => {
      scrollUpToLoadMessages(3).then(() => {
        const messages = extractMessages();
        window.__extractedMessages = messages;
        sendResponse({ success: true, messages: messages });
      });
    }, 2000);
    return true;
  }

  if (message.type === 'GET_EXTRACTED_MESSAGES') {
    console.log('>>> Yêu cầu: Lấy tin nhắn đã trích xuất');
    console.log('>>> Số tin nhắn hiện có:', window.__extractedMessages?.length || 0);
    sendResponse({ success: true, messages: window.__extractedMessages || [] });
    return true;
  }

  return true;
});

console.log('');
console.log('========================================');
console.log('=== Content Script: SẴN SÀNG ===');
console.log('========================================');
