# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) để tự động tìm kiếm và trích xuất tin nhắn từ Salework (Zalo CRM). Extension hoạt động bằng cách:
1. Gọi API local (`http://localhost:5153/api/v1`) để lấy danh sách đơn chưa crawl
2. Điền số điện thoại vào ô search trên Salework
3. Click conversation và scroll để load tin nhắn
4. Trích xuất và lưu tin nhắn về API

## Architecture

- **manifest.json** - Cấu hình extension (permissions, host permissions, side panel)
- **background.js** - Service worker xử lý logic crawl, gọi API, quản lý queue
- **content.js** - Script injected vào trang Salework để thao tác DOM (fill phone, extract messages)
- **popup.js/popup.html** - Side panel UI để nhập số điện thoại và hiển thị tin nhắn

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
Cần chạy API server tại `http://localhost:5153` với các endpoints:
- `GET /api/v1/salework/erp/orders/uncrawled?limit=N` - Lấy đơn chưa crawl
- `POST /api/v1/salework/messages` - Lưu tin nhắn

## Key Behaviors

- **Auto Crawl**: Lấy N đơn từ API, tuần tự crawl từng số điện thoại với delay 15s mỗi đơn
- **Manual Search**: Nhập số điện thoại và click button để crawl 1 số
- **Message Extraction**: Trích xuất text, hình ảnh, timestamp, reply/mention từ DOM Salework
- **Side Panel**: Mở bằng click icon extension hoặc `chrome.sidePanel.open()`
