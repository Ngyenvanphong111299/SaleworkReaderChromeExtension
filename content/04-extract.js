// Step 04: Trích xuất tin nhắn từ DOM

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
  console.log('');
  console.log('>>> [EXTRACT] Bắt đầu trích xuất tin nhắn...');

  const messages = [];
  const allContainers = document.querySelectorAll('.z2-message-container');

  console.log('>>> [EXTRACT] Tìm thấy ' + allContainers.length + ' z2-message-container');

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

      const quotedContentEl = container.querySelector('.z2-message-reply-quoted-content');
      const quotedSenderEl = container.querySelector('.z2-message-reply-quoted-sender');
      const quotedContent = quotedContentEl?.textContent?.trim();
      const quotedSender = quotedSenderEl?.textContent?.trim();

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

      // Lấy toàn bộ link ảnh - hỗ trợ 1 ảnh và nhiều ảnh (group-img-container)
      const imageUrls = [];
      const isMultiImage = container.querySelector('.group-img-container') !== null;

      if (isMultiImage) {
        const imgs = container.querySelectorAll('.group-img-container img');
        imgs.forEach(function (img) {
          const src = img.src || img.getAttribute('src');
          if (src && !isUiIcon(src)) {
            imageUrls.push(src);
          }
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

      // Tin nhắn ảnh: 1 ảnh = string, nhiều ảnh = JSON [link1, link2]
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
      console.log('>>> [EXTRACT] ✗ Lỗi trích xuất tin nhắn #' + index + ':', e.message);
    }
  });

  // Pass 2: Duyệt ngược - timestamp đánh dấu ngày cho các tin nhắn PHÍA TRƯỚC nó trong DOM
  let lastTimestampDate = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type === 'timestamp') {
      lastTimestampDate = parseDateFromTimestamp(m.time);
    } else if (lastTimestampDate && m.time && /^\d{1,2}:\d{2}$/.test(m.time.trim())) {
      m.time = lastTimestampDate + ' ' + m.time.trim();
    }
  }

  console.log('>>> [EXTRACT] ✓ HOÀN THÀNH! Tổng số: ' + messages.length);
  return messages;
}
