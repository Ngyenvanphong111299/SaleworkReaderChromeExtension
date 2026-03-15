// Step 00: Settings management - lưu và đọc config từ chrome.storage

const STORAGE_KEY = 'salework_crawler_settings';

// Default settings
const DEFAULT_SETTINGS = {
  // API Configuration
  apiBaseUrl: 'https://omnichannel.hoangkimeco.com/api/v1',

  // Mode
  mode: 'production', // 'development' hoặc 'production'

  // Logging
  logLevel: 'info', // 'debug', 'info', 'warn', 'error'

  // Crawl settings
  defaultOrderLimit: 99999,
  delayBetweenOrders: 15000, // 15s

  // UI settings
  showNotifications: true,
  autoOpenSidePanel: true
};

/**
 * Lấy tất cả settings
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Settings: Lỗi đọc storage:', chrome.runtime.lastError);
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }

      const stored = result[STORAGE_KEY];
      if (stored) {
        // Merge với defaults để đảm bảo có đủ fields
        resolve({ ...DEFAULT_SETTINGS, ...stored });
      } else {
        resolve({ ...DEFAULT_SETTINGS });
      }
    });
  });
}

/**
 * Lưu settings
 * @param {Object} settings - Settings object cần lưu
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    const data = {};
    data[STORAGE_KEY] = settings;

    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        console.error('Settings: Lỗi lưu storage:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      console.log('Settings: Đã lưu', settings);
      resolve();
    });
  });
}

/**
 * Cập nhật một setting cụ thể
 * @param {string} key - Key cần update
 * @param {*} value - Giá trị mới
 * @returns {Promise<Object>} - Settings mới
 */
export async function updateSetting(key, value) {
  const current = await getSettings();
  const updated = { ...current, [key]: value };
  await saveSettings(updated);
  return updated;
}

/**
 * Reset về mặc định
 * @returns {Promise<Object>}
 */
export async function resetSettings() {
  await saveSettings(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

/**
 * Lấy API Base URL (dùng ngay lập tức, không cần async)
 * @returns {string}
 */
export function getApiBaseUrlSync() {
  // Fallback nhanh nếu chưa load được từ storage
  return DEFAULT_SETTINGS.apiBaseUrl;
}

// Init settings khi load (gọi 1 lần ở background.js)
let settingsPromise = null;

export function initSettings() {
  if (!settingsPromise) {
    settingsPromise = getSettings().then((settings) => {
      console.log('Settings: Đã khởi tạo', settings);
      return settings;
    });
  }
  return settingsPromise;
}

export { DEFAULT_SETTINGS };