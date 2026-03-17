# Parser Module - Parse tin nhắn từ DOM elements (Selenium version)
import re
from typing import Optional, List, Dict, Any

from .config import SELECTORS
from .utils import log


def is_ui_icon(src: str) -> bool:
    """Kiểm tra URL có phải icon UI không"""
    if not src:
        return False
    ui_patterns = [
        'icon', 'logo', 'avatar', 'emoji', 'sticker',
        'data:image', 'base64', 'svg'
    ]
    return any(p in src.lower() for p in ui_patterns)


def is_sticker_url(src: str) -> bool:
    """Kiểm tra URL có phải sticker không"""
    if not src:
        return False
    return 'sticker' in src.lower() or 'emoticon' in src.lower()


def parse_date_from_timestamp(timestamp_str: str) -> Optional[str]:
    """Parse ngày từ timestamp string"""
    if not timestamp_str:
        return None

    timestamp_str = timestamp_str.strip()

    # Common formats
    formats = [
        r'\d{1,2}/\d{1,2}/\d{4}',  # dd/MM/yyyy
        r'\d{1,2}-\d{1,2}-\d{4}',  # dd-MM-yyyy
        r'\d{4}-\d{1,2}-\d{1,2}',  # yyyy-MM-dd
        r'\d{1,2}/\d{1,2}/\d{2}',  # dd/MM/yy
    ]

    for fmt in formats:
        match = re.search(fmt, timestamp_str)
        if match:
            return match.group(0)

    return timestamp_str  # Return as-is if no pattern matched


def is_time_only(time_str: str) -> bool:
    """Kiểm tra xem chỉ có giờ (HH:mm) không"""
    if not time_str:
        return False
    return re.match(r'^\d{1,2}:\d{2}$', time_str.strip()) is not None


