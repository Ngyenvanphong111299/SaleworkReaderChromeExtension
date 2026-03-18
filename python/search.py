# Search Module - Tìm Kiếm theo số điện thoại
import asyncio
import time
from typing import List, Optional, Any

from .config import SELECTORS, TIMING
from .utils import (
    wait_for_element,
    wait_for_element_clickable,
    wait_for_elements,
    fill_input,
    press_key,
    log,
    delay_with_jitter,
    sanitize_phone,
    is_valid_phone
)


class SearchModule:
    """Module tìm kiếm conversation theo số điện thoại"""

    def __init__(self, driver):
        self.driver = driver

    async def find_search_input(self) -> Optional[Any]:
        """Tìm ô search input"""
        log("info", "Đang tìm ô search...")
        return await wait_for_element(
            self.driver,
            SELECTORS["search_input"],
            timeout=15000
        )

    async def close_dialog(self) -> bool:
        """Đóng dialog nếu đang mở (tránh chặn ô search / kết quả)"""
        try:
            # Try multiple close button selectors
            for selector in SELECTORS["dialog_close_btn"]:
                try:
                    close_btn = self.driver.find_element("css selector", selector)
                    if close_btn:
                        close_btn.click()
                        log("info", "Đã đóng dialog")
                        time.sleep(0.5)
                        return True
                except:
                    continue
        except:
            pass
        return False

    async def fill_phone_number(self, phone: str) -> bool:
        """
        Điền số điện thoại vào ô search
        Returns: True nếu thành công
        """
        # Sanitize phone
        clean_phone = sanitize_phone(phone)
        if not clean_phone:
            log("error", f"Số điện thoại không hợp lệ: {phone}")
            return False

        # Close any dialog first
        await self.close_dialog()

        # Find input
        log("info", f"Đang điền số điện thoại: {clean_phone}")

        # Try each selector
        for selector in SELECTORS["search_input"]:
            try:
                input_el = self.driver.find_element("css selector", selector)
                if input_el:
                    input_el.clear()
                    input_el.send_keys(clean_phone)
                    time.sleep(0.3)
                    await press_key(self.driver, "Enter")
                    log("success", "Đã điền số điện thoại và Enter")
                    return True
            except:
                continue

        log("error", "Không tìm thấy ô search input!")
        return False

    async def wait_for_search_results(self, timeout: int = 10000) -> bool:
        """Đợi kết quả search xuất hiện"""
        log("info", "Đang đợi kết quả search...")

        # Wait for conversation list to update
        time.sleep(2)

        # Check if results appear
        for selector in SELECTORS["conversation_item"]:
            try:
                elements = self.driver.find_elements("css selector", selector)
                if elements and len(elements) > 0:
                    log("success", f"Tìm thấy {len(elements)} conversation(s)")
                    return True
            except:
                pass

        return True  # Continue anyway

    async def find_all_conversations(self) -> List[Any]:
        """Tìm tất cả conversation items - match extension logic"""
        # First, find the conversation list container
        conv_list = None
        for selector in SELECTORS["conversation_list"]:
            try:
                conv_list = self.driver.find_element("css selector", selector)
                if conv_list:
                    break
            except:
                pass

        if not conv_list:
            log("info", "Không tìm thấy conversation list container")
            return []

        # Now find conversation items within that container
        conversations = []

        # Try selectors in order (like extension does)
        selectors_to_try = [
            ".z2-conv-item-container",
            "[class*='conv-item-container']",
            ".pointer.hover-highlight.border-bottom",
            ":scope > div > div.pointer",
            ":scope > div > div"
        ]

        for selector in selectors_to_try:
            try:
                elements = conv_list.find_elements("css selector", selector)
                if elements and len(elements) > 0:
                    conversations = elements
                    break
            except:
                pass

        # Fallback: find by name elements
        if not conversations:
            try:
                name_els = conv_list.find_elements("css selector", ".name-conversation")
                for name_el in name_els:
                    try:
                        # Try to find parent row
                        row = name_el.find_element("xpath", "./ancestor::div[contains(@class, 'conv-item') or contains(@class, 'pointer')]")
                        if row and row not in conversations:
                            conversations.append(row)
                    except:
                        pass
            except:
                pass

        # Filter out search input
        if conversations:
            filtered = []
            for conv in conversations:
                try:
                    # Check if this is a search input (should not be)
                    search_input = conv.find_elements("css selector", "input[type='search'], input[placeholder*='tìm'], input[placeholder*='search']")
                    if not search_input:
                        filtered.append(conv)
                except:
                    filtered.append(conv)

            if filtered:
                conversations = filtered
            else:
                # If all filtered out, use original
                pass

        log("info", f"Tìm thấy {len(conversations)} conversations")
        return conversations

    async def get_staff_name_from_avatar(self, conversation_el: Any) -> Optional[str]:
        """
        Lấy tên nhân viên từ avatar tooltip
        Extension uses: .z2-avatar-tooltip[aria-describedby] to find avatar, then get tooltip by ID
        """
        from selenium.webdriver.common.action_chains import ActionChains

        # Scroll conversation into view first (like extension: conv.scrollIntoView)
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({ block: 'center', behavior: 'instant' });", conversation_el)
            time.sleep(0.3)
        except:
            pass

        # First try JavaScript approach like extension
        try:
            staff_name = self.driver.execute_script("""
                var conv = arguments[0];

                // First scroll conv into view
                conv.scrollIntoView({ block: 'center', behavior: 'instant' });

                // Try multiple selectors like extension
                var avatarEl = null;
                var selectors = [
                    '.z2-avatar-tooltip[aria-describedby]',
                    '.z2-avatar[aria-describedby]',
                    '.z2-avatar img[src*="avatar"]',
                    '.z2-avatar'
                ];

                for (var i = 0; i < selectors.length; i++) {
                    avatarEl = conv.querySelector(selectors[i]);
                    if (avatarEl) break;
                }

                if (!avatarEl) return null;

                var tooltipId = avatarEl.getAttribute('aria-describedby');

                // If no aria-describedby, try to find tooltip by title or other attributes
                if (!tooltipId) {
                    var title = avatarEl.getAttribute('title');
                    if (title) return title;
                }

                if (!tooltipId) return null;

                // Trigger hover - use both mouseenter and mouseover
                avatarEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
                avatarEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));

                // Also try dispatching on the element itself
                if (avatarEl.tagName === 'IMG') {
                    var parent = avatarEl.parentElement;
                    if (parent) {
                        parent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    }
                }

                // Wait for tooltip to render - check multiple times
                var start = Date.now();
                var tooltipEl = null;
                while (Date.now() - start < 600) {
                    tooltipEl = document.getElementById(tooltipId);
                    if (tooltipEl && (tooltipEl.textContent || tooltipEl.innerText)) break;
                    // Also check for any visible tooltip
                    var allTooltips = document.querySelectorAll('[role="tooltip"], .el-tooltip__popper');
                    for (var j = 0; j < allTooltips.length; j++) {
                        var t = allTooltips[j];
                        if (t.offsetParent !== null && (t.textContent || t.innerText)) {
                            var txt = (t.textContent || t.innerText).trim();
                            if (txt && txt.length > 2) {
                                return txt.replace(/\\s+/g, ' ');
                            }
                        }
                    }
                }

                if (tooltipEl) {
                    var text = tooltipEl.textContent || tooltipEl.innerText;
                    if (text && text.trim()) {
                        text = text.trim().replace(/\\s+/g, ' ');
                        return text;
                    }
                }

                return null;
            """, conversation_el)

            if staff_name and isinstance(staff_name, str) and staff_name not in ['NO_AVATAR_FOUND', 'NO_TOOLTIP_ID', 'TOOLTIP_NOT_FOUND', '']:
                return staff_name
        except Exception as e:
            pass

        # Fallback: Selenium approach
        try:
            # Method 1: Use .z2-avatar-tooltip[aria-describedby] like extension
            try:
                avatar = conversation_el.find_element(
                    "css selector",
                    ".z2-avatar-tooltip[aria-describedby]"
                )
                if avatar:
                    tooltip_id = avatar.get_attribute("aria-describedby")
                    if tooltip_id:
                        # Hover to show tooltip
                        ActionChains(self.driver).move_to_element(avatar).perform()
                        time.sleep(0.5)

                        # Get tooltip by ID (like extension)
                        try:
                            tooltip = self.driver.find_element("css selector", f"#{tooltip_id}")
                            if tooltip:
                                text = tooltip.text
                                if text:
                                    return text.strip().replace('\n', ' ')
                        except:
                            pass

                        # Try alternative tooltip selectors
                        try:
                            tooltip = self.driver.find_element(
                                "css selector",
                                f".el-tooltip__popper#{tooltip_id}, [id='{tooltip_id}']"
                            )
                            if tooltip:
                                text = tooltip.text
                                if text:
                                    return text.strip().replace('\n', ' ')
                        except:
                            pass
            except:
                pass

            # Method 2: Fallback - find avatar img and hover
            try:
                avatar = conversation_el.find_element(
                    "css selector",
                    ".z2-avatar img, [class*='avatar'] img"
                )
                if avatar:
                    ActionChains(self.driver).move_to_element(avatar).perform()
                    time.sleep(0.4)

                    # Try to find tooltip
                    tooltips = self.driver.find_elements(
                        "css selector",
                        ".el-tooltip__popper, [class*='tooltip__popper'], [role='tooltip']"
                    )
                    for tooltip in tooltips:
                        text = tooltip.text
                        if text and len(text.strip()) > 2:
                            return text.strip().replace('\n', ' ')
            except:
                pass

        except Exception as e:
            pass

        return None

    async def get_user_name_from_conversation(self, conversation_el: Any) -> Optional[str]:
        """Lấy tên khách hàng từ conversation item"""
        try:
            # Try name selectors
            for selector in SELECTORS["conversation_name"]:
                try:
                    name_el = conversation_el.find_element("css selector", selector)
                    if name_el:
                        text = name_el.text
                        if text:
                            return text.strip()
                except:
                    pass

            # Fallback: get any text that looks like name
            text = conversation_el.text
            if text:
                # Take first line or first meaningful text
                lines = text.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and len(line) > 2:
                        return line

        except Exception as e:
            pass

        return None

    async def click_conversation(self, conversation_el: Any) -> bool:
        """Click vào conversation để mở"""
        try:
            conversation_el.click()
            log("info", "Đã click conversation")
            # Wait for messages to load
            time.sleep(TIMING.CONVERSATION_LOAD / 1000)
            return True
        except Exception as e:
            log("error", f"Lỗi click conversation: {e}")
            return False


# ============ STANDALONE FUNCTIONS ============

async def search_phone(driver, phone: str) -> bool:
    """Tìm kiếm theo số điện thoại (standalone function)"""
    search = SearchModule(driver)
    return await search.fill_phone_number(phone)


async def get_conversations(driver) -> List[Any]:
    """Lấy danh sách conversations (standalone function)"""
    search = SearchModule(driver)
    return await search.find_all_conversations()
