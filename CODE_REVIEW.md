# CODE REVIEW: SaleWorkReaderChromeExtension

## Product Health Score: 6.5/10

---

## 🏗 Architecture: 6/10

### ✅ Điểm tốt:
- Module hóa tốt (01-05 config/utils/api/crawl/background)
- Tách biệt rõ ràng giữa content scripts và background script
- Sử dụng Manifest V3

### ❌ Critical Issues:
| Issue | Mô tả | Mức độ |
|-------|--------|---------|
| **Thiếu Error Boundaries** | Không có try-catch toàn diện, script có thể chết mà không biết | **Critical** |
| **Hardcoded API URL** | `http://localhost:5153` - không linh hoạt cho production | **High** |
| **Không có retry logic cho content script injection** | Nếu script fail sẽ dừng ngay | **High** |
| **State management yếu** | Dùng global variables (`isProcessing`) - không an toàn cho multiple tabs | **Medium** |

---

## 💻 Code Quality: 6.5/10

### ✅ Điểm tốt:
- Sử dụng ES6 modules
- Naming convention nhất quán
- Có comments rõ ràng

### ❌ Issues:
```javascript
// Problem 1: Hardcoded credentials/URLs
export const API_BASE = 'http://localhost:5153/api/v1';

// Problem 2: No input validation
phoneNumber = getPhoneFromOrder(order); // có thể undefined

// Problem 3: Magic numbers
await new Promise(r => setTimeout(r, TIMING.SALEWORK_LOAD)); // 3000ms

// Problem 4: Console.log thay vì proper logging
console.log('>>> [API] URL:', url); // Nên dùng structured logging
```

### SOLID Analysis:
- **S** (Single Responsibility): ✅ Tốt - mỗi file có 1 nhiệm vụ
- **O** (Open/Closed): ⚠️ Cần abstract hóa thêm
- **L** (Liskov Substitution): ✅ OK
- **I** (Interface Segregation): ⚠️ Cần tách interfaces
- **D** (Dependency Inversion): ❌ Phụ thuộc trực tiếp vào concrete classes

---

## 🔒 Security: 5/10

### ❌ Critical Vulnerabilities:

| Vulnerability | Location | Risk |
|--------------|----------|------|
| **SQL Injection potential** | API endpoint `POST /salework/messages` - directly inserting phoneNumber | **High** |
| **No CSRF protection** | API calls without tokens | **Medium** |
| **Sensitive data in logs** | `console.log(order)` - có thể chứa PII | **Medium** |
| **No input sanitization** | phoneNumber được insert trực tiếp vào DOM | **XSS risk** |

### Recommendations:
```javascript
// Nên validate trước khi dùng
if (!phoneNumber || !/^\d{10,11}$/.test(phoneNumber)) {
  throw new Error('Invalid phone number');
}

// Nên sanitize output
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

## ⚡ Reliability & Performance: 6/10

### ✅ Điểm tốt:
- Có retry logic trong `fetchOneOrder` (50 retries)
- Timing constants tách riêng

### ❌ Issues:
```javascript
// Problem: Memory leak potential
logList.appendChild(logItem); // Không có Giới hạn, log sẽ grow vô tận
logList.scrollTop = logList.scrollHeight;

// Problem: No timeout cho message passing
chrome.tabs.sendMessage(tabId, {...}, (response) => {
  // KHÔNG CÓ TIMEOUT - có thể block vô hạn
});

// Problem: No circuit breaker
// Nếu API down, sẽ retry 50 lần mỗi lần crawl = 50 * 15s = 12.5 phút fail
```

---

## 👥 UX/DX: 7/10

### ✅ Điểm tốt:
- Side panel UI trực quan
- Có status indicators
- Log hiển thị rõ ràng

### ❌ Issues:
- Không có setup documentation chi tiết
- Không có error recovery UI
- Không có progress bar

---

## 📝 Critical Issues (Cần fix NGAY):

### 1. SQL Injection - `js/03-api.js`
```javascript
// HIỆN TẠI - Nguy hiểm
const phoneNumber = getPhoneFromOrder(order);
await fetch(API_BASE + '/salework/messages', {
  body: JSON.stringify({ phoneNumber, messages }) // Direct insertion
});
```

### 2. Memory Leak - `popup.js`
```javascript
// Nên giới hạn log
if (logList.children.length > 100) {
  logList.removeChild(logList.firstChild);
}
```

### 3. No Timeout - `js/04-crawl.js`
```javascript
// Nên thêm timeout
await Promise.race([
  new Promise(resolve => chrome.tabs.sendMessage(tabId, msg, resolve)),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
]);
```

---

## 🛠 Optimization Suggestions:

### High Priority:
1. **Environment config** - Development/Production URLs
2. **Input validation** - Validate phone numbers, API responses
3. **Circuit breaker** - Stop after N consecutive failures
4. **Rate limiting** - Tránh bị Salework block

### Medium Priority:
1. **Structured logging** - Dùng logger library
2. **Error recovery UI** - Cho phép user retry từng step
3. **Progress bar** - Với ETA
4. **Unit tests** - Jest/Vitest

### Low Priority:
1. **PWA support** - Offline capability
2. **Dark mode** - UI enhancement
3. **Keyboard shortcuts** - Power user features

---

## 🗺️ Roadmap:

| Phase | Task | Priority |
|-------|------|----------|
| 1 | Fix SQL Injection + Input Validation | **Critical** |
| 2 | Add Circuit Breaker + Timeout | **High** |
| 3 | Environment Config (dev/prod) | **High** |
| 4 | Memory leak fix (log limit) | **Medium** |
| 5 | Error Recovery UI | **Medium** |
| 6 | Unit Tests | **Low** |

---

**Tổng kết:** Dự án có tiềm năng, architecture cơ bản tốt nhưng cần security audit và robustness improvements trước khi production release.

---

*Review Date: 2026-03-15*
*Reviewer: AI Assistant (Product Engineer)*
