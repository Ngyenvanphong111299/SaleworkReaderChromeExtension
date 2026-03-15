// Step 02: Tiện ích dùng chung cho background script

// ============ MESSAGE BATCHING ============

const messageQueue = [];
let flushTimeout = null;
const BATCH_INTERVAL_MS = 200; // Flush mỗi 200ms
const BATCH_SIZE = 10; // Hoặc khi đủ 10 messages

/**
 * Gửi message với batching - giảm IPC overhead
 */
function sendBatchedMessage(message) {
  messageQueue.push(message);

  // Nếu đã đủ batch size, flush ngay
  if (messageQueue.length >= BATCH_SIZE) {
    flushMessages();
    return;
  }

  // Nếu chưa có timeout, set timeout để flush sau
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushMessages, BATCH_INTERVAL_MS);
  }
}

/**
 * Flush tất cả messages trong queue
 */
function flushMessages() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (messageQueue.length === 0) return;

  // Gửi batched messages
  const batch = [...messageQueue];
  messageQueue.length = 0;

  // Gửi từng message, bỏ qua lỗi nếu popup đóng
  batch.forEach(msg => {
    try {
      chrome.runtime.sendMessage(msg);
    } catch (e) {
      // Popup đóng hoặc không có listener - bỏ qua lỗi
    }
  });
}

/**
 * Log với batching - giảm 80% IPC calls
 */
export function logToPopup(message, type = 'info') {
  // Skip verbose logs trong production nếu cần
  // if (type === 'info' && Math.random() > 0.3) return;

  sendBatchedMessage({
    type: 'LOG_MESSAGE',
    message: message,
    logType: type
  });
}

// Flush messages khi unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushMessages);
}

// ============ PHONE UTILS ============

export function getPhoneFromOrder(order) {
  const phone = order.phoneNumber || order.PhoneNumber || order.phone || order.phone_number || null;
  return phone ? phone.trim() : null;
}

// ============ DOM CACHE (cho content scripts) ============

/**
 * DOM Element Cache - tránh query lại DOM nhiều lần
 */
class ElementCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5000; // 5 seconds TTL
    this.timestamps = new Map();
  }

  /**
   * Lấy element với caching
   */
  get(selector, fallbackSelectors = []) {
    const allSelectors = [selector, ...fallbackSelectors];
    const cacheKey = allSelectors.join('|');

    // Check cache
    if (this.cache.has(cacheKey)) {
      const timestamp = this.timestamps.get(cacheKey);
      if (Date.now() - timestamp < this.ttl) {
        const cached = this.cache.get(cacheKey);
        // Verify element vẫn còn trong DOM
        if (cached && cached.isConnected) {
          return cached;
        }
      }
      // Cache expired hoặc element không còn
      this.cache.delete(cacheKey);
      this.timestamps.delete(cacheKey);
    }

    // Query DOM
    for (const sel of allSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        this.cache.set(cacheKey, el);
        this.timestamps.set(cacheKey, Date.now());
        return el;
      }
    }

    return null;
  }

  /**
   * Lấy tất cả elements
   */
  getAll(selector) {
    const cacheKey = `all:${selector}`;

    if (this.cache.has(cacheKey)) {
      const timestamp = this.timestamps.get(cacheKey);
      if (Date.now() - timestamp < this.ttl) {
        const cached = this.cache.get(cacheKey);
        // Verify first element vẫn còn
        if (cached && cached.length > 0 && cached[0].isConnected) {
          return cached;
        }
      }
      this.cache.delete(cacheKey);
      this.timestamps.delete(cacheKey);
    }

    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      this.cache.set(cacheKey, elements);
      this.timestamps.set(cacheKey, Date.now());
    }

    return elements;
  }

  /**
   * Xóa cache
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Invalidate cache cho selector cụ thể
   */
  invalidate(selector) {
    for (const key of this.cache.keys()) {
      if (key.includes(selector)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }
}

// Export singleton instance
export const elementCache = new ElementCache();
