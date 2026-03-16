/**
 * Salework Crawler - Content Script Bundle
 * Gộp 5 file thành 1 để tối ưu performance
 * - 01-search.js
 * - 02-conversation.js
 * - 03-scroll.js
 * - 04-extract.js
 * - 05-main.js
 */

// ============ SHARED CONFIG ============
const DYNAMIC_CONFIG = {
  minInterval: 2000,
  maxInterval: 1500,
  scrollMaxInterval: 2000,
  scrollTimeout: 200000,
  defaultTimeout: 10000,
  RATE_LIMIT_CHECK_INTERVAL_MS: 1000,
  RATE_LIMIT_WAIT_MS: 30000
};

// ============ DOM CACHE ============
const domCache = {
  data: new Map(),
  get(key, fn) {
    if (this.data.has(key)) return this.data.get(key);
    const result = fn();
    if (result) this.data.set(key, result);
    return result;
  },
  clear() { this.data.clear(); },
  invalidate(key) { this.data.delete(key); }
};

// ============ DYNAMIC WAITING UTILS ============
async function waitForCondition(conditionFn, timeout = DYNAMIC_CONFIG.defaultTimeout, initialInterval = DYNAMIC_CONFIG.minInterval, maxInterval = DYNAMIC_CONFIG.maxInterval) {
  const startTime = Date.now();
  let currentInterval = initialInterval;

  while (Date.now() - startTime < timeout) {
    if (conditionFn()) return true;
    await new Promise(resolve => setTimeout(resolve, currentInterval));
    currentInterval = Math.min(currentInterval * 1.3, maxInterval);
  }

  return conditionFn();
}

async function waitForElement(selectors, timeout = DYNAMIC_CONFIG.defaultTimeout) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  // Thử ngay lập tức
  for (const selector of selectorArray) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  // Chờ với dynamic interval
  await waitForCondition(
    () => {
      for (const selector of selectorArray) {
        if (document.querySelector(selector)) return true;
      }
      return false;
    },
    timeout,
    DYNAMIC_CONFIG.minInterval,
    DYNAMIC_CONFIG.maxInterval
  );

  // Trả về kết quả cuối cùng
  for (const selector of selectorArray) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  return null;
}

// ============ MODULE 01: SEARCH ============
function findSearchInput() {
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
        if (input) return input;
      } catch (e) { /* ignore */ }
    }
    return null;
  });
}

function fillPhoneNumber(phoneNumber) {
  domCache.clear();
  const input = findSearchInput();

  if (input) {
    console.log('[FILL_PHONE] Found input, filling:', phoneNumber);
    input.value = '';
    input.value = phoneNumber;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Press Enter to trigger search
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    });
    input.dispatchEvent(enterEvent);
    console.log('[FILL_PHONE] Dispatched Enter key');

    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }
  console.log('[FILL_PHONE] Input NOT found!');
  return false;
}

function findAndClickSearchButton() {
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
        if (btn) return btn;
      } catch (e) { /* ignore */ }
    }
    return null;
  });
}

// ============ MODULE 02: CONVERSATION ============
function findAllConversations() {
  domCache.invalidate('allConvs');

  const convList = document.querySelector('.z2-conversation-list') ||
    document.querySelector('.z2-conver-list-container .z2-conversation-list');

  if (!convList) return [];

  let allConvs = convList.querySelectorAll('.z2-conv-item-container');
  if (allConvs.length === 0) allConvs = convList.querySelectorAll('[class*="conv-item-container"]');
  if (allConvs.length === 0) allConvs = convList.querySelectorAll('.pointer.hover-highlight.border-bottom');
  if (allConvs.length === 0) allConvs = convList.querySelectorAll(':scope > div > div.pointer');
  if (allConvs.length === 0) allConvs = convList.querySelectorAll(':scope > div > div');

  if (allConvs.length === 0) {
    const nameEls = convList.querySelectorAll('.name-conversation');
    const rows = [];
    nameEls.forEach(el => {
      const row = el.closest('.z2-conv-item-container') ||
        el.closest('.pointer.hover-highlight') ||
        el.closest('[class*="conv-item"]') ||
        el.closest('.border-bottom.pointer');
      if (row && !rows.includes(row)) rows.push(row);
    });
    allConvs = rows;
  }

  let result = Array.from(allConvs).filter(el =>
    !el.querySelector('input[type="search"], input[placeholder*="tìm"], input[placeholder*="search"]')
  );
  if (result.length === 0 && allConvs.length > 0) result = Array.from(allConvs);

  if (result.length > 0) domCache.data.set('allConvs', result);

  return result;
}

