"""
Salework Chrome Extension Headless Runner
==========================================
Chạy Chrome extension trong headless mode để extract tin nhắn từ Salework

Cài đặt:
    pip install playwright
    playwright install chromium

Chạy:
    python salework_headless.py
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    from playwright.async_api import async_playwright, Browser, Page, BrowserContext
except ImportError:
    print("❌ Chưa cài đặt playwright!")
    print("   Cài đặt: pip install playwright")
    print("   Sau đó: playwright install chromium")
    sys.exit(1)


# ============ CONFIG ============
class Config:
    # Đường dẫn đến thư mục extension
    EXTENSION_PATH = Path(__file__).parent.absolute()

    # URL Salework
    SALEWORK_URL = "https://chat.salework.net/"

    # Credentials (thay đổi theo tài khoản của bạn)
    PHONE_NUMBER = "0909999999"  # Số điện thoại cần tìm kiếm

    # Thời gian chờ (milliseconds)
    SCROLL_TIMEOUT = 120000  # 2 phút cho scroll
    EXTRACT_TIMEOUT = 30000  # 30 giây cho extract

    # Output
    OUTPUT_DIR = Path(__file__).parent / "output"
    OUTPUT_DIR.mkdir(exist_ok=True)


class SaleworkCrawler:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.extension_id: Optional[str] = None

    async def setup(self):
        """Khởi tạo browser với extension"""
        print("🔧 Đang khởi tạo browser...")

        playwright = await async_playwright().start()

        # Lấy đường dẫn extension (dạng unpacked)
        extension_path = str(Config.EXTENSION_PATH)

        self.browser = await playwright.chromium.launch(
            headless=True,  # Headless mode
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080",
            ]
        )

        # Tạo context với extension
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        # Lấy danh sách targets để tìm extension ID
        targets = self.browser.contexts[0].browser.targets()
        for target in targets:
            if target.type == "background_page":
                print(f"✅ Extension loaded: {target.url}")

        self.page = await self.context.new_page()

        print("✅ Browser khởi tạo thành công!")
        return self

    async def navigate_to_salework(self):
        """Navigate đến Salework"""
        print(f"\n🌐 Đang navigate đến {Config.SALEWORK_URL}...")

        await self.page.goto(Config.SALEWORK_URL, wait_until="networkidle", timeout=60000)

        # Đợi một chút để page load hoàn tất
        await self.page.wait_for_timeout(3000)

        print("✅ Đã load Salework!")

        # Kiểm tra xem content script đã load chưa
        try:
            await self.page.wait_for_function(
                "() => window.__crawlerBundle !== undefined",
                timeout=10000
            )
            print("✅ Content script đã sẵn sàng!")
        except Exception as e:
            print(f"⚠️ Content script chưa ready: {e}")

    async def search_and_extract(self, phone_number: str):
        """
        Tìm kiếm và extract tin nhắn từ một số điện thoại
        """
        print(f"\n🔍 Đang tìm kiếm: {phone_number}")

        # Đợi search input xuất hiện
        try:
            await self.page.wait_for_selector(
                'input[placeholder*="tìm"], input[type="search"], input.px-12',
                timeout=15000
            )
        except Exception as e:
            print(f"❌ Không tìm thấy search input: {e}")
            return None

        # Fill phone number
        await self.page.fill(
            'input[placeholder*="tìm"], input[type="search"], input.px-12',
            phone_number
        )
        print("📝 Đã fill số điện thoại")

        # Đợi kết quả search
        await self.page.wait_for_timeout(2000)

        # Click vào conversation đầu tiên (nếu có)
        try:
            # Thử nhiều selector khác nhau
            conversation_selector = (
                ".z2-item-conver.pointer.cursor-pointer, "
                ".conversation-item, "
                "[class*='conversation']:not([class*='container'])"
            )

            first_result = await self.page.query_selector(conversation_selector)
            if first_result:
                await first_result.click()
                print("✅ Đã click vào conversation")
                await self.page.wait_for_timeout(3000)
            else:
                print("⚠️ Không tìm thấy kết quả conversation")
        except Exception as e:
            print(f"⚠️ Lỗi click conversation: {e}")

        # Scroll để load tin nhắn
        await self.scroll_to_load_messages()

        # Extract messages
        messages = await self.extract_messages()
        return messages

    async def scroll_to_load_messages(self):
        """Scroll để load tất cả tin nhắn"""
        print("📜 Đang scroll để load tin nhắn...")

        # Two-step scroll: scroll xuống bottom rồi lên top
        try:
            # Scroll to bottom first
            await self.page.evaluate("""
                () => {
                    const chatContainer = document.querySelector('.z2-conver-content, .chat-content, [class*="message-list"]');
                    if (chatContainer) {
                        chatContainer.scrollTop = 0;
                    }
                }
            """)
            await self.page.wait_for_timeout(1000)

            # Scroll up to top
            await self.page.evaluate("""
                () => {
                    const chatContainer = document.querySelector('.z2-conver-content, .chat-content, [class*="message-list"]');
                    if (chatContainer) {
                        chatContainer.scrollTop = -99999;
                    }
                }
            """)
            print("✅ Đã scroll!")

        except Exception as e:
            print(f"⚠️ Lỗi scroll: {e}")

        # Đợi messages load
        await self.page.wait_for_timeout(3000)

    async def extract_messages(self):
        """Extract tin nhắn từ page"""
        print("📥 Đang extract tin nhắn...")

        try:
            # Gọi function từ content script
            messages = await self.page.evaluate("""
                () => {
                    if (window.__crawlerBundle && window.__crawlerBundle.extractMessages) {
                        return window.__crawlerBundle.extractMessages();
                    }
                    // Fallback: extract trực tiếp từ DOM
                    const containers = document.querySelectorAll('.z2-conver-item, .message-item, [class*="message-item"]');
                    const messages = [];
                    containers.forEach((container, index) => {
                        const text = container.innerText || container.textContent;
                        const time = container.querySelector('[class*="time"], .timestamp')?.innerText;
                        messages.push({
                            index,
                            text,
                            time
                        });
                    });
                    return messages;
                }
            """)

            print(f"✅ Đã extract {len(messages) if messages else 0} tin nhắn!")
            return messages

        except Exception as e:
            print(f"❌ Lỗi extract: {e}")
            return []

    async def save_results(self, messages: list, phone_number: str):
        """Lưu kết quả ra file"""
        if not messages:
            print("⚠️ Không có tin nhắn để lưu")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"messages_{phone_number}_{timestamp}.json"
        filepath = Config.OUTPUT_DIR / filename

        data = {
            "phone": phone_number,
            "timestamp": timestamp,
            "count": len(messages),
            "messages": messages
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"💾 Đã lưu vào: {filepath}")
        return filepath

    async def run(self, phone_number: Optional[str] = None):
        """Chạy crawler"""
        phone = phone_number or Config.PHONE_NUMBER

        try:
            await self.setup()
            await self.navigate_to_salework()

            # Login nếu cần (bạn có thể thêm logic login ở đây)
            print("\n⚠️ LƯU Ý: Hãy đảm bảo đã login vào Salework!")
            print("   Nếu chưa login, hãy login thủ công trong browser...")

            # Đợi user login (có thể bỏ qua nếu đã auto login)
            input("\n👉 Nhấn Enter sau khi đã login (hoặc đã setup session)...")

            messages = await self.search_and_extract(phone)

            if messages:
                await self.save_results(messages, phone)
                print(f"\n🎉 Hoàn thành! Đã extract {len(messages)} tin nhắn")
            else:
                print("\n❌ Không extract được tin nhắn nào")

        except Exception as e:
            print(f"\n❌ Lỗi: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await self.cleanup()

    async def cleanup(self):
        """Dọn dẹp"""
        if self.browser:
            await self.browser.close()
        print("👋 Đã đóng browser")


# ============ ALTERNATIVE: Simple DOM Extraction ============
class SimpleSaleworkExtractor:
    """
    Class đơn giản hơn - extract trực tiếp từ DOM
    Không cần extension nhưng vẫn hoạt động
    """

    def __init__(self):
        self.browser = None

    async def setup(self):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        return self

    async def extract_from_page(self, url: str, phone: str):
        """Extract messages từ một page cụ thể (đã có sẵn conversation)"""
        page = await self.browser.new_page()
        await page.goto(url, wait_until="networkidle")

        # Scroll
        await page.evaluate("""
            () => {
                const container = document.querySelector('.z2-conver-content');
                if (container) container.scrollTop = -99999;
            }
        """)
        await page.wait_for_timeout(2000)

        # Extract
        messages = await page.evaluate(f"""
            () => {{
                const containers = document.querySelectorAll('.z2-conver-item');
                const results = [];
                containers.forEach((el, i) => {{
                    // Lấy sender (kiểm tra class)
                    const isStaff = el.classList.contains('z2-item-conver-me') ||
                                   el.classList.contains('outgoing') ||
                                   el.querySelector('[class*="me"]');

                    // Lấy nội dung
                    const textEl = el.querySelector('.z2-content-message, [class*="content"]');
                    const text = textEl ? textEl.innerText : el.innerText;

                    // Lấy thời gian
                    const timeEl = el.querySelector('[class*="time"], .timestamp');
                    const time = timeEl ? timeEl.innerText : '';

                    // Lấy quoted content (reply)
                    const quotedEl = el.querySelector('.z2-message-reply-quoted-content, [class*="reply"]');
                    const quoted = quotedEl ? quotedEl.innerText : '';

                    results.push({{
                        index: i,
                        isStaff,
                        text: text?.trim(),
                        time,
                        quotedContent: quoted
                    }});
                }})
                return results;
            }}
        """)

        await page.close()
        return messages


# ============ MAIN ============
async def main():
    print("=" * 50)
    print("  Salework Chrome Extension Headless Runner")
    print("=" * 50)

    # Cách 1: Chạy với extension
    # crawler = SaleworkCrawler()
    # await crawler.run("0909999999")

    # Cách 2: Extract đơn giản (không cần extension)
    print("\n[1] Chạy với Extension (đã load)")
    print("[2] Extract đơn giản (không cần extension)")
    print("[0] Thoát")

    choice = input("\n👉 Chọn chế độ: ").strip()

    if choice == "1":
        phone = input("📱 Nhập số điện thoại cần tìm: ").strip()
        crawler = SaleworkCrawler()
        await crawler.run(phone)

    elif choice == "2":
        url = input("🌐 Nhập URL conversation (vd: https://chat.salework.net/...): ").strip()
        extractor = SimpleSaleworkExtractor()
        await extractor.setup()
        messages = await extractor.extract_from_page(url, "unknown")
        print(f"\n✅ Extract được {len(messages)} tin nhắn")
        # Lưu file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        with open(f"output/messages_{timestamp}.json", "w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)
        print(f"💾 Đã lưu vào output/messages_{timestamp}.json")
        await extractor.browser.close()


if __name__ == "__main__":
    asyncio.run(main())
