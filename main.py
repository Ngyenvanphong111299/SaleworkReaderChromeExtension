#!/usr/bin/env python3
# Salework Python Crawler - CLI Entry Point
"""
Salework Python Crawler
=======================
Chạy automation extraction tin nhắn Salework thay thế Chrome extension

Cài đặt:
    pip install playwright aiohttp
    playwright install chromium

Sử dụng:
    python main.py login              # Login và lưu profile
    python main.py test               # Test với số mặc định (0909168466)
    python main.py test 0948687079   # Test với số khác
    python main.py test --preview    # Test + gọi API preview
    python main.py run 0909999999    # Extract một số điện thoại
    python main.py batch phones.txt   # Extract từ danh sách
    python main.py status             # Kiểm tra trạng thái
"""

import asyncio
import argparse
import sys
import time
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from python.browser import BrowserManager, find_chrome_executable
from python.crawler import SaleworkCrawler
from python.api_client import APIClient
from python.utils import log


async def cmd_login(args):
    """Mở browser để login và lưu profile"""
    print("\n" + "=" * 50)
    print("  SALEWORK LOGIN")
    print("=" * 50 + "\n")

    browser = BrowserManager(
        profile_dir=args.profile,
        executable_path=args.chrome
    )
    await browser.start(headless=False, slow_mo=50)
    await browser.login()

    print("\n✅ Login hoàn thành!")
    print(f"   Profile: {browser.profile_path}")
    print("\nLần sau có thể chạy trực tiếp mà không cần login lại.")

    await browser.close()


