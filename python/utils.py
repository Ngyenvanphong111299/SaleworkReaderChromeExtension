# Utility functions - Selenium/Undetected ChromeDriver helpers
import time
import random
from typing import List, Optional, Callable, Any

try:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("❌ Chưa cài đặt selenium!")
    print("   pip install selenium undetected-chromedriver")
    exit(1)


# ============ DYNAMIC WAIT ============

async def wait_for_condition(
    driver,
    condition_fn: Callable[[], bool],
    timeout: int = 30000,
    initial_interval: int = 300,
    max_interval: int = 2000,
    multiplier: float = 1.5
) -> bool:
    """Chờ đợi điều kiện với polling"""
    start_time = time.time() * 1000
    current_interval = initial_interval

    while (time.time() * 1000) - start_time < timeout:
        if condition_fn():
            return True

        time.sleep(current_interval / 1000)
        current_interval = min(current_interval * multiplier, max_interval)

    return condition_fn()


async def wait_for_element(
    driver,
    selectors: List[str],
    timeout: int = 15000
) -> Optional[Any]:
    """Chờ đợi element xuất hiện"""
    selector_array = selectors if isinstance(selectors, list) else [selectors]

    for selector in selector_array:
        try:
            element = WebDriverWait(driver, timeout / 1000).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            return element
        except:
            continue

    return None


async def wait_for_element_clickable(
    driver,
    selectors: List[str],
    timeout: int = 15000
) -> Optional[Any]:
    """Chờ đợi element có thể click"""
    selector_array = selectors if isinstance(selectors, list) else [selectors]

    for selector in selector_array:
        try:
            element = WebDriverWait(driver, timeout / 1000).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )
            return element
        except:
            continue

    return None


async def wait_for_elements(
    driver,
    selector: str,
    timeout: int = 15000
) -> List[Any]:
    """Chờ đợi và lấy nhiều elements"""
    try:
        WebDriverWait(driver, timeout / 1000).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
        )
    except:
        pass

    try:
        return driver.find_elements(By.CSS_SELECTOR, selector)
    except:
        return []


async def wait_for_element_count(
    driver,
    selector: str,
    min_count: int = 1,
    timeout: int = 15000
) -> int:
    """Chờ đợi số lượng elements"""
    start_time = time.time() * 1000
    interval = 300

    while (time.time() * 1000) - start_time < timeout:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            count = len(elements)
            if count >= min_count:
                return count
        except:
            pass

        time.sleep(interval / 1000)
        interval = min(interval * 1.3, 1500)

    try:
        elements = driver.find_elements(By.CSS_SELECTOR, selector)
        return len(elements)
    except:
        return 0


# ============ DOM OPERATIONS ============

async def click_element(driver, selectors: List[str]) -> bool:
    """Click vào element đầu tiên tìm thấy"""
    element = await wait_for_element_clickable(driver, selectors, 10000)
    if element:
        try:
            element.click()
            return True
        except Exception as e:
            log("warn", f"Click error: {e}")
    return False


async def fill_input(driver, selectors: List[str], value: str) -> bool:
    """Điền giá trị vào input"""
    element = await wait_for_element(driver, selectors, 10000)
    if element:
        try:
            element.clear()
            element.send_keys(value)
            return True
        except Exception as e:
            log("warn", f"Fill error: {e}")
    return False


async def press_key(driver, key: str) -> bool:
    """Nhấn phím"""
    try:
        from selenium.webdriver.common.keys import Keys
        # Send key to active element
        active = driver.switch_to.active_element
        if key == "Enter":
            active.send_keys(Keys.RETURN)
        else:
            active.send_keys(key)
        return True
    except Exception as e:
        log("warn", f"Press key error: {e}")
        return False


# ============ SCROLL OPERATIONS ============

