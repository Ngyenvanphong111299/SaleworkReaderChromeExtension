# Salework Python Crawler - Configuration & Selectors
# Chuyển đổi từ js/01-config.js và content/bundle.js

from dataclasses import dataclass
from typing import List, Dict

# ============ TIMING CONFIG ============
@dataclass
class Timing:
    """Thời gian chờ (ms) - baseline values cho dynamic waiting"""
    SALEWORK_LOAD: int = 3000
    SCRIPT_INJECT_DELAY: int = 1000
    PROCESS_WAIT: int = 600000  # 10 phút
    BETWEEN_ORDERS: int = 2000
    SEARCH_RESULT_WAIT: int = 6000
    CONVERSATION_LOAD: int = 3000
    SCROLL_WAIT: int = 2500
    SCROLL_TIMEOUT: int = 200000  # 200 giây
    MAX_SCROLL_ATTEMPTS: int = 100
    MAX_NO_CHANGE_SCROLL: int = 3
    RETRY_DELAY: int = 1000
    MAX_RETRIES: int = 5
    EXTRACT_DELAY: int = 2000

    # Rate limit detection
    RATE_LIMIT_CHECK_INTERVAL_MS: int = 1000
    RATE_LIMIT_WAIT_MS: int = 30000
    RATE_LIMIT_RETRY_MAX: int = 3

    # Dynamic waiting config
    DYNAMIC_MIN_INTERVAL: int = 300
    DYNAMIC_MAX_INTERVAL: int = 2000
    DYNAMIC_TIMEOUT: int = 30000
    PROGRESS_CHECK_INTERVAL: int = 500


TIMING = Timing()

# ============ SELECTORS ============
SELECTORS: Dict[str, List[str]] = {
    # Search Input
    "search_input": [
        "#conversation-page-v2 > div.z2-conver-list-container > div:nth-child(1) > div.flex-container-line.px-12.pb-2.pt-1 > div > input",
        "input[placeholder*='tìm']",
        "input[placeholder*='search']",
        "input[type='search']",
        "#conversation-page-v2 input",
        "input.px-12",
        ".z2-search-input",
        "input[class*='search']",
    ],

    # Conversation List
    "conversation_list": [
        ".z2-conversation-list",
        ".z2-conver-list-container .z2-conversation-list",
        ".z2-conv-item-container",
        "[class*='conv-item-container']",
    ],

    # Conversation Item
    "conversation_item": [
        ".pointer.hover-highlight.border-bottom",
        ".z2-conv-item-container .pointer",
        ":scope > div > div.pointer",
    ],

    # Conversation Name
    "conversation_name": [
        ".name-conversation",
        "[class*='name-conversation']",
    ],

    # Staff Name (from avatar tooltip)
    "staff_avatar": [
        ".z2-avatar img[src*='avatar']",
        "[class*='avatar'] img",
    ],

    # Message Container (main selector from extension)
    "message_container": [
        ".z2-message-container",
        "[class*='message-container']",
        "div[class*='z2-message']",
    ],

    # Message Item (each message)
    "message_item": [
        ".z2-message-container",
        ".z2-message-item-right-container",
        ".z2-message-item-left-container",
    ],

    # Message Content
    "message_content_right": [
        ".z2-message-item-right-content span[id='regexText']",
        ".z2-message-item-right .mb-0.text-normal span",
        ".z2-message-item-right-content",
    ],
    "message_content_left": [
        ".z2-message-item-left-content span[id='regexText']",
        ".z2-message-item-left .mb-0.text-normal span",
        ".z2-message-item-left-content",
    ],
    "message_text": [
        ".text-normal.mb-0",
        ".mb-0.mt-1.mx-12.text-normal",
    ],

    # Timestamp
    "timestamp_marker": [
        "div.w-100.text-center span",
        "[class*='text-center'] span",
    ],
    "timestamp_footer": [
        ".z2-message-item-right-footer",
        ".z2-message-item-left-footer",
    ],

    # Quoted Content (Reply)
    "quoted_content": [
        ".z2-message-reply-quoted-content",
        ".border-answer",
    ],
    "quoted_sender": [
        ".z2-message-reply-quoted-sender",
        ".border-answer .fw-semibold",
    ],

    # Media
    "image_multi": [
        ".group-img-container img",
    ],
    "image_single": [
        ".photo-container img",
        ".el-image img",
    ],
    "video": [
        "video",
        "video source",
    ],
    "audio": [
        "[class*='sound-bar-1']",
        "[class*='sound-bar-2']",
        "[class*='sound-bar-3']",
        "[class*='sound-bar']",
    ],

    # Call
    "call_incoming": [
        "img[src*='call-incoming']",
    ],
    "call_outgoing": [
        "img[src*='call-outgoing']",
    ],

    # Scroll Container
    "scroll_container": [
        ".z2-conversation-body",
        "[class*='conversation-body']",
        ".el-scrollbar__wrap",
    ],

    # Dialog (to close)
    # Dialog (to close)
    "dialog": [
        ".el-dialog",
        "[class*='dialog']",
    ],
    "dialog_close_btn": [
        "body > div.bg-white > div > div > div.el-dialog__wrapper > div > div.el-dialog__header > button",
        ".el-dialog__wrapper .el-dialog__header button",
        ".el-dialog__headerbtn",
        "[class*='dialog'] [class*='close']",
        "button[class*='close']",
    ],
}

# ============ API CONFIG ============
API_CONFIG = {
    "base_url": "https://omnichannel.hoangkimeco.com/api/v1",
    "endpoints": {
        "uncrawled_orders": "/salework/erp/orders/uncrawled",
        "messages_preview": "/salework/messages/preview",
        "messages_save": "/salework/messages",
        "mark_crawled": "/salework/orders/crawled",
    },
    "timeout": 15000,
    "max_retries": 3,
}

# ============ BROWSER CONFIG ============
BROWSER_CONFIG = {
    "headless": False,
    "viewport": {"width": 1920, "height": 1080},
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "profile_dir": "profiles/salework",
    "slow_mo": 50,  # Slow down for debugging
}

# ============ SALEWORK URL ============
SALEWORK_URL = "https://zalo.salework.net/"
