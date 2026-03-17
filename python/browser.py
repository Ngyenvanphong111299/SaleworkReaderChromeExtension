# Browser Manager - Selenium + webdriver-manager cho automation
import os
import time
from pathlib import Path
from typing import Optional

try:
    import selenium.webdriver as webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("❌ Chưa cài đặt selenium hoặc webdriver-manager!")
    print("   Cài đặt: pip install selenium webdriver-manager")
    exit(1)

from .config import BROWSER_CONFIG, SALEWORK_URL
from .utils import log


class BrowserManager:
    """Quản lý Selenium ChromeDriver với persistent profile"""

    def __init__(self, profile_dir: str = None, executable_path: str = None):
        self.driver = None

        # Profile directory
        base_dir = Path(__file__).parent.parent
        self.profile_dir = profile_dir or BROWSER_CONFIG["profile_dir"]
        self.profile_path = base_dir / self.profile_dir
        self.profile_path.mkdir(parents=True, exist_ok=True)

        # Chrome executable path
        self.executable_path = executable_path

    def _get_chrome_options(self, headless: bool = False) -> Options:
        """Tạo Chrome options"""
        options = Options()

        # Basic options
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-popup-blocking")
        options.add_argument("--disable-blink-features=AutomationControlled")

        # Viewport
        options.add_argument(f"--window-size={BROWSER_CONFIG['viewport']['width']},{BROWSER_CONFIG['viewport']['height']}")

        # User agent
        options.add_argument(f"--user-agent={BROWSER_CONFIG['user_agent']}")

        # Profile path
        options.add_argument(f"--user-data-dir={self.profile_path}")

        if headless:
            options.add_argument("--headless=new")

        # Anti-detection
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)

        return options

    async def start(self, headless: bool = False, slow_mo: int = None):
        """Khởi động browser"""
        print(f"🔧 Đang khởi tạo browser (headless={headless})...")
        print(f"📂 Profile path: {self.profile_path}")

        try:
            # Get ChromeDriver
            print("📥 Đang tải ChromeDriver...")
            driver_path = ChromeDriverManager().install()
            print(f"✅ ChromeDriver: {driver_path}")

            # Create service
            service = Service(executable_path=driver_path)

            # Create driver
            options = self._get_chrome_options(headless=headless)

            if self.executable_path:
                print(f"📂 Using custom Chrome: {self.executable_path}")
                options.binary_location = self.executable_path

            self.driver = webdriver.Chrome(service=service, options=options)

            # Anti-detection: remove webdriver flag
            self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    })
                """
            })

            print("✅ Browser khởi tạo thành công!")
            return self

        except Exception as e:
            log("error", f"Lỗi khởi tạo browser: {e}")
            raise

    def _has_profile(self) -> bool:
        """Kiểm tra profile có tồn tại không"""
        if not self.profile_path.exists():
            return False
        return any(self.profile_path.iterdir())

    async def login(self):
        """Mở browser để user login thủ công"""
        print(f"\n🌐 Mở Salework để login...")
        print(f"   URL: {SALEWORK_URL}")
        print(f"   Profile: {self.profile_path}")

        # Navigate to Salework
        self.driver.get(SALEWORK_URL)
        time.sleep(3)

        print("\n" + "=" * 50)
        print("👉 VUI LÒNG LOGIN VÀO SALEWORK!")
        print("   1. Đăng nhập tài khoản Salework")
        print("   2. Đợi page load hoàn tất")
        print("   3. Nhấn ENTER trong terminal để tiếp tục")
        print("=" * 50 + "\n")

        input("Nhấn Enter sau khi đã login...")

        # Verify login
        time.sleep(2)
        current_url = self.driver.current_url or ""
        print(f"✅ Current URL: {current_url}")

        if "login" in current_url.lower():
            print("⚠️ Có vẻ như chưa login! Vui lòng login lại.")
            return await self.login()

        print("✅ Login thành công! Profile đã được lưu.")
        return True

    async def navigate(self, url: str = None, wait_until: str = "networkidle"):
        """Navigate đến URL"""
        target = url or SALEWORK_URL
        print(f"🌐 Navigating to: {target}")
        self.driver.get(target)
        time.sleep(3)
        return self.driver

    async def close(self):
        """Đóng browser"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
        print("👋 Browser đã đóng")

    def is_logged_in(self) -> bool:
        """Kiểm tra đã login chưa"""
        return "chat.salework.net" in self.driver.current_url


# ============ HELPER FUNCTIONS ============

def find_chrome_executable() -> Optional[str]:
    """Tìm Chrome executable trong máy"""
    import subprocess

    # Try common paths
    paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    ]

    for path in paths:
        if os.path.exists(path):
            return path

    # Try where command
    try:
        result = subprocess.run(
            ["where", "chrome"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.strip().split("\n")[0]
    except:
        pass

    return None


async def create_browser(headless: bool = False, slow_mo: int = None) -> BrowserManager:
    """Factory function để tạo browser manager"""
    chrome_path = find_chrome_executable()
    manager = BrowserManager(executable_path=chrome_path)
    await manager.start(headless=headless)
    return manager


async def main():
    """Demo: Login và lưu profile"""
    chrome_path = find_chrome_executable()
    print(f"Chrome found: {chrome_path}")

    browser = BrowserManager(executable_path=chrome_path)

    try:
        await browser.start(headless=False)
        await browser.login()
        print("\n✅ Hoàn thành! Profile đã được lưu.")
        print(f"   Profile path: {browser.profile_path}")

    except Exception as e:
        print(f"❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await browser.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
