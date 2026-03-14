// Sidebar popup script

console.log('=== Popup: Đã tải ===');

document.addEventListener('DOMContentLoaded', () => {
  console.log('>>> Popup DOMContentLoaded');

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const logList = document.getElementById('logList');
  const limitInput = document.getElementById('limitInput');
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
  });

  addLog('✓ Đã tải Sidebar', 'info');
  console.log('>>> UI elements initialized');

  // Start crawl
  startBtn.addEventListener('click', async () => {
    console.log('>>> Click nút Bắt Đầu Crawl');
    const limit = parseInt(limitInput.value) || 10;

    console.log('>>> Số lượng đơn: ' + limit);

    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner"></span>Đang khởi động...';
    stopBtn.style.display = 'block';
    isProcessing = true;

    showStatus('Đang khởi động crawl...', 'processing');
    addLog('>>> Bắt đầu crawl ' + limit + ' đơn...', 'info');

    try {
      console.log('>>> Gửi message START_CRAWL đến background...');
      const response = await chrome.runtime.sendMessage({
        type: 'START_CRAWL',
        limit: limit
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
        startBtn.textContent = 'Bắt Đầu Crawl';
        stopBtn.style.display = 'none';
      }
    } catch (e) {
      console.log('>>> Exception:', e);
      showStatus('Lỗi: ' + e.message, 'error');
      addLog('✗ EXCEPTION: ' + e.message, 'error');
      startBtn.disabled = false;
      startBtn.textContent = 'Bắt Đầu Crawl';
      stopBtn.style.display = 'none';
    }
  });

  // Stop crawl
  stopBtn.addEventListener('click', async () => {
    console.log('>>> Click nút Dừng Lại');
    addLog('>>> Đang dừng crawl...', 'warn');
    await chrome.runtime.sendMessage({ type: 'STOP_CRAWL' });
    isProcessing = false;
    startBtn.disabled = false;
    startBtn.textContent = 'Bắt Đầu Crawl';
    stopBtn.style.display = 'none';
    showStatus('Đã dừng', 'error');
    addLog('✓ Đã dừng crawl', 'info');
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
        addLog('✓ HOÀN THÀNH!', 'info');
        startBtn.disabled = false;
        startBtn.textContent = 'Bắt Đầu Crawl';
        stopBtn.style.display = 'none';
      } else if (message.status === 'error') {
        console.log('>>> Lỗi:', message.error);
        showStatus('Lỗi: ' + message.error, 'error');
        addLog('✗ Lỗi: ' + message.error, 'error');
        startBtn.disabled = false;
        startBtn.textContent = 'Bắt Đầu Crawl';
        stopBtn.style.display = 'none';
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
      stopBtn.style.display = 'block';
    }
  });

  console.log('>>> Popup sẵn sàng');
});
