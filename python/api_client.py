# API Client - Gọi OmniService API
import asyncio
import json
from typing import Optional, Dict, Any, List

import aiohttp

from .config import API_CONFIG
from .utils import log


class APIClient:
    """Client để gọi OmniService API"""

    def __init__(self, base_url: str = None, api_key: str = None):
        self.base_url = base_url or API_CONFIG["base_url"]
        self.api_key = api_key
        self.timeout = aiohttp.ClientTimeout(total=API_CONFIG["timeout"] / 1000)
        self.max_retries = API_CONFIG["max_retries"]

    def _get_headers(self) -> Dict[str, str]:
        """Get headers cho request"""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None,
        retry: int = 0
    ) -> Optional[Dict[str, Any]]:
        """Thực hiện request với retry"""
        url = f"{self.base_url}{endpoint}"

        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.request(
                    method,
                    url,
                    json=data,
                    params=params,
                    headers=self._get_headers()
                ) as response:
                    if response.status >= 400:
                        error_text = await response.text()
                        log("error", f"API error {response.status}: {error_text}")

                        # Retry logic
                        if retry < self.max_retries:
                            delay = 1000 * (2 ** retry)
                            log("warn", f"Retry {retry + 1}/{self.max_retries} sau {delay}ms")
                            await asyncio.sleep(delay / 1000)
                            return await self._request(method, endpoint, data, params, retry + 1)

                        return None

                    return await response.json()

        except asyncio.TimeoutError:
            log("error", f"Request timeout: {url}")
            if retry < self.max_retries:
                delay = 1000 * (2 ** retry)
                await asyncio.sleep(delay / 1000)
                return await self._request(method, endpoint, data, params, retry + 1)

        except Exception as e:
            log("error", f"Request error: {e}")
            if retry < self.max_retries:
                delay = 1000 * (2 ** retry)
                await asyncio.sleep(delay / 1000)
                return await self._request(method, endpoint, data, params, retry + 1)

        return None

    async def get(self, endpoint: str, params: Dict = None) -> Optional[Dict[str, Any]]:
        """GET request"""
        return await self._request("GET", endpoint, params=params)

    async def post(self, endpoint: str, data: Dict = None) -> Optional[Dict[str, Any]]:
        """POST request"""
        return await self._request("POST", endpoint, data=data)

    # ============ SPECIFIC API METHODS ============

    async def get_uncrawled_orders(self, limit: int = 1) -> Optional[List[Dict[str, Any]]]:
        """
        Lấy danh sách đơn chưa crawl
        GET /salework/erp/orders/uncrawled?limit=N
        """
        log("info", f"Lấy {limit} đơn chưa crawl...")
        result = await self.get(
            API_CONFIG["endpoints"]["uncrawled_orders"],
            params={"limit": limit}
        )

        if result:
            if isinstance(result, list):
                return result
            elif isinstance(result, dict):
                return result.get("value", []) or result.get("data", [])
        return []

    async def preview_messages(
        self,
        phone_number: str,
        conversations: List[Dict[str, Any]],
        replace_existing: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Preview tin nhắn trước khi lưu
        POST /salework/messages/preview
        """
        log("info", f"Preview tin nhắn cho {phone_number}...")

        payload = {
            "phoneNumber": phone_number,
            "conversations": conversations,
            "replaceExisting": replace_existing
        }

        result = await self.post(
            API_CONFIG["endpoints"]["messages_preview"],
            data=payload
        )

        if result:
            log("success", "Preview thành công")
        else:
            log("error", "Preview thất bại")

        return result

    async def save_messages(
        self,
        phone_number: str,
        conversations: List[Dict[str, Any]],
        replace_existing: bool = True
    ) -> bool:
        """
        Lưu tin nhắn vào database
        POST /salework/messages
        """
        total_msg = sum(
            len(c.get("messages", []))
            for c in conversations
        )
        log("info", f"Lưu {len(conversations)} conversations, {total_msg} tin nhắn cho {phone_number}...")

        payload = {
            "phoneNumber": phone_number,
            "conversations": conversations,
            "replaceExisting": replace_existing
        }

        result = await self.post(
            API_CONFIG["endpoints"]["messages_save"],
            data=payload
        )

        if result:
            log("success", f"Đã lưu {total_msg} tin nhắn")
            return True
        else:
            log("error", "Lưu tin nhắn thất bại")
            return False

    async def mark_order_as_crawled(
        self,
        order_id: str,
        message_count: int
    ) -> bool:
        """
        Đánh dấu đơn đã crawl
        POST /salework/orders/crawled
        """
        log("info", f"Đánh dấu đơn {order_id} đã crawl ({message_count} tin nhắn)...")

        payload = {
            "orderId": order_id,
            "messageCount": message_count
        }

        result = await self.post(
            API_CONFIG["endpoints"]["mark_crawled"],
            data=payload
        )

        if result:
            log("success", "Đã đánh dấu đã crawl")
            return True
        else:
            log("error", "Đánh dấu thất bại")
            return False


# ============ STANDALONE FUNCTIONS ============

async def save_to_api(
    phone_number: str,
    conversations: List[Dict[str, Any]],
    api_key: str = None
) -> bool:
    """Save messages to API (standalone)"""
    client = APIClient(api_key=api_key)
    return await client.save_messages(phone_number, conversations)


async def get_orders_from_api(limit: int = 1) -> List[Dict[str, Any]]:
    """Get uncrawled orders (standalone)"""
    client = APIClient()
    return await client.get_uncrawled_orders(limit)