function getMessageCountForRateLimit() {
  let c = document.querySelectorAll('.z2-message-container');
  if (c.length === 0) c = document.querySelectorAll('[class*="message-container"]');
  if (c.length === 0) c = document.querySelectorAll('div[class*="z2-message"]');
  return c.length;
}

async function clickConversation(conv, index, total) {
  if (chrome?.runtime) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Click vao conversation ' + (index + 1) + '/' + total + '...', logType: 'info' });
  }

  conv.scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise(r => setTimeout(r, 2000));

  function doClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  doClick(conv);

  const rateLimitWaitMs = DYNAMIC_CONFIG.RATE_LIMIT_WAIT_MS || 30000;
  const checkIntervalMs = DYNAMIC_CONFIG.RATE_LIMIT_CHECK_INTERVAL_MS || 1000;
  const hasMessage = await waitForCondition(
    () => getMessageCountForRateLimit() >= 1,
    rateLimitWaitMs,
    checkIntervalMs,
    checkIntervalMs
  );

  if (!hasMessage) {
    if (chrome?.runtime) {
      chrome.runtime.sendMessage({
        type: 'CONTENT_LOG',
        text: 'Rate limit: Khong co tin nhan sau ' + (rateLimitWaitMs / 1000) + 's - Reload trang va thu lai...',
        logType: 'warn'
      });
    }
    return { rateLimit: true };
  }

  if (chrome?.runtime) {
    chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'Da load conversation ' + (index + 1) + ' (co tin nhan)', logType: 'info' });
  }
  return { success: true };
}

// ============ MODULE 03: SCROLL ============
function getMessageCount() {
  let containers = document.querySelectorAll('.z2-message-container');
  if (containers.length === 0) containers = document.querySelectorAll('[class*="message-container"]');
  if (containers.length === 0) containers = document.querySelectorAll('div[class*="z2-message"]');
  return containers.length;
}

function findScrollContainer() {
  const body = document.querySelector('.z2-conversation-body, [class*="conversation-body"]');
  if (!body) return null;

  const elWrap = body.querySelector('.el-scrollbar__wrap') || body.closest('.el-scrollbar')?.querySelector('.el-scrollbar__wrap');
  if (elWrap) return elWrap;

  const msgParent = document.querySelector('.z2-message-container')?.parentElement;
  if (msgParent && msgParent.scrollHeight > msgParent.clientHeight) return msgParent;

  if (body.scrollHeight > body.clientHeight) return body;

  const parent = body.parentElement;
  if (parent && parent.scrollHeight > parent.clientHeight) return parent;

  return body;
}

// Cache để lưu tin nhắn đã xóa khỏi DOM
const messageCache = {
  messages: [],
  maxCache: 2000, // Tăng lên để lưu nhiều tin nhắn

  add(messages) {
    this.messages.unshift(...messages);
    if (this.messages.length > this.maxCache) {
      this.messages = this.messages.slice(0, this.maxCache);
    }
  },

  getAll() {
    return this.messages;
  },

  clear() {
    this.messages = [];
  }
};

