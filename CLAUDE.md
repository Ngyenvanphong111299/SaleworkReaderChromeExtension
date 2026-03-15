# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) để tự động tìm kiếm và trích xuất tin nhắn từ Salework (Zalo CRM). Extension hoạt động bằng cách:
1. Gọi API để lấy danh sách đơn chưa crawl
2. Điền số điện thoại vào ô search trên Salework
3. Click conversation và scroll để load tin nhắn
4. Trích xuất và lưu tin nhắn về API

## Architecture

- **manifest.json** - Cấu hình extension (permissions, host permissions, side panel)
- **js/00-settings.js** - Settings management, lưu config vào chrome.storage
- **js/01-config.js** - Hằng số, đọc config động từ settings
- **js/02-utils.js** - Tiện ích (logToPopup, getPhoneFromOrder)
- **js/03-api.js** - Gọi API (fetch orders, save messages, mark crawled)
- **js/04-crawl.js** - Logic crawl (processPhone, startCrawl)
- **js/05-background.js** - Entry point, message handling
- **content/01-search.js** - Tìm ô search, nút search
- **content/02-conversation.js** - Tìm và click vào conversation
- **content/03-scroll.js** - Scroll load tin nhắn cũ
- **content/04-extract.js** - Trích xuất tin nhắn từ DOM
- **content/05-main.js** - Luồng chính fillAndSearchAndClick, message listener
- **popup.js/popup.html** - Side panel UI để nhập số điện thoại và cài đặt

## Settings System

Extension sử dụng **chrome.storage** để lưu cấu hình:
- Click icon ⚙️ trong side panel để mở cài đặt
- Có thể thay đổi:
  - **API Base URL**: `https://omnichannel.hoangkimeco.com/api/v1` (mặc định)
  - **Mode**: Production / Development
  - **Log Level**: Debug / Info / Warn / Error
  - **Delay**: Thời gian chờ giữa các đơn (giây)

## Commands

### Load Extension vào Chrome
1. Mở `chrome://extensions/`
2. Bật "Developer mode"
3. Click "Load unpacked" và chọn thư mục `c:\Works\SaleworkReaderChromeExtension`

### Development
- Không có build step - extension chạy trực tiếp từ source files
- Sử dụng Chrome DevTools để debug:
  - Background script: `chrome://extensions/` → Service Worker console
  - Content script: F12 trên trang Salework → Console
  - Popup: Right-click extension → Inspect popup

### API Server Requirement
API server tại `https://omnichannel.hoangkimeco.com/api/v1` với các endpoints:
- `GET /api/v1/salework/erp/orders/uncrawled?limit=N` - Lấy đơn chưa crawl
- `POST /api/v1/salework/messages` - Lưu tin nhắn
- `POST /api/v1/salework/orders/crawled` - Đánh dấu đã crawl

## Key Behaviors

- **Auto Crawl**: Lấy N đơn từ API, tuần tự crawl từng số điện thoại với delay 15s mỗi đơn
- **Manual Search**: Nhập số điện thoại và click button để crawl 1 số
- **Message Extraction**: Trích xuất text, hình ảnh, timestamp, reply/mention từ DOM Salework
- **Side Panel**: Mở bằng click icon extension hoặc `chrome.sidePanel.open()`
- **Settings**: Click icon ⚙️ để thay đổi API URL, mode, log level
