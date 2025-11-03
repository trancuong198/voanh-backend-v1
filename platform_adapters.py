"""
CipherH Platform Adapters

Provides adapter classes for multi-platform integration (Facebook, TikTok, Zalo, Telegram, Email).
Handles sending messages, formatting, and webhook processing.
"""

import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

class PlatformAdapter(ABC):
    """Base class for platform adapters"""
    def __init__(self, platform_name):
        self.platform_name = platform_name
        self.active = False
        self.last_sync = None

    @abstractmethod
    def send_message(self, recipient_id, message):
        pass

    @abstractmethod
    def format_message(self, message, context=None):
        pass

    @abstractmethod
    def handle_webhook(self, data):
        pass

    def get_status(self):
        return {
            'platform': self.platform_name,
            'active': self.active,
            'last_sync': self.last_sync
        }

class FacebookAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('facebook')
        self.access_token = os.getenv('FACEBOOK_ACCESS_TOKEN')
        self.page_id = os.getenv('FACEBOOK_PAGE_ID')

    def send_message(self, recipient_id, message):
        logging.info(f'CipherH: Sending Facebook message to {recipient_id}')
        return {'status': 'prepared', 'platform': 'facebook'}

    def format_message(self, message, context=None):
        formatted = message
        if len(message) > 2000:
            formatted = message[:1997] + '...'
        return formatted

    def handle_webhook(self, data):
        logging.info('CipherH: Received Facebook webhook')
        return {'platform': 'facebook', 'processed': True, 'data': data}

class TikTokAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('tiktok')
        self.access_token = os.getenv('TIKTOK_ACCESS_TOKEN')

    def send_message(self, recipient_id, message):
        logging.info(f'CipherH: Sending TikTok message to {recipient_id}')
        return {'status': 'prepared', 'platform': 'tiktok'}

    def format_message(self, message, context=None):
        if len(message) > 500:
            message = message[:497] + '...'
        return message

    def handle_webhook(self, data):
        logging.info('CipherH: Received TikTok webhook')
        return {'platform': 'tiktok', 'processed': True, 'data': data}

class ZaloAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('zalo')
        self.app_id = os.getenv('ZALO_APP_ID')
        self.app_secret = os.getenv('ZALO_APP_SECRET')

    def send_message(self, recipient_id, message):
        logging.info(f'CipherH: Sending Zalo message to {recipient_id}')
        return {'status': 'prepared', 'platform': 'zalo'}

    def format_message(self, message, context=None):
        formatted = message
        if len(message) > 1000:
            formatted = message[:997] + '...'
        return formatted

    def handle_webhook(self, data):
        logging.info('CipherH: Received Zalo webhook')
        return {'platform': 'zalo', 'processed': True, 'data': data}

class TelegramAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('telegram')
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')

    def send_message(self, recipient_id, message):
        logging.info(f'CipherH: Sending Telegram message to {recipient_id}')
        return {'status': 'prepared', 'platform': 'telegram'}

    def format_message(self, message, context=None):
        formatted = message
        if len(message) > 4096:
            formatted = message[:4093] + '...'
        return formatted

    def handle_webhook(self, data):
        logging.info('CipherH: Received Telegram webhook')
        return {'platform': 'telegram', 'processed': True, 'data': data}

class EmailAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('email')
        self.smtp_config = None

    def send_message(self, recipient_id, message):
        logging.info(f'CipherH: Sending email to {recipient_id}')
        return {'status': 'prepared', 'platform': 'email'}

    def format_message(self, message, context=None):
        formatted = f"""Xin chào,\n\n{message}\n\nBest regards,\nTrần Văn Khải (CipherH)\n\n---\nTin nhắn này được gửi tự động từ hệ thống CipherH AGI."""
        return formatted

    def handle_webhook(self, data):
        logging.info('CipherH: Received email webhook')
        return {'platform': 'email', 'processed': True, 'data': data}

class PlatformManager:
    def __init__(self):
        self.adapters = {
            'facebook': FacebookAdapter(),
            'tiktok': TikTokAdapter(),
            'zalo': ZaloAdapter(),
            'telegram': TelegramAdapter(),
            'email': EmailAdapter()
        }
        logging.info('CipherH: Platform manager initialized with all adapters')

    def get_adapter(self, platform_name):
        return self.adapters.get(platform_name)

    def send_message(self, platform, recipient_id, message, context=None):
        adapter = self.get_adapter(platform)
        if not adapter:
            logging.error(f'CipherH: No adapter found for platform {platform}')
            return None
        formatted_message = adapter.format_message(message, context)
        result = adapter.send_message(recipient_id, formatted_message)
        logging.info(f'CipherH: Message sent via {platform}')
        return result

    def handle_webhook(self, platform, data):
        adapter = self.get_adapter(platform)
        if not adapter:
            logging.error(f'CipherH: No adapter found for webhook from {platform}')
            return None
        return adapter.handle_webhook(data)

    def get_all_statuses(self):
        return {platform: adapter.get_status() for platform, adapter in self.adapters.items()}

    def activate_platform(self, platform_name, config=None):
        adapter = self.get_adapter(platform_name)
        if adapter:
            adapter.active = True
            adapter.last_sync = datetime.now()
            logging.info(f'CipherH: Activated {platform_name} platform')
            return True
        return False

    def deactivate_platform(self, platform_name):
        adapter = self.get_adapter(platform_name)
        if adapter:
            adapter.active = False
            logging.info(f'CipherH: Deactivated {platform_name} platform')
            return True
        return False

# Global instance
platform_manager = PlatformManager()
