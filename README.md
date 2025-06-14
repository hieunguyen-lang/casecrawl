# Case Crawler Tool

Công cụ crawl case tự động với nhiều profile Chrome, hỗ trợ proxy và extension tùy chỉnh.

## Tính năng chính

- 🚀 Chạy nhiều profile Chrome song song
- 🔒 Hỗ trợ proxy cho mỗi profile
- 🎯 Tích hợp extension tùy chỉnh với API key
- 📊 Theo dõi tiến trình crawl realtime
- 📁 Xuất dữ liệu dạng nén gzip
- 🔄 Tự động phân phối cases cho các profile
- 🎨 Giao diện người dùng thân thiện

## Yêu cầu hệ thống

- Node.js (v14.0.0 trở lên)
- Google Chrome
- Windows (đã test trên Windows 10/11)

## Cài đặt

1. Clone repository:
```powershell
git clone <repository-url>
cd casecrawl
```

2. Cài đặt dependencies:
```powershell
npm install
```

3. Cấu hình extension:
- Đặt API key trong `my_extenstion/configs.json`
- Chrome sẽ tự động load extension khi chạy

## Sử dụng

1. Khởi động ứng dụng:
```powershell
npm start
```

2. Cấu hình trong giao diện:
- Số lượng profile Chrome chạy song song
- Nhập API key cho extension
- Chọn file input (.txt hoặc .XML)
- Tùy chỉnh đường dẫn Chrome (nếu cần)
- Thêm danh sách proxy (tùy chọn)

3. Theo dõi tiến trình:
- Xem phân phối cases cho từng profile
- Theo dõi cases đã crawl thành công
- Kiểm tra cases bị lỗi
- Xuất kết quả khi hoàn thành

## Cấu trúc dự án

```
casecrawl/
├── main.js                 # Main process Electron
├── index.html             # Giao diện người dùng
├── puppeter_fake_finger_print.js  # Script crawl chính
├── my_extenstion/        # Extension Chrome
│   ├── configs.json     # Cấu hình extension
│   └── ...
└── package.json
```

## Xử lý lỗi thường gặp

1. Chrome không khởi động:
- Kiểm tra đường dẫn Chrome
- Đảm bảo đã tắt tất cả instances Chrome
- Kiểm tra quyền truy cập

2. Extension không hoạt động:
- Kiểm tra API key trong configs.json
- Đảm bảo extension được load đúng cách

3. Proxy không hoạt động:
- Kiểm tra định dạng proxy (host:port hoặc host:port:user:pass)
- Đảm bảo proxy còn hoạt động

## Phát triển

1. Debug:
- Main process: Xem logs trong terminal
- Renderer process: Chrome DevTools (Ctrl+Shift+I)
- Chrome process: Xem logs trong profile folders

2. Build:
```powershell
npm run build # (Cần thêm script build vào package.json)
```

## Bảo mật

- Không chia sẻ API key
- Bảo vệ file configs.json
- Sử dụng proxy an toàn
- Cẩn thận với dữ liệu nhạy cảm

## Đóng góp

Mọi đóng góp đều được chào đón. Vui lòng:
1. Fork dự án
2. Tạo branch mới
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## Hỗ trợ

Nếu gặp vấn đề hoặc cần hỗ trợ:
- Tạo issue trên GitHub
- Liên hệ qua email


npm run dist