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

        # Try to fill using fill_input utility
        success = await fill_input(
            self.driver,
            SELECTORS["search_input"],
            clean_phone
        )

        if success:
            time.sleep(0.5)
            # Press Enter to search
            await press_key(self.driver, "Enter")
            log("success", "Đã điền số điện thoại và Enter")
            return True

        # Fallback: try direct fill
        try:
            for selector in SELECTORS["search_input"]:
                try:
                    input_el = self.driver.find_element("css selector", selector)
                    if input_el:
                        input_el.clear()
                        input_el.send_keys(clean_phone)
                        time.sleep(0.3)
                        await press_key(self.driver, "Enter")
                        log("success", "Đã điền số điện thoại (fallback)")
                        return True
                except:
                    continue
        except Exception as e:
            log("error", f"Lỗi fill phone: {e}")

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
        """Tìm tất cả conversation items"""
        conversations = []

        # Try multiple selectors
        for selector in SELECTORS["conversation_item"]:
            try:
                elements = self.driver.find_elements("css selector", selector)
                if elements and len(elements) > 0:
                    conversations.extend(elements)
            except:
                pass

        # Also try container-level selectors
        if not conversations:
            for container_selector in SELECTORS["conversation_list"]:
                try:
                    container = self.driver.find_element("css selector", container_selector)
                    if container:
                        items = container.find_elements("css selector", ".pointer, [class*='item']")
                        if items:
                            conversations.extend(items)
                except:
                    pass

        # Remove duplicates
        seen = set()
        unique_conversations = []
        for conv in conversations:
            try:
                conv_id = id(conv)
                if conv_id not in seen:
                    seen.add(conv_id)
                    unique_conversations.append(conv)
            except:
                pass

        log("info", f"Tìm thấy {len(unique_conversations)} conversations")
        return unique_conversations

    async def get_staff_name_from_avatar(self, conversation_el: Any) -> Optional[str]:
        """Lấy tên nhân viên từ avatar tooltip"""
        try:
            # Hover to show tooltip
            avatar = conversation_el.find_element(
                "css selector",
                "img[src*='avatar'], [class*='avatar'] img"
            )
            if avatar:
                from selenium.webdriver.common.action_chains import ActionChains
                ActionChains(self.driver).move_to_element(avatar).perform()
                time.sleep(0.5)

                # Get tooltip text
                tooltip = self.driver.find_element(
                    "css selector",
                    ".el-tooltip__popper, [class*='tooltip']"
                )
                if tooltip:
                    text = tooltip.text
                    if text:
                        return text.strip()

                # Alternative: check element title or aria-label
                title = avatar.get_attribute("title")
                if title:
                    return title.strip()

        except Exception as e:
            log("debug", f"Lỗi lấy staff name: {e}")

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
            log("debug", f"Lỗi lấy user name: {e}")

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
