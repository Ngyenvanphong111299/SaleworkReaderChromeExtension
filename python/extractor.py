# Extractor Module - Trích xuất tin nhắn từ DOM
import asyncio
import time
from typing import List, Dict, Any, Optional

from .config import SELECTORS
from .parser import MessageParser, ConversationParser, assign_timestamps_to_messages
from .scroll import ScrollModule
from .utils import log


class MessageExtractor:
    """Module trích xuất tin nhắn từ page"""

    def __init__(self, driver):
        self.driver = driver
        self.parser = MessageParser()
        self.scroll = ScrollModule(driver)

    async def find_message_containers(self) -> List[Any]:
        """Tìm tất cả message containers"""
        containers = []

        # Use main selector from extension
        for selector in SELECTORS["message_container"]:
            try:
                elements = self.driver.find_elements("css selector", selector)
                if elements:
                    containers.extend(elements)
            except:
                pass

        # Deduplicate
        seen = set()
        unique = []
        for el in containers:
            el_id = id(el)
            if el_id not in seen:
                seen.add(el_id)
                unique.append(el)

        return unique

    async def extract_messages(self, assign_ts: bool = True) -> List[Dict[str, Any]]:
        """
        Extract tất cả tin nhắn từ DOM
        """
        log("info", "Đang extract tin nhắn...")

        # Get all message containers
        containers = await self.find_message_containers()

        if not containers:
            log("warn", "Không tìm thấy tin nhắn nào!")
            return []

        log("info", f"Tìm thấy {len(containers)} containers")

        # Parse each message
        messages = []
        for i, container in enumerate(containers):
            msg = await self.parser.parse_message_element(container, i)
            if msg:
                messages.append(msg)

        log("success", f"Đã parse {len(messages)} tin nhắn")

        # Assign timestamps if requested
        if assign_ts:
            messages = assign_timestamps_to_messages(messages)
            log("info", "Đã gán timestamps")

        return messages

    async def extract_and_scroll(self) -> List[Dict[str, Any]]:
        """Scroll để load tất cả tin nhắn rồi extract"""
        # First scroll
        scroll_result = await self.scroll.scroll_up_to_load_messages()

        # Extract messages
        messages = await self.extract_messages()

        return messages


class ConversationExtractor:
    """Extractor cho toàn bộ conversation"""

    def __init__(self, driver):
        self.driver = driver
        self.message_extractor = MessageExtractor(driver)
        self.scroll = ScrollModule(driver)

    async def extract_conversation(
        self,
        staff_name: str = None,
        user_name: str = None
    ) -> Optional[Dict[str, Any]]:
        """Extract một conversation hiện tại"""
        log("info", "Đang extract conversation...")

        # Scroll to load all messages (two-step approach)
        await self.scroll.scroll_to_bottom()
        time.sleep(1)
        await self.scroll.scroll_to_top()
        time.sleep(2)

        # Scroll loop để load tất cả
        await self.scroll.scroll_up_to_load_messages()

        # Extract messages
        messages = await self.message_extractor.extract_messages()

        # Get conversation info if not provided
        if not user_name:
            user_name = await self._get_user_name_from_header()

        conversation = {
            "staffName": staff_name,
            "userName": user_name,
            "messages": messages
        }

        log("success", f"Đã extract {len(messages)} tin nhắn từ conversation")
        return conversation

    async def _get_user_name_from_header(self) -> Optional[str]:
        """Lấy tên khách hàng từ chat header"""
        try:
            header_selectors = [
                ".z2-header-name",
                "[class*='header-name']",
                ".chat-header-name"
            ]
            for selector in header_selectors:
                try:
                    el = self.driver.find_element("css selector", selector)
                    if el:
                        text = el.text
                        if text:
                            return text.strip()
                except:
                    pass
        except:
            pass
        return None


# ============ STANDALONE FUNCTIONS ============

async def extract_messages(driver, assign_ts: bool = True) -> List[Dict[str, Any]]:
    """Extract messages (standalone)"""
    extractor = MessageExtractor(driver)
    return await extractor.extract_messages(assign_ts)


async def extract_conversation(
    driver,
    staff_name: str = None,
    user_name: str = None
) -> Optional[Dict[str, Any]]:
    """Extract conversation (standalone)"""
    extractor = ConversationExtractor(driver)
    return await extractor.extract_conversation(staff_name, user_name)