// Extract message data từ container element (dùng cho cả extractMessages và cleanup)
function extractMessageData(container, index) {
  const timestampMarker = container.querySelector('div.w-100.text-center span');
  if (timestampMarker) {
    const dateTime = timestampMarker.textContent.trim();
    if (dateTime) {
      return {
        id: 'timestamp_' + index,
        content: dateTime,
        time: dateTime,
        type: 'timestamp',
        messageType: 'timestamp'
      };
    }
  }

  const isRight = container.querySelector('.z2-message-item-right-container') !== null;
  const msgType = isRight ? 'sent' : 'received';

  let time = '';
  const footerEl = container.querySelector('.z2-message-item-right-footer') || container.querySelector('.z2-message-item-left-footer');
  if (footerEl) {
    const timeEl = footerEl.querySelector('.el-tooltip');
    if (timeEl) time = timeEl.textContent.trim();
  }

  const msgId = container.id || 'msg_' + index;

  // Quoted content - hỗ trợ 2 loại class
  let quotedContent = null;
  let quotedSender = null;

  // Loại 1: .z2-message-reply-quoted-content
  const quotedContentEl = container.querySelector('.z2-message-reply-quoted-content');
  const quotedSenderEl = container.querySelector('.z2-message-reply-quoted-sender');
  if (quotedContentEl) quotedContent = quotedContentEl.textContent?.trim();
  if (quotedSenderEl) quotedSender = quotedSenderEl.textContent?.trim();

  // Loại 2: .border-answer (cấu trúc mới)
  if (!quotedContent || !quotedSender) {
    const borderAnswer = container.querySelector('.border-answer');
    if (borderAnswer) {
      const senderEl = borderAnswer.querySelector('.fw-semibold');
      const contentEl = borderAnswer.querySelector('.mb-0.text-normal');
      if (senderEl && !quotedSender) quotedSender = senderEl.textContent?.trim();
      if (contentEl && !quotedContent) quotedContent = contentEl.textContent?.trim();
    }
  }

  // Message content
  let content = '';
  let textEl = container.querySelector('.z2-message-item-right-content span[id="regexText"]');
  if (!textEl) textEl = container.querySelector('.z2-message-item-left-content span[id="regexText"]');
  if (!textEl) textEl = container.querySelector('.z2-message-item-right .mb-0.text-normal span');
  if (!textEl) textEl = container.querySelector('.z2-message-item-left .mb-0.text-normal span');
  // Text trực tiếp trong div (ảnh + nội dung: div.mb-0.mt-1.mx-12.text-normal)
  if (!textEl) textEl = container.querySelector('.text-normal.mb-0, .mb-0.mt-1.mx-12.text-normal');
  if (!textEl) {
    const contentDiv = container.querySelector('.z2-message-item-right-content, .z2-message-item-left-content');
    if (contentDiv) {
      const spans = contentDiv.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && text.length > 0 && !text.includes('Trả lời') && !text.includes('Chuyển tiếp') &&
            !text.includes('Ghim') && !text.includes('Copy') && !text.includes('Xoá') &&
            !text.includes('Lưu ảnh') && !text.includes('Chọn nhiều') && !text.includes('Thu hồi')) {
          textEl = span;
          break;
        }
      }
    }
  }

  if (textEl) content = textEl.textContent.trim();

  // Images - hỗ trợ cấu trúc mới: .photo-container, .group-img-container, .el-image
  const imageUrls = [];
  const isMultiImage = container.querySelector('.group-img-container') !== null;

  if (isMultiImage) {
    container.querySelectorAll('.group-img-container img').forEach(img => {
      const src = img.src || img.getAttribute('src');
      if (src && !isUiIcon(src)) imageUrls.push(src);
    });
  }

  if (imageUrls.length === 0) {
    // Tin nhắn 1 ảnh: .photo-container > .el-image > img
    container.querySelectorAll('.photo-container img').forEach(img => {
      const src = img.src || img.getAttribute('src');
      if (src && !isUiIcon(src)) imageUrls.push(src);
    });
  }

  if (imageUrls.length === 0) {
    container.querySelectorAll('.el-image img').forEach(img => {
      const src = img.src || img.getAttribute('src');
      if (src && !isUiIcon(src)) imageUrls.push(src);
    });
  }

  if (imageUrls.length === 0) {
    container.querySelectorAll('img[src*="zdn.vn"]').forEach(img => {
      const src = img.src || img.getAttribute('src');
      if (src && !isUiIcon(src)) imageUrls.push(src);
    });
  }

  // imageUrl cho backend (1 ảnh = string, nhiều ảnh = JSON string)
  let imageUrl = null;
  if (imageUrls.length === 1) imageUrl = imageUrls[0];
  else if (imageUrls.length > 1) imageUrl = JSON.stringify(imageUrls);

  if (imageUrl && !content) content = '[Hình ảnh]';

  return {
    id: msgId,
    content: content,
    time: time,
    type: msgType,
    messageType: imageUrl ? 'image' : 'text',
    quotedContent: quotedContent || null,
    quotedSender: quotedSender || null,
    images: imageUrls.length > 0 ? imageUrls : null,
    imageUrl: imageUrl || undefined
  };
}

