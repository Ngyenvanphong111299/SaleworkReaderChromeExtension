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

// Tìm tất cả conversations cho một số điện thoại
function findAllConversations() {
  console.log('');
  console.log('>>> [FIND_ALL_CONV] Tìm tất cả conversations...');

  // Các selector để tìm danh sách conversation
  const listSelectors = [
    '.z2-conversation-list',
    '.z2-conver-list-container .z2-conversation-list',
    '[class*="conversation-list"]',
    '.z2-conver-list-container',
    '#conversation-page-v2 > div.z2-conver-list-container',
    '[class*="search-result"]'
  ];

  let convList = null;
  for (const selector of listSelectors) {
    convList = document.querySelector(selector);
    if (convList) {
      console.log('>>> [FIND_ALL_CONV] ✓ Tìm thấy container với selector:', selector);
      break;
    }
  }

  // Debug: Try to find any element containing "conversation"
  if (!convList) {
    console.log('>>> [FIND_ALL_CONV] Debug: Tìm elements có "conversation"...');
    const convElements = document.querySelectorAll('[class*="conversation"]');
    console.log('>>> [FIND_ALL_CONV] Tìm thấy ' + convElements.length + ' elements có "conversation"');
    for (let i = 0; i < Math.min(5, convElements.length); i++) {
      console.log('>>> [FIND_ALL_CONV]   - ' + convElements[i].className);
    }
  }

  if (!convList) {
    console.log('>>> [FIND_ALL_CONV] ✗ Không tìm thấy danh sách conversation');
    return [];
  }

  // Tìm tất cả conversation items
  const itemSelectors = [
    '.z2-conversation-item',
    '[class*="conversation-item"]',
    '.z2-conver-list-container > div > div',
    '.z2-conversation-list > div',
    '[class*="conversation"]'
  ];

  let allConvs = [];
  for (const selector of itemSelectors) {
    allConvs = convList.querySelectorAll(selector);
    if (allConvs.length > 0) {
      console.log('>>> [FIND_ALL_CONV] ✓ Tìm thấy ' + allConvs.length + ' conversations với selector:', selector);
      break;
    }
  }

  if (allConvs.length === 0) {
    // Fallback: Get all direct children
    console.log('>>> [FIND_ALL_CONV] Thử lấy tất cả direct children...');
    allConvs = convList.children;
    console.log('>>> [FIND_ALL_CONV] Tìm thấy ' + allConvs.length + ' children');
  }

  if (allConvs.length === 0) {
    console.log('>>> [FIND_ALL_CONV] ✗ Không tìm thấy conversation items');
    return [];
  }

  console.log('>>> [FIND_ALL_CONV] Tổng cộng ' + allConvs.length + ' conversations');
  return Array.from(allConvs);
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

// Scroll để load tin nhắn cũ - không giới hạn, scroll đến khi không còn tin nhắn mới
async function scrollUpToLoadMessages() {
  console.log('');
  console.log('>>> [SCROLL] Bắt đầu scroll để load toàn bộ tin nhắn');
  console.log('>>> [SCROLL] Mục tiêu: Trích xuất toàn bộ tin nhắn');

  // Tìm container scroll
  const scrollContainer = document.querySelector("#conversation-page-v2 > div.d-flex.flex-grow-1 > div.d-flex.flex-grow-1.flex-column.justify-content-between.border-right > div.z2-conversation-body.scrollbar.pt-5");

  // Fallback nếu không tìm thấy
  let fallbackContainer = null;
  if (!scrollContainer) {
    console.log('>>> [SCROLL] Container chính không tìm thấy, thử fallback...');
    fallbackContainer = document.querySelector('.z2-conversation-body');
    if (fallbackContainer) {
      console.log('>>> [SCROLL] Fallback container tìm thấy!');
    }
  }

  console.log('>>> [SCROLL] Container:', scrollContainer || fallbackContainer ? 'Tìm thấy!' : 'KHÔNG tìm thấy');

  let lastCount = 0;
  let noChangeCount = 0;
  const maxNoChange = 5; // Dừng sau 5 lần không có tin nhắn mới
  let i = 0;

  while (true) {
    i++;
    const currentContainer = scrollContainer || fallbackContainer;

    if (!currentContainer) {
      console.log('>>> [SCROLL] ✗ Không tìm thấy container, dừng lại');
      break;
    }

    // Lấy số tin nhắn trước khi scroll
    let beforeContainers = document.querySelectorAll('.z2-message-container');
    if (beforeContainers.length === 0) {
      beforeContainers = document.querySelectorAll('[class*="message-container"]');
    }
    if (beforeContainers.length === 0) {
      beforeContainers = document.querySelectorAll('div[class*="z2-message"]');
    }
    const countBefore = beforeContainers.length;

    console.log('>>> [SCROLL] Lần ' + i + ' - Trước scroll: ' + countBefore + ' tin nhắn');

    // Scroll lên đầu
    currentContainer.scrollTop = -99999;

    // Đợi load tin nhắn mới
    await new Promise(r => setTimeout(r, 4000));

    // Lấy số tin nhắn sau khi scroll
    let afterContainers = document.querySelectorAll('.z2-message-container');
    if (afterContainers.length === 0) {
      afterContainers = document.querySelectorAll('[class*="message-container"]');
    }
    if (afterContainers.length === 0) {
      afterContainers = document.querySelectorAll('div[class*="z2-message"]');
    }
    const countAfter = afterContainers.length;

    console.log('>>> [SCROLL] Lần ' + i + ' - Sau scroll: ' + countAfter + ' tin nhắn (+' + (countAfter - countBefore) + ')');

    // Kiểm tra nếu không có tin nhắn mới
    if (countAfter === countBefore) {
      noChangeCount++;
      console.log('>>> [SCROLL] Không có tin nhắn mới (lần ' + noChangeCount + '/' + maxNoChange + ')');

      if (noChangeCount >= maxNoChange) {
        console.log('>>> [SCROLL] ✓ Đã đến đầu cuộc trò chuyện, dừng scroll');
        break;
      }
    } else {
      noChangeCount = 0;
    }

    lastCount = countAfter;

    // Giới hạn an toàn - không scroll quá 100 lần
    if (i >= 100) {
      console.log('>>> [SCROLL] ⚠ Đạt giới hạn tối đa 100 lần scroll');
      break;
    }
  }

  console.log('>>> [SCROLL] ✓ HOÀN THÀNH - Tổng cộng ' + i + ' lần scroll, ' + lastCount + ' tin nhắn');
}

// Trích xuất tin nhắn từ conversation
function extractMessages() {
  console.log('');
  console.log('========================================');
  console.log('>>> [EXTRACT] Bắt đầu trích xuất tin nhắn...');
  console.log('========================================');

  const messages = [];

  // Tìm tất cả message containers - selector chính xác từ HTML
  let allContainers = document.querySelectorAll('.z2-message-container');
  console.log('>>> [EXTRACT] Tìm thấy ' + allContainers.length + ' z2-message-container');

  // Debug - kiểm tra conversation body
  const conversationBody = document.querySelector('.z2-conversation-body');
  console.log('>>> [EXTRACT] Conversation body:', conversationBody ? 'Tìm thấy' : 'KHÔNG');

  if (allContainers.length === 0) {
    console.log('>>> [EXTRACT] ✗ KHÔNG CÓ tin nhắn nào!');
  } else {
    console.log('>>> [EXTRACT] Bắt đầu duyệt qua ' + allContainers.length + ' containers...');
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

      // Lấy thời gian - cập nhật selector
      let time = '';
      const footerEl = container.querySelector('.z2-message-item-right-footer') || container.querySelector('.z2-message-item-left-footer');
      if (footerEl) {
        const timeEl = footerEl.querySelector('.el-tooltip');
        if (timeEl) {
          time = timeEl.textContent.trim();
          console.log('>>> [EXTRACT] #' + index + ': Thời gian = ' + time);
        }
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

      // Lấy nội dung text - cập nhật selector để khớp với HTML thực tế
      let content = '';

      // Thử nhiều selector khác nhau - ưu tiên selector cụ thể hơn
      let textEl = container.querySelector('.z2-message-item-right-content span[id="regexText"]');
      if (!textEl) {
        textEl = container.querySelector('.z2-message-item-left-content span[id="regexText"]');
      }
      if (!textEl) {
        textEl = container.querySelector('.z2-message-item-right .mb-0.text-normal span');
      }
      if (!textEl) {
        textEl = container.querySelector('.z2-message-item-left .mb-0.text-normal span');
      }
      if (!textEl) {
        // Fallback: tìm span đầu tiên có nội dung trong message content
        const contentDiv = container.querySelector('.z2-message-item-right-content, .z2-message-item-left-content');
        if (contentDiv) {
          const spans = contentDiv.querySelectorAll('span');
          for (const span of spans) {
            const text = span.textContent?.trim();
            // Lọc các text không phải là action buttons
            if (text && text.length > 0 && !text.includes('Trả lời') && !text.includes('Chuyển tiếp') &&
                !text.includes('Ghim') && !text.includes('Copy') && !text.includes('Xoá') &&
                !text.includes('Lưu ảnh') && !text.includes('Chọn nhiều') && !text.includes('Thu hồi')) {
              textEl = span;
              break;
            }
          }
        }
      }

      if (textEl) {
        content = textEl.textContent.trim();
        console.log('>>> [EXTRACT] #' + index + ': Nội dung = ' + (content?.substring(0, 50) || '(trống)'));
      } else {
        console.log('>>> [EXTRACT] #' + index + ': KHÔNG tìm thấy text');
      }

      // Lấy hình ảnh - cập nhật selector
      let imageUrl = '';
      const photoContainer = container.querySelector('.photo-container');
      if (photoContainer) {
        const imageEl = photoContainer.querySelector('img.el-image__preview');
        if (imageEl) {
          imageUrl = imageEl.src || imageEl.getAttribute('src');
          console.log('>>> [EXTRACT] #' + index + ': Có HÌNH ẢNH: ' + imageUrl?.substring(0, 50));
        }
      }

      // Fallback: tìm bất kỳ image nào
      if (!imageUrl) {
        const allImages = container.querySelectorAll('img');
        for (const img of allImages) {
          const src = img.src || img.getAttribute('src');
          if (src && !src.includes('emoji') && !src.includes('icon') && !src.includes('three_dots')) {
            imageUrl = src;
            console.log('>>> [EXTRACT] #' + index + ': Có HÌNH ẢNH (fallback): ' + imageUrl?.substring(0, 50));
            break;
          }
        }
      }

      // Nếu có image nhưng không có content, đánh dấu là image
      if (imageUrl && !content) {
        content = '[Image]';
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
    console.log('>>> BƯỚC 3: ĐỢI KẾT QUẢ SEARCH (6s)');
    console.log('>>> ═══════════════════════════════════');
    console.log('>>> [RETRY] Đợi load kết quả search...');

    setTimeout(async () => {
      console.log('>>> [RETRY] Đợi xong, tìm all conversations...');

      // Debug: Log HTML structure
      console.log('>>> [RETRY] Debug: Body innerHTML length:', document.body.innerHTML.length);

      // Tìm tất cả conversations
      const allConvs = findAllConversations();

      console.log('>>> [RETRY] Tìm thấy conversations:', allConvs.length);

      if (allConvs.length === 0) {
        console.log('>>> [RETRY] Không tìm thấy conversation nào');
        retrySearch();
        return;
      }

      console.log('');
      console.log('>>> ═══════════════════════════════════');
      console.log('>>> TÌM THẤY ' + allConvs.length + ' CONVERSATIONS');
      console.log('>>> ═══════════════════════════════════');

      // Crawl từng conversation và gửi về backend ngay sau mỗi conversation
      let totalMessages = 0;
      let conversationIndex = 0;

      for (const conv of allConvs) {
        console.log('');
        console.log('╔══════════════════════════════════════╗');
        console.log('║  CONVERSATION ' + (conversationIndex + 1) + '/' + allConvs.length + '                    ║');
        console.log('╚══════════════════════════════════════╝');

        // Click vào conversation
        console.log('>>> [CONV ' + (conversationIndex + 1) + '] Click vào conversation...');
        conv.click();

        // Đợi load tin nhắn
        await new Promise(r => setTimeout(r, 3000));

        // Scroll để load tin nhắn cũ
        console.log('>>> [CONV ' + (conversationIndex + 1) + '] Scroll để load tin nhắn cũ...');
        await scrollUpToLoadMessages();

        // Trích xuất tin nhắn
        console.log('>>> [CONV ' + (conversationIndex + 1) + '] Trích xuất tin nhắn...');
        const messages = extractMessages();

        // Thêm staffName để phân biệt conversation
        const staffNameEl = conv.querySelector('[class*="name"], [class*="staff"]');
        const staffName = staffNameEl?.textContent?.trim() || 'Conversation ' + (conversationIndex + 1);

        const messagesWithStaff = messages.map(msg => ({
          ...msg,
          staffName: staffName
        }));

        console.log('>>> [CONV ' + (conversationIndex + 1) + '] Trích xuất được ' + messages.length + ' tin nhắn');

        // Gửi tin nhắn về backend NGAY SAU KHI CRAWL XONG CONVERSATION NÀY
        if (messagesWithStaff.length > 0) {
          console.log('>>> [CONV ' + (conversationIndex + 1) + '] Gửi tin nhắn về backend...');

          // Sử dụng promise để đợi gửi xong
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              type: 'MESSAGES_EXTRACTED',
              phoneNumber: phoneNumber,
              messages: messagesWithStaff
            }, (response) => {
              console.log('>>> [CONV ' + (conversationIndex + 1) + '] ✓ Đã gửi tin nhắn về backend');
              resolve(response);
            });
          });
        }

        totalMessages += messages.length;
        conversationIndex++;

        // Đợi một chút trước khi chuyển sang conversation tiếp theo
        if (conversationIndex < allConvs.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      window.__extractedPhone = phoneNumber;
      console.log('');
      console.log('╔══════════════════════════════════════╗');
      console.log('║  HOÀN THÀNH CRAWL ' + allConvs.length + ' CONVERSATIONS     ║');
      console.log('║  Tổng tin nhắn: ' + totalMessages + '                    ║');
      console.log('╚══════════════════════════════════════╝');
    }, 6000);
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
      scrollUpToLoadMessages().then(() => {
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
