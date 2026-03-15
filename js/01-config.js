// Step 01: Cấu hình extension - hằng số dùng chung

export const API_BASE = 'http://localhost:5153/api/v1';

/** Thời gian chờ (ms) - baseline values cho dynamic waiting */
export const TIMING = {
  SALEWORK_LOAD: 3000,
  SCRIPT_INJECT_DELAY: 1000,
  PROCESS_WAIT: 15000,
  BETWEEN_ORDERS: 2000,
  SEARCH_RESULT_WAIT: 6000,
  CONVERSATION_LOAD: 3000,
  SCROLL_WAIT: 4000,
  MAX_SCROLL_ATTEMPTS: 100,
  MAX_NO_CHANGE_SCROLL: 5,
  RETRY_DELAY: 1000,
  MAX_RETRIES: 5,
  EXTRACT_DELAY: 2000,

  // Dynamic waiting config
  DYNAMIC_MIN_INTERVAL: 300,     // Tối thiểu 300ms giữa các lần check
  DYNAMIC_MAX_INTERVAL: 2000,    // Tối đa 2s giữa các lần check
  DYNAMIC_TIMEOUT: 30000,        // Timeout mặc định cho dynamic wait
  PROGRESS_CHECK_INTERVAL: 500  // Interval kiểm tra progress
};

/**
 * Chờ đợi một điều kiện với exponential backoff
 * @param {Function} conditionFn - Hàm kiểm tra điều kiện, trả về true nếu thỏa mãn
 * @param {number} timeout - Thời gian timeout tối đa (ms)
 * @param {number} initialInterval - Interval ban đầu (ms)
 * @param {number} maxInterval - Interval tối đa (ms)
 * @param {number} multiplier - Hệ số exponential backoff
 * @returns {Promise<boolean>} - true nếu condition thỏa mãn, false nếu timeout
 */
export async function waitForCondition(
  conditionFn,
  timeout = TIMING.DYNAMIC_TIMEOUT,
  initialInterval = TIMING.DYNAMIC_MIN_INTERVAL,
  maxInterval = TIMING.DYNAMIC_MAX_INTERVAL,
  multiplier = 1.5
) {
  const startTime = Date.now();
  let currentInterval = initialInterval;

  while (Date.now() - startTime < timeout) {
    if (conditionFn()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, currentInterval));

    // Exponential backoff với jitter
    currentInterval = Math.min(currentInterval * multiplier, maxInterval);
  }

  return conditionFn(); // Thử最后一次
}

/**
 * Chờ đợi element xuất hiện trong DOM
 * @param {string|string[]} selectors - Selector hoặc mảng selectors
 * @param {number} timeout - Timeout (ms)
 * @returns {Promise<Element|null>} - Element tìm thấy hoặc null
 */
export async function waitForElement(selectors, timeout = TIMING.DYNAMIC_TIMEOUT) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  // Thử ngay lập tức trước
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
    TIMING.DYNAMIC_MIN_INTERVAL,
    TIMING.DYNAMIC_MAX_INTERVAL
  );

  // Trả về kết quả cuối cùng
  for (const selector of selectorArray) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  return null;
}

/**
 * Chờ đợi số lượng elements tăng lên
 * @param {string} selector - CSS selector
 * @param {number} minCount - Số lượng tối thiểu mong muốn
 * @param {number} timeout - Timeout (ms)
 * @returns {Promise<number>} - Số lượng elements tìm thấy
 */
export async function waitForElementCount(
  selector,
  minCount = 1,
  timeout = TIMING.DYNAMIC_TIMEOUT
) {
  const checkFn = () => {
    const elements = document.querySelectorAll(selector);
    return elements.length >= minCount ? elements.length : -1;
  };

  // Thử ngay lập tức
  let count = checkFn();
  if (count >= minCount) return count;

  // Chờ với dynamic interval
  await waitForCondition(
    () => checkFn() >= minCount,
    timeout,
    TIMING.DYNAMIC_MIN_INTERVAL,
    TIMING.DYNAMIC_MAX_INTERVAL
  );

  return checkFn();
}

/**
 * Chờ đợi giá trị thay đổi (dùng cho scroll detection)
 * @param {Function} valueFn - Hàm lấy giá trị
 * @param {number} minChange - Thay đổi tối thiểu để coi là có progress
 * @param {number} timeout - Timeout (ms)
 * @param {number} stableCount - Số lần giá trị không đổi để xác nhận done
 * @returns {Promise<{hasProgress: boolean, finalValue: number}>}
 */
export async function waitForValueChange(
  valueFn,
  minChange = 1,
  timeout = TIMING.DYNAMIC_TIMEOUT,
  stableCount = 3
) {
  const startTime = Date.now();
  let lastValue = valueFn();
  let unchangedCount = 0;
  let currentInterval = TIMING.DYNAMIC_MIN_INTERVAL;

  while (Date.now() - startTime < timeout) {
    const currentValue = valueFn();

    if (currentValue !== lastValue) {
      // Có thay đổi - reset counter
      if (currentValue > lastValue) {
        // Progress tích cực
        return { hasProgress: true, finalValue: currentValue };
      }
      lastValue = currentValue;
      unchangedCount = 0;
    } else {
      unchangedCount++;
      if (unchangedCount >= stableCount) {
        // Không thay đổi sau N lần -> done
        return { hasProgress: false, finalValue: currentValue };
      }
    }

    await new Promise(resolve => setTimeout(resolve, currentInterval));
    currentInterval = Math.min(currentInterval * 1.3, TIMING.DYNAMIC_MAX_INTERVAL);
  }

  return { hasProgress: lastValue !== valueFn(), finalValue: valueFn() };
}

/**
 * Delay với jitter để tránh thundering herd
 * @param {number} baseMs - Thời gian cơ bản (ms)
 * @param {number} jitterPct - % jitter (0-1)
 * @returns {Promise<void>}
 */
export async function delayWithJitter(baseMs, jitterPct = 0.2) {
  const jitter = baseMs * jitterPct * Math.random();
  const actualDelay = baseMs + jitter;
  await new Promise(resolve => setTimeout(resolve, actualDelay));
}
