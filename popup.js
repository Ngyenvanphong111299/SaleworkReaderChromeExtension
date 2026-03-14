// Sidebar popup script

console.log('=== Popup: Đã tải ===');

document.addEventListener('DOMContentLoaded', () => {
  console.log('>>> Popup DOMContentLoaded');

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const statusBadge = document.getElementById('statusBadge');
  const logList = document.getElementById('logList');
  const totalOrdersEl = document.getElementById('totalOrders');
  const processedOrdersEl = document.getElementById('processedOrders');

  let isProcessing = false;

  function addLog(message, type = 'info') {
    console.log('[LOG] ' + message);
    const now = new Date();
    const time = now.toLocaleTimeString('vi-VN', { hour12: false });
    const logItem = document.createElement('div');
    logItem.className = 'log-item ' + type;
    logItem.innerHTML = '<span class="log-time">[' + time + ']</span>' + escapeHtml(message);
    logList.appendChild(logItem);
    logList.scrollTop = logList.scrollHeight;
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'status show ' + type;

    // Update status badge
    statusBadge.className = 'status-badge';
    if (type === 'success') {
      statusBadge.classList.add('active');
      statusBadge.textContent = 'Đang chạy';
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
    console.log('>>> Xóa log');
    logList.innerHTML = '';
    addLog('Đã xóa nhật ký', 'info');
  });

  addLog('✓ Đã tải Sidebar', 'info');
  console.log('>>> UI elements initialized');

  // Start crawl
  startBtn.addEventListener('click', async () => {
    console.log('>>> Click nút Bắt Đầu Crawl');

    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner"></span>Đang khởi động...';
    stopBtn.classList.remove('hidden');
    isProcessing = true;

    showStatus('Đang khởi động crawl...', 'processing');
    addLog('>>> Bắt đầu crawl tất cả đơn...', 'info');

    try {
      console.log('>>> Gửi message START_CRAWL đến background...');
      const response = await chrome.runtime.sendMessage({
        type: 'START_CRAWL'
      });

      console.log('>>> Response từ background:', response);

      if (response?.success) {
        showStatus('Đã bắt đầu crawl ' + response.count + ' đơn', 'success');
        addLog('✓ Bắt đầu crawl ' + response.count + ' đơn', 'info');
        totalOrdersEl.textContent = response.count || 0;
        console.log('>>> Đã set totalOrders = ' + (response.count || 0));
      } else {
        const err = response?.error || 'Lỗi không xác định';
        showStatus(err, 'error');
        addLog('✗ Lỗi: ' + err, 'error');
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
    } catch (e) {
      console.log('>>> Exception:', e);
      showStatus('Lỗi: ' + e.message, 'error');
      addLog('✗ EXCEPTION: ' + e.message, 'error');
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
  });

  // Stop crawl
  stopBtn.addEventListener('click', async () => {
    console.log('>>> Click nút Dừng Lại');
    addLog('>>> Đang dừng crawl...', 'warn');
    await chrome.runtime.sendMessage({ type: 'STOP_CRAWL' });
    isProcessing = false;
    startBtn.disabled = false;
    startBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Start
    `;
    stopBtn.classList.add('hidden');
    showStatus('Đã dừng', 'error');
    addLog('✓ Đã dừng crawl', 'info');
  });

  // Manual Search button
  const manualSearchBtn = document.getElementById('manualSearchBtn');
  const manualPhoneInput = document.getElementById('manualPhoneInput');

  manualSearchBtn?.addEventListener('click', async () => {
    const phone = manualPhoneInput?.value?.trim();
    if (!phone) {
      addLog('Vui lòng nhập số điện thoại!', 'warn');
      return;
    }

    addLog('>>> Manual search: ' + phone, 'info');

    try {
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        addLog('Không tìm thấy tab!', 'error');
        return;
      }

      const tabId = tabs[0].id;

      // Check if on Salework
      if (!tabs[0].url?.includes('salework.net')) {
        addLog('Đang chuyển đến Salework...', 'info');
        await chrome.tabs.update(tabId, { url: 'https://zalo.salework.net/' });
        await new Promise(r => setTimeout(r, 3000));
      }

      // Inject content script
      addLog('Đang inject script...', 'info');
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });

      await new Promise(r => setTimeout(r, 1000));

      // Send FILL_AND_SEARCH message
      addLog('Đang search SDT: ' + phone, 'info');
      await chrome.tabs.sendMessage(tabId, {
        type: 'FILL_AND_SEARCH',
        phoneNumber: phone
      });

      addLog('Đã gửi yêu cầu search!', 'info');

    } catch (e) {
      addLog('Lỗi: ' + e.message, 'error');
    }
  });

  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('>>> Popup nhận message:', message);

    if (message.type === 'LOG_MESSAGE') {
      console.log('>>> Popup log:', message.message);
      addLog(message.message, message.logType || 'info');
    } else if (message.type === 'STATUS_UPDATE') {
      console.log('>>> STATUS_UPDATE - status:', message.status);

      if (message.status === 'processing') {
        console.log('>>> Đang xử lý - current:', message.current, 'total:', message.total, 'phone:', message.phone);
        processedOrdersEl.textContent = message.current;
        showStatus('Đang xử lý: ' + message.phone + ' (' + message.current + '/' + message.total + ')', 'processing');
        addLog('>>> Xử lý: ' + message.phone + ' (' + message.current + '/' + message.total + ')', 'info');
      } else if (message.status === 'done') {
        console.log('>>> Hoàn thành!');
        showStatus('Hoàn thành!', 'success');
        addLog('✓ HOÀN THÀNH!', 'success');
        startBtn.disabled = false;
        startBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start
        `;
        stopBtn.classList.add('hidden');
      } else if (message.status === 'error') {
        console.log('>>> Lỗi:', message.error);
        showStatus('Lỗi: ' + message.error, 'error');
        addLog('✗ Lỗi: ' + message.error, 'error');
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
    }
  });

  // Get initial status
  console.log('>>> Gửi message GET_STATUS...');
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    console.log('>>> Initial status:', response);
    if (response?.isProcessing) {
      showStatus('Đang xử lý...', 'processing');
      startBtn.disabled = true;
      stopBtn.classList.remove('hidden');
    }
  });

  console.log('>>> Popup sẵn sàng');
});
