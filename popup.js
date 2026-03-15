// Sidebar popup script (v2.1 - Enhanced with Progress & Error Recovery)

console.log('=== Popup v2.1: Đã tải ===');

// ============ CONFIG ============
const MAX_LOG_ITEMS = 100;
const PROGRESS_ESTIMATE_SAMPLES = 5; // Số mẫu để tính ETA

document.addEventListener('DOMContentLoaded', () => {
  console.log('>>> Popup DOMContentLoaded');

  // UI Elements
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const statusBadge = document.getElementById('statusBadge');
  const logList = document.getElementById('logList');
  const totalOrdersEl = document.getElementById('totalOrders');
  const totalConversationsEl = document.getElementById('totalConversations');
  const totalMessagesEl = document.getElementById('totalMessages');

  // Progress Elements
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  const progressEta = document.getElementById('progressEta');

  // Error Recovery Elements
  const errorRecovery = document.getElementById('errorRecovery');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const retryBtn = document.getElementById('retryBtn');
  const skipBtn = document.getElementById('skipBtn');

  let isProcessing = false;
  let totalOrders = 0;
  let completedOrders = 0;

  // ETA Calculation
  const timeSamples = [];

  /**
   * Calculate and update ETA
   */
  function updateProgress(current, total) {
    if (total <= 0) return;

    const percent = Math.round((current / total) * 100);
    progressFill.style.width = percent + '%';
    progressPercent.textContent = percent + '%';

    // Calculate ETA
    if (current > 0 && timeSamples.length > 0) {
      const avgTimePerOrder = timeSamples.reduce((a, b) => a + b, 0) / timeSamples.length;
      const remainingOrders = total - current;
      const etaSeconds = Math.round(avgTimePerOrder * remainingOrders / 1000);

      if (etaSeconds < 60) {
        progressEta.textContent = `Còn ~${etaSeconds}s`;
      } else if (etaSeconds < 3600) {
        progressEta.textContent = `Còn ~${Math.round(etaSeconds / 60)}p`;
      } else {
        progressEta.textContent = `Còn ~${Math.round(etaSeconds / 3600)}h`;
      }
    }
  }

  /**
   * Show/hide progress bar
   */
  function toggleProgress(show) {
    if (show) {
      progressContainer.classList.add('show');
    } else {
      progressContainer.classList.remove('show');
    }
  }

  /**
   * Show error recovery UI
   */
  function showError(title, message, canRetry = true, canSkip = true) {
    errorTitle.textContent = title || 'Lỗi';
    errorMessage.textContent = message || 'Đã xảy ra lỗi không mong muốn';

    retryBtn.style.display = canRetry ? 'flex' : 'none';
    skipBtn.style.display = canSkip ? 'block' : 'none';

    errorRecovery.classList.add('show');
  }

  /**
   * Hide error recovery UI
   */
  function hideError() {
    errorRecovery.classList.remove('show');
  }

  /**
   * Validate phone number (Vietnamese format)
   */
  function isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const digits = phone.replace(/\D/g, '');
    const patterns = [/^0[3-9]\d{8}$/, /^84[3-9]\d{8}$/, /^\+84[3-9]\d{8}$/];
    return patterns.some(pattern => pattern.test(digits));
  }

  /**
   * Add log với memory leak protection
   */
  function addLog(message, type = 'info') {
    console.log('[LOG] ' + message);
    const now = new Date();
    const time = now.toLocaleTimeString('vi-VN', { hour12: false });
    const logItem = document.createElement('div');
    logItem.className = 'log-item ' + type;
    logItem.innerHTML = '<span class="log-time">[' + time + ']</span>' + escapeHtml(message);
    logList.appendChild(logItem);

    while (logList.children.length > MAX_LOG_ITEMS) {
      logList.removeChild(logList.firstChild);
    }

    logList.scrollTop = logList.scrollHeight;
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'status show ' + type;

    statusBadge.className = 'status-badge';
    if (type === 'success') {
      statusBadge.classList.add('active');
      statusBadge.textContent = 'Hoàn thành';
    } else if (type === 'error') {
      statusBadge.classList.add('error');
      statusBadge.textContent = 'Lỗi';
    } else if (type === 'processing') {
      statusBadge.classList.add('processing');
      statusBadge.textContent = 'Đang xử lý';
    } else {
      statusBadge.textContent = 'Sẵn sàng';
    }

    console.log('[STATUS] ' + message + ' (' + type + ')');
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Clear log
  document.getElementById('clearLogBtn').addEventListener('click', () => {
    logList.innerHTML = '';
    addLog('Đã xóa nhật ký', 'info');
  });

  addLog('✓ Đã tải Sidebar v2.1', 'info');
  console.log('>>> UI elements initialized');

  // ============ START CRAWL ============
  startBtn.addEventListener('click', async () => {
    console.log('>>> Click nút Bắt Đầu Crawl');

    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner"></span>Đang khởi động...';
    stopBtn.classList.remove('hidden');
    isProcessing = true;
    completedOrders = 0;
    timeSamples.length = 0;

    toggleProgress(true);
    hideError();
    showStatus('Đang khởi động crawl...', 'processing');
    addLog('>>> Bắt đầu crawl tất cả đơn...', 'info');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_CRAWL' });

      if (response?.success) {
        showStatus('Hoàn thành crawl ' + response.count + ' đơn', 'success');
        addLog('✓ Hoàn thành: ' + response.count + ' đơn, ' + (response.totalConversations ?? 0) + ' hội thoại, ' + (response.totalMessages ?? 0) + ' tin nhắn', 'success');
        totalOrdersEl.textContent = response.count || 0;
        if (totalConversationsEl) totalConversationsEl.textContent = response.totalConversations ?? 0;
        if (totalMessagesEl) totalMessagesEl.textContent = response.totalMessages ?? 0;
        toggleProgress(false);
      } else {
        const err = response?.error || 'Lỗi không xác định';
        showStatus(err, 'error');
        addLog('✗ Lỗi: ' + err, 'error');

        // Show error recovery for circuit breaker
        if (err.includes('Circuit breaker')) {
          showError('Circuit Breaker Open', 'Quá nhiều lỗi liên tiếp. Vui lòng kiểm tra kết nối và thử lại sau.', false, false);
        }

        resetStartButton();
      }
    } catch (e) {
      console.log('>>> Exception:', e);
      showStatus('Lỗi: ' + e.message, 'error');
      addLog('✗ EXCEPTION: ' + e.message, 'error');

      showError('Lỗi kết nối', e.message, true, true);
      resetStartButton();
    }
  });

  // ============ RETRY BUTTON ============
  retryBtn.addEventListener('click', async () => {
    hideError();
    addLog('>>> Thử lại...', 'info');
    startBtn.click();
  });

  // ============ SKIP BUTTON ============
  skipBtn.addEventListener('click', async () => {
    hideError();
    addLog('>>> Bỏ qua lỗi, tiếp tục...', 'warn');
    // Send message to skip current order and continue
    await chrome.runtime.sendMessage({ type: 'SKIP_CURRENT_ORDER' });
  });

  // ============ STOP CRAWL ============
  stopBtn.addEventListener('click', async () => {
    console.log('>>> Click nút Dừng Lại');
    addLog('>>> Đang dừng crawl...', 'warn');
    await chrome.runtime.sendMessage({ type: 'STOP_CRAWL' });
    isProcessing = false;
    resetStartButton();
    showStatus('Đã dừng', 'error');
    addLog('✓ Đã dừng crawl', 'info');
    toggleProgress(false);
  });

  function resetStartButton() {
    startBtn.disabled = false;
    startBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Start
    `;
    stopBtn.classList.add('hidden');
  }

  // ============ MANUAL SEARCH ============
  const manualSearchToggle = document.getElementById('manualSearchToggle');
  const manualSearchInput = document.getElementById('manualSearchInput');
  const manualSearchBtn = document.getElementById('manualSearchBtn');
  const manualPhoneInput = document.getElementById('manualPhoneInput');

  manualSearchToggle?.addEventListener('click', () => {
    manualSearchInput?.classList.toggle('hidden');
  });

  manualSearchBtn?.addEventListener('click', async () => {
    let phone = manualPhoneInput?.value?.trim();
    if (!phone) {
      addLog('Vui lòng nhập số điện thoại!', 'warn');
      return;
    }

    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('84')) phone = '0' + phone.substring(2);

    if (!isValidPhoneNumber(phone)) {
      addLog('Số điện thoại không hợp lệ!', 'error');
      return;
    }

    addLog('>>> Manual search: ' + phone, 'info');

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        addLog('Không tìm thấy tab!', 'error');
        return;
      }

      const tabId = tabs[0].id;

      if (!tabs[0].url?.includes('salework.net')) {
        addLog('Đang chuyển đến Salework...', 'info');
        await chrome.tabs.update(tabId, { url: 'https://zalo.salework.net/' });
        await new Promise(r => setTimeout(r, 3000));
      }

      addLog('Đang inject script...', 'info');
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content/bundle.js']
      });

      await new Promise(r => setTimeout(r, 1000));

      addLog('Đang search SDT: ' + phone, 'info');

      try {
        // Gửi message và đợi response
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'FILL_AND_SEARCH',
          phoneNumber: phone
        });

        console.log('>>> Response from content:', response);
        addLog('Phản hồi: ' + JSON.stringify(response)?.substring(0, 100), response?.success ? 'success' : 'warn');

        if (response?.success) {
          addLog('Hoàn thành! ' + response.messages?.length + ' tin nhắn, ' + response.conversationsCount + ' hội thoại', 'success');
        } else if (response?.error) {
          addLog('Lỗi: ' + response.error, 'error');
        }
      } catch (e) {
        console.log('>>> SendMessage error:', e);
        if (e.message?.includes('No message received')) {
          addLog('Content script không phản hồi!', 'error');
        } else if (e.message?.includes('Could not establish connection')) {
          addLog('Lỗi kết nối. Refresh page và thử lại!', 'error');
        } else {
          addLog('Lỗi: ' + e.message, 'error');
        }
      }
    } catch (e) {
      addLog('Lỗi: ' + e.message, 'error');
    }
  });

  // ============ MESSAGE LISTENER ============
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('>>> Popup nhận message:', message);

    if (message.type === 'LOG_MESSAGE') {
      addLog(message.message, message.logType || 'info');
    }

    if (message.type === 'STATUS_UPDATE') {
      if (message.status === 'processing') {
        totalOrders = message.total || 0;
        completedOrders = message.current || 0;

        totalOrdersEl.textContent = completedOrders;
        showStatus('Đang xử lý: ' + message.phone + ' (' + completedOrders + '/' + totalOrders + ')', 'processing');
        addLog('>>> Xử lý: ' + message.phone, 'info');

        // Update progress
        if (totalOrders > 0) {
          updateProgress(completedOrders, totalOrders);
        }

        // Track time for ETA
        if (message.lastOrderTime) {
          timeSamples.push(message.lastOrderTime);
          if (timeSamples.length > PROGRESS_ESTIMATE_SAMPLES) {
            timeSamples.shift();
          }
        }
      }

      if (message.status === 'done') {
        totalOrdersEl.textContent = message.totalOrders ?? totalOrdersEl.textContent;
        if (totalConversationsEl) totalConversationsEl.textContent = message.totalConversations ?? 0;
        if (totalMessagesEl) totalMessagesEl.textContent = message.totalMessages ?? 0;
        showStatus('Hoàn thành!', 'success');
        addLog('✓ HOÀN THÀNH! Đơn: ' + (message.totalOrders ?? 0) + ' | Hội thoại: ' + (message.totalConversations ?? 0) + ' | Tin nhắn: ' + (message.totalMessages ?? 0), 'success');
        resetStartButton();
        toggleProgress(false);
      }

      if (message.status === 'error') {
        showStatus('Lỗi: ' + message.error, 'error');
        addLog('✗ Lỗi: ' + message.error, 'error');

        // Show error recovery
        showError('Lỗi', message.error, true, true);
        resetStartButton();
      }

      if (message.status === 'circuit_breaker') {
        showError('Circuit Breaker Open', 'Quá 5 lần lỗi liên tiếp. Hệ thống tạm dừng để bảo vệ.', false, false);
        resetStartButton();
        toggleProgress(false);
      }
    }
  });

  // Get initial status
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response?.isProcessing) {
      showStatus('Đang xử lý...', 'processing');
      startBtn.disabled = true;
      stopBtn.classList.remove('hidden');
      toggleProgress(true);
    }
  });

  console.log('>>> Popup sẵn sàng');
});