// Xóa tin nhắn mới ở trên cùng để giữ tin nhắn cũ
function cleanupOldMessages(keepCount = 100) {
  const containers = document.querySelectorAll('.z2-message-container');
  if (containers.length <= keepCount) return 0;

  // SaleWork: containers[0] = tin mới nhất (trên), containers[length-1] = tin cũ nhất (dưới)
  // Khi scroll lên: thêm tin cũ ở trên → cần xóa tin mới ở trên
  const toRemove = containers.length - keepCount;
  const removedMessages = [];

  // Xóa từ ĐẦU mảng (tin mới nhất) - giữ lại cuối mảng (tin cũ)
  for (let i = 0; i < toRemove; i++) {
    const el = containers[i]; // Lấy từ đầu = tin mới nhất
    // Extract full message data trước khi xóa
    const msgData = extractMessageData(el, i);
    removedMessages.push(msgData);
    el.remove();
  }

  if (removedMessages.length > 0) {
    messageCache.add(removedMessages);
    console.log('>>> [CLEANUP] Đã xóa ' + removedMessages.length + ' tin nhắn mới (trên), giữ ' + keepCount + ' tin cũ, cache: ' + messageCache.messages.length);
  }

  return removedMessages.length;
}

// Biến lưu tất cả tin nhắn đã extract
let allExtractedMessages = [];

async function scrollUpToLoadMessages() {
  // Reset biến khi bắt đầu scroll mới
  allExtractedMessages = [];

  await waitForCondition(
    () => document.querySelectorAll('.z2-message-container').length > 0,
    8000,
    500,
    1500
  );

  await new Promise(r => setTimeout(r, 500));

  let currentContainer = findScrollContainer();

  if (!currentContainer) {
    if (chrome.runtime) chrome.runtime.sendMessage({ type: 'CONTENT_LOG', text: 'KHONG tim thay scroll container!', logType: 'error' });
    return;
  }

  if (chrome.runtime) {
    chrome.runtime.sendMessage({
      type: 'CONTENT_LOG',
      text: 'Bat dau scroll load tin nhan...',
      logType: 'info'
    });
  }

  let lastCount = 0;
  let noChangeCount = 0;
  let i = 0;
  const MAX_NO_CHANGE = 5;
  const MAX_SCROLL_ATTEMPTS = 100;

  while (true) {
    i++;

    // Bước 1: Extract tin nhắn hiện tại và push vào array
    const currentContainers = document.querySelectorAll('.z2-message-container');
    const currentMessages = extractAllMessagesFromDOM(currentContainers);
    allExtractedMessages.push(...currentMessages);

    // Bước 2: Đánh dấu tất cả tin nhắn hiện tại với data-loaded="true"
    currentContainers.forEach(el => el.setAttribute('data-loaded', 'true'));

    const countBefore = currentContainers.length;

    if (chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'CONTENT_LOG',
        text: 'Scroll ' + i + ': extract ' + currentMessages.length + ' tin nhan, total: ' + allExtractedMessages.length,
        logType: 'success'
      });
    }

    // Bước 3: Scroll xuống bottom trước
    currentContainer.scrollTop = 0;
    currentContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));

    // Bước 4: Scroll lên top để load tin nhắn mới hơn
    currentContainer.scrollTop = -99999;
    currentContainer.scrollBy(0, -99999);
    currentContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

    await new Promise(r => setTimeout(r, 1000));

    // Chờ tin mới load xong
    let hasProgress = await waitForCondition(
      () => {
        const total = document.querySelectorAll('.z2-message-container').length;
        const loaded = document.querySelectorAll('.z2-message-container[data-loaded="true"]').length;
        const newMessages = total - loaded;
        return newMessages > 0;
      },
      4000,
      500,
      DYNAMIC_CONFIG.scrollMaxInterval
    );

    const totalAfter = document.querySelectorAll('.z2-message-container').length;
    const loadedAfter = document.querySelectorAll('.z2-message-container[data-loaded="true"]').length;
    const newMessages = totalAfter - loadedAfter;

    if (chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'CONTENT_LOG',
        text: 'Scroll ' + i + ': ' + totalAfter + ' tin (mới: ' + newMessages + ')',
        logType: newMessages > 0 ? 'success' : 'info'
      });
    }

    if (newMessages === 0 || !hasProgress) {
      noChangeCount++;
      if (noChangeCount >= MAX_NO_CHANGE) break;
    } else {
      noChangeCount = 0;
    }

    // Bước 5: Xóa các tin nhắn đã đánh dấu (đã extract)
    const loadedElements = document.querySelectorAll('.z2-message-container[data-loaded="true"]');
    loadedElements.forEach(el => el.remove());

    lastCount = allExtractedMessages.length;

    if (i >= MAX_SCROLL_ATTEMPTS) break;
  }

  // Bước cuối: Duyệt lại toàn bộ array để gán timestamp cho các tin nhắn
  let lastTimestampDate = null;
  for (let i = allExtractedMessages.length - 1; i >= 0; i--) {
    const m = allExtractedMessages[i];
    if (m.type === 'timestamp') {
      lastTimestampDate = parseDateFromTimestamp(m.time);
    } else if (lastTimestampDate && m.time && /^\d{1,2}:\d{2}$/.test(m.time.trim())) {
      m.time = lastTimestampDate + ' ' + m.time.trim();
    }
  }

  if (chrome.runtime) {
    chrome.runtime.sendMessage({
      type: 'CONTENT_LOG',
      text: 'Scroll xong: ' + allExtractedMessages.length + ' tin nhan',
      logType: 'info'
    });
  }
}

