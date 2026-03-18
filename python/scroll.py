# Scroll Module - Scroll và load tin nhắn (match extension logic)
import asyncio
import time
from typing import Optional, Dict, Any, List

from .config import SELECTORS, TIMING
from .utils import (
    wait_for_element,
    wait_for_element_count,
    log,
    delay_with_jitter
)


class ScrollModule:
    """Module xử lý scroll để load tin nhắn - match extension logic"""

    def __init__(self, driver):
        self.driver = driver
        self.max_scroll_attempts = TIMING.MAX_SCROLL_ATTEMPTS
        self.max_no_change = TIMING.MAX_NO_CHANGE_SCROLL

    async def find_scroll_container(self) -> Optional[Any]:
        """Tìm scroll container của chat - match extension logic"""
        # Extension logic: first find .z2-conversation-body, then find .el-scrollbar__wrap inside
        try:
            body = self.driver.find_element("css selector", ".z2-conversation-body, [class*='conversation-body']")
            if body:
                # Try el-scrollbar__wrap inside body
                try:
                    wrap = body.find_element("css selector", ".el-scrollbar__wrap")
                    if wrap:
                        return wrap
                except:
                    pass
                # Fallback: return body if scrollable
                scroll_height = self.driver.execute_script("return arguments[0].scrollHeight", body)
                client_height = self.driver.execute_script("return arguments[0].clientHeight", body)
                if scroll_height > client_height:
                    return body
        except:
            pass

        # Fallback: try selectors directly
        for selector in SELECTORS["scroll_container"]:
            try:
                container = self.driver.find_element("css selector", selector)
                if container:
                    return container
            except:
                pass
        return None

    async def get_message_count(self) -> int:
        """Đếm số tin nhắn hiện tại trong DOM"""
        count = 0
        for selector in SELECTORS["message_container"]:
            try:
                elements = self.driver.find_elements("css selector", selector)
                if elements:
                    count = len(elements)
                    break
            except:
                pass
        return count

    async def get_loaded_message_count(self) -> int:
        """Đếm số tin nhắn đã được đánh dấu"""
        try:
            loaded = self.driver.find_elements(
                "css selector",
                ".z2-message-container[data-loaded='true']"
            )
            return len(loaded)
        except:
            return 0

    async def mark_messages_as_loaded(self):
        """Đánh dấu tất cả tin nhắn hiện tại là đã load"""
        try:
            self.driver.execute_script("""
                document.querySelectorAll('.z2-message-container').forEach(el => {
                    el.setAttribute('data-loaded', 'true');
                });
            """)
        except:
            pass

    async def cleanup_old_messages(self, keep_count: int = 100) -> int:
        """Xóa tin nhắn cũ để tránh DOM quá lớn"""
        current_count = await self.get_message_count()
        if current_count <= keep_count:
            return 0

        removed = current_count - keep_count
        log("info", f"Đang xóa {removed} tin nhắn cũ (giữ lại {keep_count})")

        self.driver.execute_script(f"""
            const containers = document.querySelectorAll('.z2-message-container');
            const toRemove = containers.length - {keep_count};
            for (let i = 0; i < toRemove; i++) {{
                containers[i].remove();
            }}
        """)
        return removed

    async def scroll_to_bottom(self) -> bool:
        """Scroll xuống bottom (Step 3 trong extension)"""
        try:
            # Use JavaScript to find container like extension does
            self.driver.execute_script("""
                const body = document.querySelector('.z2-conversation-body, [class*="conversation-body"]');
                if (!body) return;
                const container = body.querySelector('.el-scrollbar__wrap') || body;
                container.scrollTop = 0;
                container.dispatchEvent(new Event('scroll', { bubbles: true }));
            """)
            time.sleep(1.5)  # Wait for scroll
            return True
        except Exception as e:
            log("error", f"Lỗi scroll to bottom: {e}")
            return False

    async def scroll_to_top(self) -> bool:
        """Scroll lên top để load tin nhắn cũ (Step 4 trong extension)"""
        try:
            # Use JavaScript to find container like extension does
            self.driver.execute_script("""
                const body = document.querySelector('.z2-conversation-body, [class*="conversation-body"]');
                if (!body) return;
                const container = body.querySelector('.el-scrollbar__wrap') || body;
                container.scrollTop = -99999;
                container.scrollBy(0, -99999);
                container.dispatchEvent(new Event('scroll', { bubbles: true }));
            """)
            time.sleep(1)  # Wait for messages to load
            return True
        except Exception as e:
            log("error", f"Lỗi scroll to top: {e}")
            return False

    async def get_scroll_info(self) -> Dict[str, int]:
        """Lấy thông tin scroll hiện tại"""
        return self.driver.execute_script("""
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

    async def _wait_for_new_messages(self, timeout: int = 2500, check_interval: int = 500) -> bool:
        """
        Đợi tin mới load xong (như extension dùng waitForCondition)
        Returns True nếu có tin mới, False nếu timeout
        """
        start_time = time.time() * 1000
        last_count = await self.get_message_count()

        while (time.time() * 1000 - start_time) < timeout:
            await asyncio.sleep(check_interval / 1000)

            current_count = await self.get_message_count()
            loaded_count = await self.get_loaded_message_count()
            new_messages = current_count - loaded_count

            if new_messages > 0:
                return True

            # Nếu count giảm (do xóa) thì cũng có thể là có tin mới
            # Vì vậy check luôn total count
            if current_count > 0:
                return True

        return False

    async def scroll_up_to_load_messages(self, max_attempts: int = None) -> Dict[str, Any]:
        """
        Scroll up để load toàn bộ tin nhắn
        Match logic từ extension: extract → mark → scroll → repeat
        """
        max_attempts = max_attempts or self.max_scroll_attempts
        log("info", "Bắt đầu scroll để load tin nhắn...")

        # Chờ message container xuất hiện
        await wait_for_element_count(
            self.driver,
            ".z2-message-container",
            min_count=1,
            timeout=8000
        )
        time.sleep(0.5)

        # Tìm scroll container
        container = await self.find_scroll_container()
        if not container:
            log("error", "Không tìm thấy scroll container!")
            return {"success": False, "message_count": 0}

        log("info", "Bắt đầu scroll loop...")

        i = 0
        no_change_count = 0
        last_total = 0

        while i < max_attempts:
            i += 1

            # Bước 1: Get current messages count TRƯỚC KHI mark
            current_count = await self.get_message_count()
            loaded_count = await self.get_loaded_message_count()

            log("info", f"Scroll {i}: {current_count} messages, {loaded_count} loaded")

            # Bước 2: Đánh dấu tin nhắn hiện tại là đã load (SAU KHI đếm)
            await self.mark_messages_as_loaded()

            # Bước 3: Scroll xuống bottom trước (như extension)
            await self.scroll_to_bottom()

            # Bước 4: Scroll lên top để load tin nhắn mới
            await self.scroll_to_top()

            # Bước 5: ĐỢI tin mới load xong (như extension dùng waitForCondition)
            # Extension dùng: waitForCondition(() => newMessages > 0, 2500, 500, maxInterval)
            await self._wait_for_new_messages()

            # Bước 6: Kiểm tra có tin mới không
            new_total = await self.get_message_count()
            new_loaded = await self.get_loaded_message_count()
            new_messages = new_total - new_loaded

            if new_messages > 0:
                log("info", f"  → Có {new_messages} tin nhắn mới!")
                no_change_count = 0

                # Bước 7: XÓA tin nhắn đã đánh dấu CHỈ KHI có tin mới (như extension)
                try:
                    self.driver.execute_script("""
                        document.querySelectorAll('.z2-message-container[data-loaded="true"]').forEach(el => el.remove());
                    """)
                except:
                    pass
            else:
                no_change_count += 1
                log("info", f"  → Không có tin mới ({no_change_count}/{self.max_no_change})")

                # KHÔNG xóa khi không có tin mới - giữ lại để extract!
                if no_change_count >= self.max_no_change:
                    log("info", "Đã đến top, dừng scroll")
                    break

            last_total = new_total

            # Small delay
            await delay_with_jitter(500, 0.3)

        final_count = await self.get_message_count()
        final_loaded = await self.get_loaded_message_count()

        log("success", f"Hoàn thành scroll: {i} lần, "
                     f"tổng {final_count} tin nhắn ({final_loaded} loaded)")

        return {
            "success": True,
            "message_count": final_count,
            "scroll_count": i,
            "loaded_count": final_loaded,
        }

    async def wait_for_messages_load(self, min_count: int = 1, timeout: int = 10000) -> bool:
        """Đợi tin nhắn load xong"""
        log("info", f"Đợi ít nhất {min_count} tin nhắn...")
        count = await wait_for_element_count(
            self.driver,
            SELECTORS["message_container"][0],
            min_count,
            timeout
        )
        return count >= min_count


# ============ STANDALONE FUNCTIONS ============

async def scroll_to_load_messages(driver, max_attempts: int = None) -> Dict[str, Any]:
    """Scroll và load tin nhắn (standalone function)"""
    scroll = ScrollModule(driver)
    return await scroll.scroll_up_to_load_messages(max_attempts)


async def get_message_count(driver) -> int:
    """Đếm số tin nhắn (standalone function)"""
    scroll = ScrollModule(driver)
    return await scroll.get_message_count()