class MessageParser:
    """Parser tin nhắn từ DOM element (Selenium)"""

    @staticmethod
    async def parse_message_element(container, index: int) -> Optional[Dict[str, Any]]:
        """
        Parse một message container (Selenium element)
        Returns: dict với các trường message hoặc None
        """
        try:
            # Determine if sent or received
            try:
                is_right = container.find_element("css selector", ".z2-message-item-right-container") is not None
            except:
                is_right = False
            msg_type = 'sent' if is_right else 'received'

            # Get text content
            content = None
            for selector in SELECTORS["message_text"]:
                try:
                    text_el = container.find_element("css selector", selector)
                    if text_el:
                        text = text_el.text
                        if text:
                            content = text.strip()
                            break
                except:
                    pass

            # Get timestamp
            time_str = None
            for selector in SELECTORS["timestamp_footer"]:
                try:
                    time_el = container.find_element("css selector", selector)
                    if time_el:
                        time_str = time_el.text
                        break
                except:
                    pass

            # Get images
            images = None
            image_urls = []

            # Multi-image
            for selector in SELECTORS["image_multi"]:
                try:
                    imgs = container.find_elements("css selector", selector)
                    if imgs:
                        for img in imgs:
                            try:
                                src = img.get_attribute("src")
                                if src and not is_ui_icon(src):
                                    image_urls.append(src)
                            except:
                                pass
                except:
                    pass

            # Single image
            if not image_urls:
                for selector in SELECTORS["image_single"]:
                    try:
                        img = container.find_element("css selector", selector)
                        if img:
                            src = img.get_attribute("src")
                            if src and not is_ui_icon(src):
                                image_urls.append(src)
                                break
                    except:
                        pass

            if image_urls:
                images = image_urls if len(image_urls) > 1 else image_urls[0]

            # Get video
            video_url = None
            poster_url = None
            try:
                video_el = container.find_element("css selector", "video")
                if video_el:
                    video_url = video_el.get_attribute("src")
                    poster_url = video_el.get_attribute("poster")
            except:
                pass

            # Get audio
            try:
                audio_el = container.find_element("css selector", ','.join(SELECTORS["audio"]))
                audio_el = audio_el  # exists
            except:
                audio_el = None

            # Get call info
            call_type = None
            try:
                incoming = container.find_element("css selector", ','.join(SELECTORS["call_incoming"]))
                incoming = incoming  # exists
                call_type = 'incoming'
            except:
                try:
                    outgoing = container.find_element("css selector", ','.join(SELECTORS["call_outgoing"]))
                    outgoing = outgoing  # exists
                    call_type = 'outgoing'
                except:
                    pass

            # Get quoted content (reply)
            quoted_content = None
            quoted_sender = None

            # Type 1: .z2-message-reply-quoted-content
            for selector in SELECTORS["quoted_content"]:
                try:
                    quoted_el = container.find_element("css selector", selector)
                    if quoted_el:
                        quoted_text = quoted_el.text
                        if quoted_text:
                            quoted_content = quoted_text.strip()
                            break
                except:
                    pass

            # Quoted sender
            for selector in SELECTORS["quoted_sender"]:
                try:
                    sender_el = container.find_element("css selector", selector)
                    if sender_el:
                        sender_text = sender_el.text
                        if sender_text:
                            quoted_sender = sender_text.strip()
                            break
                except:
                    pass

            # Determine message type
            message_type = 'text'
            if call_type:
                message_type = 'call'
            elif video_url:
                message_type = 'video'
            elif audio_el:
                message_type = 'audio'
            elif images:
                if is_sticker_url(str(images) if isinstance(images, list) else images):
                    message_type = 'sticker'
                else:
                    message_type = 'image'

            # Create message object
            message = {
                "id": f"msg_{index}",
                "content": content,
                "time": time_str,
                "type": msg_type,
                "messageType": message_type,
                "quotedContent": quoted_content,
                "quotedSender": quoted_sender,
                "images": images if isinstance(images, list) else None,
                "imageUrl": images if isinstance(images, str) else None,
                "videoUrl": video_url,
                "posterUrl": poster_url,
                "callType": call_type,
                "audioUrl": None,  # Will be enriched later
                "order": index
            }

            return message

        except Exception as e:
            log("debug", f"Lỗi parse message {index}: {e}")
            return None

    @staticmethod
    def assign_timestamps(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Gán timestamp đầy đủ cho tin nhắn
        Timestamp marker (ngày) sẽ được áp dụng cho các tin nhắn phía dưới
        """
        if not messages:
            return messages

        current_date = None

        # Process in reverse order (timestamps appear at top)
        for msg in reversed(messages):
            msg_type = msg.get("messageType", "")
            time_str = msg.get("time", "")

            # Check if this is a timestamp marker
            if msg_type == "timestamp" or (time_str and '/' in time_str and not is_time_only(time_str)):
                # This is a date marker
                parsed_date = parse_date_from_timestamp(time_str)
                if parsed_date:
                    current_date = parsed_date
            elif time_str and current_date and is_time_only(time_str):
                # Combine date + time
                msg["time"] = f"{current_date} {time_str}"
            elif not time_str:
                # No time, try to use current date
                if current_date:
                    msg["time"] = current_date

        return messages


class ConversationParser:
    """Parser conversation data"""

    @staticmethod
    async def extract_conversation_data(
        container,
        staff_name: str = None,
        user_name: str = None
    ) -> Optional[Dict[str, Any]]:
        """Extract data từ conversation element"""
        try:
            # If names not provided, extract from element
            if not user_name:
                try:
                    name_el = container.find_element(
                        "css selector",
                        ', '.join(SELECTORS["conversation_name"])
                    )
                    if name_el:
                        user_name = name_el.text.strip()
                except:
                    pass

            return {
                "staffName": staff_name,
                "userName": user_name,
                "messages": []
            }
        except Exception as e:
            log("error", f"Lỗi extract conversation: {e}")
            return None


# ============ STANDALONE FUNCTIONS ============

async def parse_message(container, index: int) -> Optional[Dict[str, Any]]:
    """Parse một message (standalone)"""
    return await MessageParser.parse_message_element(container, index)


def assign_timestamps_to_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Assign timestamps (standalone)"""
    return MessageParser.assign_timestamps(messages)