// Export messages để truy cập từ module khác
window.__allMessages = allExtractedMessages;

// ============ MODULE 04: EXTRACT ============
const UI_ICON_PATTERNS = ['emoji', 'icon', 'three_dots', 'assets/images'];

function isUiIcon(src) {
  if (!src || typeof src !== 'string') return true;
  return UI_ICON_PATTERNS.some(p => src.includes(p));
}

function parseDateFromTimestamp(timestampStr) {
  if (!timestampStr || typeof timestampStr !== 'string') return null;
  const parts = timestampStr.trim().split(/\s+/);
  if (parts.length >= 1 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(parts[0])) return parts[0];
  return null;
}

function extractMessages() {
  const messages = [];
  const allContainers = document.querySelectorAll('.z2-message-container');

  allContainers.forEach((container, index) => {
    try {
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
        }
        return;
      }

      const isRight = container.querySelector('.z2-message-item-right-container') !== null;
      const msgType = isRight ? 'sent' : 'received';

      let time = '';
      const footerEl = container.querySelector('.z2-message-item-right-footer') || container.querySelector('.z2-message-item-left-footer');
      if (footerEl) {
        const timeEl = footerEl.querySelector('.el-tooltip');
        if (timeEl) time = timeEl.textContent.trim();
      }

      const msgId = container.id || 'msg_' + index;

      // Quoted content
      const quotedContentEl = container.querySelector('.z2-message-reply-quoted-content');
      const quotedSenderEl = container.querySelector('.z2-message-reply-quoted-sender');
      const quotedContent = quotedContentEl?.textContent?.trim();
      const quotedSender = quotedSenderEl?.textContent?.trim();

      // Message content
      let content = '';
      let textEl = container.querySelector('.z2-message-item-right-content span[id="regexText"]');
      if (!textEl) textEl = container.querySelector('.z2-message-item-left-content span[id="regexText"]');
      if (!textEl) textEl = container.querySelector('.z2-message-item-right .mb-0.text-normal span');
      if (!textEl) textEl = container.querySelector('.z2-message-item-left .mb-0.text-normal span');
      if (!textEl) {
        const contentDiv = container.querySelector('.z2-message-item-right-content, .z2-message-item-left-content');
        if (contentDiv) {
          const spans = contentDiv.querySelectorAll('span');
          for (const span of spans) {
            const text = span.textContent?.trim();
            if (text && text.length > 0 && !text.includes('Trả lời') && !text.includes('Chuyển tiếp') &&
                !text.includes('Ghim') && !text.includes('Copy') && !text.includes('Xoá') &&
                !text.includes('Lưu ảnh') && !text.includes('Chọn nhiều') && !text.includes('Thu hồi')) {
              textEl = span;
              break;
            }
          }
        }
      }

      if (textEl) content = textEl.textContent.trim();

      // Images
      const imageUrls = [];
      const isMultiImage = container.querySelector('.group-img-container') !== null;

      if (isMultiImage) {
        const imgs = container.querySelectorAll('.group-img-container img');
        imgs.forEach(img => {
          const src = img.src || img.getAttribute('src');
          if (src && !isUiIcon(src)) imageUrls.push(src);
        });
      }

      if (imageUrls.length === 0) {
        const photoContainer = container.querySelector('.photo-container');
        if (photoContainer) {
          const imgSelectors = ['img.el-image__preview', 'img.el-image__inner', 'img[src]'];
          for (const sel of imgSelectors) {
            const imageEl = photoContainer.querySelector(sel);
            if (imageEl) {
              const src = imageEl.src || imageEl.getAttribute('src');
              if (src && !isUiIcon(src)) {
                imageUrls.push(src);
                break;
              }
            }
          }
        }
      }
      if (imageUrls.length === 0) {
        const elImage = container.querySelector('.el-image img');
        if (elImage) {
          const src = elImage.src || elImage.getAttribute('src');
          if (src && !isUiIcon(src)) imageUrls.push(src);
        }
      }
      if (imageUrls.length === 0) {
        const allImages = container.querySelectorAll('img');
        for (const img of allImages) {
          const src = img.src || img.getAttribute('src');
          if (src && !isUiIcon(src)) {
            imageUrls.push(src);
            break;
          }
        }
      }

      let imageUrl = '';
      if (imageUrls.length === 1) {
        imageUrl = imageUrls[0];
      } else if (imageUrls.length > 1) {
        imageUrl = JSON.stringify(imageUrls);
      }

      if (imageUrl && !content) content = '[Hình ảnh]';

      if (content || imageUrl) {
        messages.push({
          id: msgId,
          content: content,
          time: time,
          type: msgType,
          messageType: imageUrl ? 'image' : 'text',
          imageUrl: imageUrl || undefined,
          quotedContent: quotedContent,
          quotedSender: quotedSender
        });
      }
    } catch (e) {
      console.log('>>> [EXTRACT] Lỗi:', e.message);
    }
  });

  // Trả về allExtractedMessages (đã được xử lý timestamp ở cuối scroll)
  return allExtractedMessages;
}

