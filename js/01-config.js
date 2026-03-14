// Step 01: Cấu hình extension - hằng số dùng chung

export const API_BASE = 'http://localhost:5153/api/v1';

/** Thời gian chờ (ms) */
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
  EXTRACT_DELAY: 2000
};
