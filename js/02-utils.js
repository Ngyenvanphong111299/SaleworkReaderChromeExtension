// Step 02: Tiện ích dùng chung cho background script

export function logToPopup(message, type = 'info') {
  chrome.runtime.sendMessage({
    type: 'LOG_MESSAGE',
    message: message,
    logType: type
  });
}

export function getPhoneFromOrder(order) {
  const phone = order.phoneNumber || order.PhoneNumber || order.phone || order.phone_number || null;
  return phone ? phone.trim() : null;
}