// Extract tin nhắn từ DOM hiện tại (dùng trong khi scroll)
function extractMessagesFromDOM() {
  const containers = document.querySelectorAll('.z2-message-container:not([data-loaded="true"])');
  return extractAllMessagesFromDOM(containers);
}

// Extract tất cả tin nhắn từ containers được truyền vào
function extractAllMessagesFromDOM(containers) {
  const messages = [];

  containers.forEach((container, index) => {
    try {
      const msgData = extractMessageData(container, index);
      if (msgData.content || msgData.images || msgData.imageUrl) {
        messages.push(msgData);
      }
    } catch (e) {
      console.error('Error extracting message:', e);
    }
  });

  return messages;
}

// ============ MODULE 05: MAIN FLOW ============
window.__extractedMessages = [];
window.__extractedPhone = '';

var MAX_RETRIES = 5;
var POLL_INTERVAL_MS = 1500;
var BETWEEN_CONV_MS = 1000;
var INITIAL_WAIT_MS = 1500;

async function waitForConversationsLoaded() {
  await new Promise(r => setTimeout(r, INITIAL_WAIT_MS));

  for (let i = 1; i <= MAX_RETRIES; i++) {
    const allConvs = findAllConversations();
    if (allConvs.length > 0) return allConvs;
    if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return [];
}

/**
 * Lấy tên tư vấn viên từ tooltip của avatar nhỏ (z2-avatar-tooltip)
 * Trigger hover programmatically để Element UI render tooltip, đọc nội dung rồi ẩn lại
 * @param {Element} convElement - Conversation item element
 * @returns {Promise<string|null>} - Tên tư vấn viên hoặc null
 */
/**
 * Lấy tên khách hàng từ .name-conversation (VD: "Natadoor 0909168466 38")
 * @param {Element} convElement - Conversation item element
 * @returns {string|null}
 */
function getUserNameFromConversation(convElement) {
  const nameEl = convElement.querySelector('.name-conversation');
  if (!nameEl) return null;
  const text = nameEl.textContent?.trim().replace(/\s+/g, ' ');
  return text || null;
}

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

function fillAndSearchAndClick(phoneNumber) {
  console.log('[FILL_SEARCH] Starting for:', phoneNumber);
  return new Promise(function (resolve) {
    let currentRetry = 0;

    async function doSearchAndCrawl() {
      console.log('[FILL_SEARCH] Step 1: fillPhoneNumber');
      const inputFilled = fillPhoneNumber(phoneNumber);
      console.log('[FILL_SEARCH] Input filled:', inputFilled);
      if (!inputFilled) return null;

      console.log('[FILL_SEARCH] Step 2: findAndClickSearchButton');
      const button = findAndClickSearchButton();
      console.log('[FILL_SEARCH] Button found:', button ? 'yes' : 'no');
      if (button) {
        button.click();
        console.log('[FILL_SEARCH] Button clicked');
      } else {
        console.log('[FILL_SEARCH] Button NOT found!');
      }

      console.log('[FILL_SEARCH] Step 3: waitForConversationsLoaded');
      const allConvs = await waitForConversationsLoaded();
      console.log('[FILL_SEARCH] Conversations found:', allConvs.length);
      if (allConvs.length === 0) return [];

      return allConvs;
    }

    async function retrySearch() {
      if (currentRetry >= MAX_RETRIES) {
        const errMsg = 'Khong tim thay conversation sau ' + MAX_RETRIES + ' lan thu';
        resolve({ success: false, messages: [], error: errMsg });
        return;
      }

      currentRetry++;
      const allConvs = await doSearchAndCrawl();

      if (!allConvs) {
        setTimeout(retrySearch, 1000);
        return;
      }

      if (allConvs.length === 0) {
        setTimeout(retrySearch, 1000);
        return;
      }

      const conversations = [];

      for (let convIdx = 0; convIdx < allConvs.length; convIdx++) {
        const conv = allConvs[convIdx];
        const staffName = (await getStaffNameFromAvatarTooltip(conv)) || 'Conv ' + (convIdx + 1);
        const userName = getUserNameFromConversation(conv);

        const clickResult = await clickConversation(conv, convIdx, allConvs.length);
        if (clickResult && clickResult.rateLimit) {
          resolve({ success: false, rateLimit: true, error: 'Rate limit - khong co tin nhan sau khi click' });
          return;
        }

        await scrollUpToLoadMessages();

        const messages = extractMessages();

        const messagesWithStaff = messages.map((msg, idx) => ({ ...msg, staffName: staffName, order: idx }));
        conversations.push({ staffName, userName: userName || undefined, messages: messagesWithStaff });

        if (convIdx < allConvs.length - 1) {
          await new Promise(r => setTimeout(r, BETWEEN_CONV_MS));
        }
      }

      window.__extractedPhone = phoneNumber;
      resolve({ success: true, conversations, conversationsCount: allConvs.length });
    }

    retrySearch();
  });
}

// ============ MESSAGE LISTENER ============
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

// Export for debugging
window.__crawlerBundle = {
  findSearchInput,
  fillPhoneNumber,
  findAndClickSearchButton,
  findAllConversations,
  clickConversation,
  scrollUpToLoadMessages,
  getMessageCount,
  extractMessages,
  fillAndSearchAndClick,
  getStaffNameFromAvatarTooltip,
  getUserNameFromConversation
};

console.log('========================================');
console.log('=== Content Script Bundle: SẴN SÀNG ===');
console.log('========================================');
