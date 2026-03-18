# Crawler - Main orchestration (Selenium version)
import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from .browser import BrowserManager
from .config import SALEWORK_URL
from .search import SearchModule
from .scroll import ScrollModule
from .extractor import ConversationExtractor
from .api_client import APIClient
from .utils import log, sanitize_phone


class SaleworkCrawler:
    """
    Main crawler orchestration
    Flow: Login → Search → Extract All Conversations → Call API
    """

    def __init__(
        self,
        api_key: str = None,
        output_dir: str = "output",
        profile_dir: str = "profiles"
    ):
        self.browser_manager: Optional[BrowserManager] = None
        self.driver = None
        self.api_client = APIClient(api_key=api_key)

        # Directories
        base_dir = Path(__file__).parent.parent
        self.output_dir = base_dir / output_dir
        self.output_dir.mkdir(exist_ok=True)

    async def initialize(self, headless: bool = False, executable_path: str = None):
        """Khởi tạo browser"""
        log("info", "Khởi tạo crawler...")
        self.browser_manager = BrowserManager(executable_path=executable_path)
        await self.browser_manager.start(headless=headless)
        self.driver = self.browser_manager.driver
        log("success", "Crawler khởi tạo!")

    async def login(self):
        """Mở browser để login"""
        if not self.browser_manager:
            await self.initialize(headless=False)

        await self.browser_manager.login()
        return True

    async def navigate_to_salework(self):
        """Navigate đến Salework"""
        log("info", f"Navigating to {SALEWORK_URL}...")
        await self.browser_manager.navigate(SALEWORK_URL)
        return True

    async def search_and_extract_single(
        self,
        phone_number: str,
        call_api: bool = True
    ) -> Dict[str, Any]:
        """
        Tìm kiếm và extract tất cả conversations cho một số điện thoại
        """
        clean_phone = sanitize_phone(phone_number)
        if not clean_phone:
            log("error", f"Số điện thoại không hợp lệ: {phone_number}")
            return {"success": False, "error": "Invalid phone"}

        log("info", f"=== XỬ LÝ SỐ: {clean_phone} ===")

        # Search
        search = SearchModule(self.driver)
        if not await search.fill_phone_number(clean_phone):
            log("error", "Không tìm thấy ô search")
            return {"success": False, "error": "Search input not found"}

        # Wait for results
        await search.wait_for_search_results()

        # Get all conversations
        conversations = []
        conversation_elements = await search.find_all_conversations()

        if not conversation_elements:
            log("warn", "Không tìm thấy conversation nào!")
            return {
                "success": True,
                "phone": clean_phone,
                "conversations": [],
                "message": "No conversations found"
            }

        log("info", f"Tìm thấy {len(conversation_elements)} conversations")

        # Extract each conversation
        scroll = ScrollModule(self.driver)
        extractor = ConversationExtractor(self.driver)

        for i, conv_el in enumerate(conversation_elements):
            log("info", f"  Conversation {i+1}/{len(conversation_elements)}...")

            try:
                # Scroll element into view first
                self.driver.execute_script("arguments[0].scrollIntoView(true);", conv_el)
                time.sleep(0.5)

                # Get conversation info
                staff_name = await search.get_staff_name_from_avatar(conv_el)
                user_name = await search.get_user_name_from_conversation(conv_el)

                # Click using JavaScript (more reliable)
                self.driver.execute_script("arguments[0].click();", conv_el)
                time.sleep(3)  # Wait for page to load

                # Extract messages
                conv_data = await extractor.extract_conversation(
                    staff_name=staff_name,
                    user_name=user_name
                )

                if conv_data and conv_data.get("messages"):
                    conversations.append(conv_data)
                    log("success", f"    Extracted {len(conv_data['messages'])} messages")
                else:
                    log("warn", "    Không có tin nhắn")

                # Go back to list - try multiple selectors
                try:
                    back_selectors = [
                        ".z2-back-button",
                        "[class*='back']",
                        ".btn-back",
                        "button[class*='back']"
                    ]
                    for selector in back_selectors:
                        try:
                            back_btn = self.driver.find_element("css selector", selector)
                            if back_btn:
                                self.driver.execute_script("arguments[0].click();", back_btn)
                                time.sleep(2)
                                break
                        except:
                            continue
                except:
                    pass

            except Exception as e:
                log("error", f"  Lỗi extract conversation {i+1}: {e}")
                continue

        # Prepare result
        result = {
            "success": True,
            "phone": clean_phone,
            "conversation_count": len(conversations),
            "total_messages": sum(len(c.get("messages", [])) for c in conversations),
            "conversations": conversations,
            "extracted_at": datetime.now().isoformat()
        }

        # Save to JSON
        await self._save_to_json(result)

        # Call API if requested
        if call_api and conversations:
            log("info", "Gọi API để lưu...")
            api_success = await self.api_client.save_messages(
                clean_phone,
                conversations
            )
            result["api_saved"] = api_success

        log("success", f"Hoàn thành: {result['conversation_count']} conversations, "
                     f"{result['total_messages']} tin nhắn")

        return result

    async def _save_to_json(self, result: Dict[str, Any]):
        """Lưu kết quả ra JSON"""
        phone = result.get("phone", "unknown")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"messages_{phone}_{timestamp}.json"
        filepath = self.output_dir / filename

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        log("info", f"Đã lưu JSON: {filepath}")

    async def run_batch(
        self,
        phone_list: List[str],
        call_api: bool = True
    ) -> List[Dict[str, Any]]:
        """Chạy batch cho nhiều số điện thoại"""
        results = []

        for phone in phone_list:
            try:
                result = await self.search_and_extract_single(phone, call_api)
                results.append(result)
            except Exception as e:
                log("error", f"Lỗi xử lý {phone}: {e}")
                results.append({
                    "phone": phone,
                    "success": False,
                    "error": str(e)
                })

            # Small delay between phones
            time.sleep(1)

        return results

    async def close(self):
        """Đóng browser"""
        if self.browser_manager:
            await self.browser_manager.close()


# ============ STANDALONE FUNCTIONS ============

async def crawl_phone(
    phone: str,
    api_key: str = None,
    headless: bool = False,
    executable_path: str = None
) -> Dict[str, Any]:
    """Crawl một số điện thoại (standalone)"""
    crawler = SaleworkCrawler(api_key=api_key)

    try:
        await crawler.initialize(headless=headless, executable_path=executable_path)
        await crawler.navigate_to_salework()

        # Note: User should login first using crawler.login()
        # Or check if already logged in via profile

        result = await crawler.search_and_extract_single(phone, call_api=True)
        return result

    finally:
        await crawler.close()