async def scroll_to_element(driver, selector: str, direction: str = "up"):
    """Scroll đến element hoặc theo direction"""
    if direction == "up":
        driver.execute_script(f"""
            const el = document.querySelector('{selector}');
            if (el) {{
                el.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
            }} else {{
                const container = document.querySelector('.z2-conversation-body, .el-scrollbar__wrap');
                if (container) container.scrollTop = -99999;
            }}
        """)
    elif direction == "down":
        driver.execute_script(f"""
            const el = document.querySelector('{selector}');
            if (el) {{
                el.scrollIntoView({{ behavior: 'smooth', block: 'end' }});
            }} else {{
                const container = document.querySelector('.z2-conversation-body, .el-scrollbar__wrap');
                if (container) container.scrollTop = 0;
            }}
        """)


async def get_scroll_position(driver) -> dict:
    """Lấy vị trí scroll hiện tại"""
    return driver.execute_script("""
        const container = document.querySelector('.z2-conversation-body, .el-scrollbar__wrap');
        if (container) {
            return {
                scrollTop: container.scrollTop,
                scrollHeight: container.scrollHeight,
                clientHeight: container.clientHeight
            };
        }
        return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
    """)


async def set_scroll_position(driver, position: int):
    """Set scroll position"""
    driver.execute_script(f"""
        const container = document.querySelector('.z2-conversation-body, .el-scrollbar__wrap');
        if (container) container.scrollTop = {position};
    """)


# ============ EXTRACT TEXT/ATTRIBUTES ============

async def get_text(driver, selectors: List[str]) -> Optional[str]:
    """Lấy text từ element"""
    element = await wait_for_element(driver, selectors, 5000)
    if element:
        try:
            return element.text
        except:
            pass
    return None


async def get_attribute(driver, selectors: List[str], attr: str) -> Optional[str]:
    """Lấy attribute từ element"""
    element = await wait_for_element(driver, selectors, 5000)
    if element:
        try:
            return element.get_attribute(attr)
        except:
            pass
    return None


async def get_all_text(driver, selector: str) -> List[str]:
    """Lấy tất cả text từ elements"""
    try:
        elements = driver.find_elements(By.CSS_SELECTOR, selector)
        texts = []
        for el in elements:
            try:
                text = el.text
                if text:
                    texts.append(text.strip())
            except:
                pass
        return texts
    except:
        return []


# ============ IMAGE/MEDIA URLS ============

async def get_image_urls(driver, container_selector: str) -> List[str]:
    """Lấy URLs từ container chứa images"""
    return driver.execute_script(f"""
        const els = document.querySelectorAll('{container_selector} img');
        const urls = [];
        els.forEach(img => {{
            if (img.src && !img.src.includes('data:') && !img.src.includes('icon') && !img.src.includes('logo')) {{
                urls.push(img.src);
            }}
        }});
        return urls;
    """)


# ============ VALIDATION ============

def is_valid_phone(phone: str) -> bool:
    """Validate số điện thoại Việt Nam"""
    if not phone:
        return False
    digits = ''.join(c for c in phone if c.isdigit())
    patterns = [
        r'^0[3-9]\d{8}$',   # 10 digits: 0 + (3-9) + 8 digits
        r'^84[3-9]\d{8}$',  # International: 84 + (3-9) + 8 digits
        r'^\+84[3-9]\d{8}$' # With +84
    ]
    import re
    return any(re.match(p, digits) for p in patterns)


def sanitize_phone(phone: str) -> Optional[str]:
    """Sanitize số điện thoại về format Việt Nam"""
    if not phone:
        return None
    digits = ''.join(c for c in phone if c.isdigit())
    if digits.startswith('84'):
        digits = '0' + digits[2:]
    if is_valid_phone(digits):
        return digits
    return None


# ============ DELAY UTILS ============

async def delay_with_jitter(base_ms: int, jitter_pct: float = 0.2):
    """Delay với jitter"""
    jitter = base_ms * jitter_pct * random.random()
    time.sleep((base_ms + jitter) / 1000)


# ============ LOGGING ============

def log(level: str, message: str):
    """Simple logging"""
    import datetime
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    symbols = {
        "info": "ℹ️",
        "success": "✅",
        "warn": "⚠️",
        "error": "❌",
        "debug": "🔍"
    }
    symbol = symbols.get(level, "ℹ️")
    print(f"[{timestamp}] {symbol} {message}")