async def cmd_run(args):
    """Extract một số điện thoại"""
    phone = args.phone
    headless = args.headless
    no_api = args.no_api

    print("\n" + "=" * 50)
    print(f"  EXTRACT: {phone}")
    print(f"  Headless: {headless}")
    print(f"  Save to API: {not no_api}")
    print("=" * 50 + "\n")

    # Find Chrome executable
    chrome_path = args.chrome or find_chrome_executable()

    crawler = SaleworkCrawler(
        api_key=args.api_key,
        profile_dir=args.profile
    )

    try:
        # Initialize
        await crawler.initialize(headless=headless, executable_path=chrome_path)

        # Navigate
        await crawler.navigate_to_salework()

        # Check if need login
        if not args.no_login_check:
            # Try to check if already logged in
            try:
                time.sleep(3)  # Wait for page to load
                current_url = crawler.driver.current_url
                if "login" in current_url.lower():
                    log("warn", "Chưa login! Vui lòng chạy 'python main.py login' trước.")
                    return
            except:
                pass

        # Extract
        result = await crawler.search_and_extract_single(
            phone,
            call_api=not no_api
        )

        # Summary
        print("\n" + "=" * 50)
        print("  KẾT QUẢ")
        print("=" * 50)
        print(f"  Số điện thoại: {result.get('phone')}")
        print(f"  Conversations: {result.get('conversation_count', 0)}")
        print(f"  Tổng tin nhắn: {result.get('total_messages', 0)}")
        if 'api_saved' in result:
            print(f"  API saved: {result['api_saved']}")
        print("=" * 50 + "\n")

    except Exception as e:
        log("error", f"Lỗi: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await crawler.close()


async def cmd_batch(args):
    """Extract từ danh sách file"""
    phone_file = Path(args.file)
    if not phone_file.exists():
        log("error", f"File không tồn tại: {phone_file}")
        return

    # Read phone list
    phones = []
    with open(phone_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                phones.append(line)

    if not phones:
        log("error", "Không có số điện thoại nào trong file")
        return

    log("info", f"Đọc {len(phones)} số từ file")

    print("\n" + "=" * 50)
    print(f"  BATCH EXTRACT: {len(phones)} phones")
    print("=" * 50 + "\n")

    # Find Chrome executable
    chrome_path = args.chrome or find_chrome_executable()

    crawler = SaleworkCrawler(
        api_key=args.api_key,
        profile_dir=args.profile
    )

    try:
        await crawler.initialize(headless=args.headless, executable_path=chrome_path)
        await crawler.navigate_to_salework()

        # Run batch
        results = await crawler.run_batch(
            phones,
            call_api=not args.no_api
        )

        # Summary
        success = sum(1 for r in results if r.get("success"))
        total_convs = sum(r.get("conversation_count", 0) for r in results)
        total_msgs = sum(r.get("total_messages", 0) for r in results)

        print("\n" + "=" * 50)
        print("  BATCH SUMMARY")
        print("=" * 50)
        print(f"  Tổng số: {len(phones)}")
        print(f"  Thành công: {success}")
        print(f"  Thất bại: {len(phones) - success}")
        print(f"  Tổng conversations: {total_convs}")
        print(f"  Tổng tin nhắn: {total_msgs}")
        print("=" * 50 + "\n")

    except Exception as e:
        log("error", f"Lỗi batch: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await crawler.close()


# Default phone từ extension (popup.html manual search)
DEFAULT_TEST_PHONE = "0909168466"


async def cmd_test(args):
    """Test với số điện thoại mặc định từ extension"""
    phone = args.phone or DEFAULT_TEST_PHONE
    headless = args.headless
    preview_only = args.preview  # Chỉ preview, không lưu API

    print("\n" + "=" * 50)
    print("  TEST MODE")
    print("=" * 50 + "\n")
    print(f"📱 Phone: {phone} (default: {DEFAULT_TEST_PHONE})")
    print(f"🌐 Headless: {headless}")
    print(f"👁️  Preview only: {preview_only}")
    print("=" * 50 + "\n")

    # Find Chrome executable
    chrome_path = args.chrome or find_chrome_executable()

    crawler = SaleworkCrawler(
        api_key=args.api_key,
        profile_dir=args.profile
    )

    try:
        # Initialize (headless=False để dễ debug)
        await crawler.initialize(headless=headless, executable_path=chrome_path)

        # Navigate
        await crawler.navigate_to_salework()

        # Check login
        try:
            time.sleep(3)
            current_url = crawler.driver.current_url
            if "login" in current_url.lower():
                log("warn", "Chưa login! Vui lòng chạy 'python main.py login' trước.")
                return
        except:
            pass

        # Extract (preview = gọi API preview thay vì save)
        result = await crawler.search_and_extract_single(
            phone,
            call_api=False  # Test mode: không lưu, chỉ extract
        )

        # Nếu preview_only thì gọi API preview
        if preview_only and result.get("conversations"):
            log("info", "Gọi API preview...")
            preview_result = await crawler.api_client.preview_messages(
                phone,
                result["conversations"],
                replace_existing=True
            )
            result["preview_result"] = preview_result

        # Summary
        print("\n" + "=" * 50)
        print("  TEST RESULT")
        print("=" * 50)
        print(f"  Phone: {result.get('phone')}")
        print(f"  Conversations: {result.get('conversation_count', 0)}")
        print(f"  Tổng tin nhắn: {result.get('total_messages', 0)}")

        if result.get("conversations"):
            print("\n  📋 Conversations:")
            for i, conv in enumerate(result["conversations"][:3], 1):  # Show max 3
                msg_count = len(conv.get("messages", []))
                staff = conv.get("staffName", "N/A")
                user = conv.get("userName", "N/A")
                print(f"    [{i}] Staff: {staff}")
                print(f"        User: {user}")
                print(f"        Messages: {msg_count}")

                # Show sample message
                if conv.get("messages"):
                    first_msg = conv["messages"][0]
                    content = first_msg.get("content", "")[:50]
                    msg_type = first_msg.get("messageType", "text")
                    print(f"        First: [{msg_type}] {content}...")

        if 'preview_result' in result:
            print(f"\n  👁️  Preview: {'Thành công' if result['preview_result'] else 'Thất bại'}")

        print("=" * 50 + "\n")

        log("success", "Test hoàn thành!")

    except Exception as e:
        log("error", f"Lỗi: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await crawler.close()


async def cmd_status(args):
    """Kiểm tra trạng thái"""
    print("\n" + "=" * 50)
    print("  SALEWORK CRAWLER STATUS")
    print("=" * 50 + "\n")

    # Check profile
    browser = BrowserManager(profile_dir=args.profile)
    if browser._has_profile():
        print(f"✅ Profile tồn tại: {browser.profile_path}")
    else:
        print(f"❌ Chưa có profile!")
        print(f"   Chạy 'python main.py login' để tạo profile")

    # Check API
    print("\n📡 Kiểm tra API...")
    api = APIClient()
    try:
        orders = await api.get_uncrawled_orders(limit=1)
        print(f"✅ API kết nối được ({len(orders)} orders)")
    except Exception as e:
        print(f"❌ API lỗi: {e}")

    print("\n")


def main():
    parser = argparse.ArgumentParser(
        description="Salework Python Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python main.py login                  # Login và lưu profile
  python main.py test                    # Test với số mặc định (0909168466)
  python main.py test 0948687079        # Test với số khác
  python main.py test --preview         # Test + gọi API preview
  python main.py test --headless        # Test headless mode
  python main.py run 0909999999        # Extract một số
  python main.py run 0909999999 --headless  # Headless mode
  python main.py batch phones.txt       # Extract từ file
  python main.py status                  # Kiểm tra trạng thái
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Login command
    login_parser = subparsers.add_parser("login", help="Login và lưu profile")
    login_parser.add_argument(
        "--profile",
        default="profiles/salework",
        help="Thư mục lưu profile"
    )
    login_parser.add_argument(
        "--chrome",
        default=None,
        help="Đường dẫn Chrome executable (vd: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')"
    )

    # Run command
    run_parser = subparsers.add_parser("run", help="Extract một số điện thoại")
    run_parser.add_argument("phone", help="Số điện thoại cần extract")
    run_parser.add_argument("--headless", action="store_true", help="Chạy headless")
    run_parser.add_argument("--no-api", action="store_true", help="Không gọi API")
    run_parser.add_argument("--no-login-check", action="store_true", help="Bỏ qua kiểm tra login")
    run_parser.add_argument("--api-key", help="API key cho OmniService")
    run_parser.add_argument(
        "--profile",
        default="profiles/salework",
        help="Thư mục profile"
    )

    # Batch command
    batch_parser = subparsers.add_parser("batch", help="Extract từ danh sách file")
    batch_parser.add_argument("file", help="File chứa danh sách số điện thoại")
    batch_parser.add_argument("--headless", action="store_true", help="Chạy headless")
    batch_parser.add_argument("--no-api", action="store_true", help="Không gọi API")
    batch_parser.add_argument("--api-key", help="API key cho OmniService")
    batch_parser.add_argument("--chrome", default=None, help="Đường dẫn Chrome executable")
    batch_parser.add_argument(
        "--profile",
        default="profiles/salework",
        help="Thư mục profile"
    )

    # Test command
    test_parser = subparsers.add_parser("test", help="Test với số mặc định (0909168466)")
    test_parser.add_argument(
        "phone",
        nargs="?",  # Optional - use default if not provided
        default=None,
        help="Số điện thoại (default: 0909168466 từ extension)"
    )
    test_parser.add_argument("--headless", action="store_true", help="Chạy headless")
    test_parser.add_argument("--preview", action="store_true", help="Gọi API preview (không lưu DB)")
    test_parser.add_argument("--api-key", help="API key cho OmniService")
    test_parser.add_argument("--chrome", default=None, help="Đường dẫn Chrome executable")
    test_parser.add_argument(
        "--profile",
        default="profiles/salework",
        help="Thư mục profile"
    )

    # Status command
    status_parser = subparsers.add_parser("status", help="Kiểm tra trạng thái")
    status_parser.add_argument(
        "--profile",
        default="profiles/salework",
        help="Thư mục profile"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Run command
    if args.command == "login":
        asyncio.run(cmd_login(args))
    elif args.command == "test":
        asyncio.run(cmd_test(args))
    elif args.command == "run":
        asyncio.run(cmd_run(args))
    elif args.command == "batch":
        asyncio.run(cmd_batch(args))
    elif args.command == "status":
        asyncio.run(cmd_status(args))


if __name__ == "__main__":
    main()
