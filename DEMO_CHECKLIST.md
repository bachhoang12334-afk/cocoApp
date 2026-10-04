# CocoApp Demo Checklist

Checklist này giúp chuẩn bị một buổi demo ngắn, có dữ liệu thật và không phụ thuộc vào thao tác ngẫu nhiên.

## 1. Trước buổi demo

- Chạy đủ migrations từ `20260917000000` đến `20260917000022` trên đúng Supabase project.
- Xác nhận `.env.local` chỉ có `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; không dùng service role key.
- Chuẩn bị ít nhất hai tài khoản đã xác nhận email.
- Hoàn thiện chín trường bắt buộc ở cả hai hồ sơ: họ tên, trường, ngành, năm học, giới tính, mục tiêu, tỉnh/thành phố, khu vực và phạm vi kết nối.
- Đặt hai tài khoản ở hai cửa sổ hoặc hai hồ sơ trình duyệt riêng để tránh dùng nhầm session.
- Chạy checkpoint chất lượng:

```powershell
npm.cmd run check
```

## 2. Kịch bản trình bày 5–7 phút

1. **Trang chủ, tin cậy và Tổng quan:** mở `/` để giới thiệu nhanh ba nhu cầu; mở Trung tâm tin cậy để chỉ ra quyền dữ liệu và tiêu chuẩn cộng đồng, sau đó vào Coco Compass.
2. **Khám phá:** cho xem Coco Fit, vị trí gần đúng, tín hiệu tin cậy và giải thích rằng app không thu GPS hay công khai số nhà.
3. **Đã lưu:** lưu một hồ sơ, bật bộ lọc “Đã lưu”, rồi bỏ lưu để chứng minh shortlist là riêng tư và không gửi notification.
4. **Kết nối có mục đích:** gửi lời mời kèm lời nhắn; tài khoản thứ hai chấp nhận.
5. **Tin nhắn Realtime:** gõ ở một phía để chỉ ra trạng thái đang nhập tạm thời, sau đó gửi tin ở hai phía và chỉ ra trạng thái đã gửi/đã đọc.
6. **Coco Plan:** đề xuất một bước tiếp theo, chấp nhận và giải thích quy tắc hoàn thành theo thời gian.
7. **Quyền riêng tư chủ động:** tắt “Nhận kết nối mới”, cho thấy hồ sơ được ẩn khỏi Khám phá nhưng hội thoại hiện có vẫn giữ nguyên; sau đó bật lại.
8. **An toàn:** mở menu chặn/báo cáo, giải thích dữ liệu báo cáo riêng tư; không cần tạo báo cáo giả nếu dữ liệu demo cần giữ sạch.
9. **Quyền dữ liệu:** chỉ ra nút tải bản sao JSON; mở hộp thoại xoá tài khoản để trình bày câu xác nhận và hậu quả, sau đó đóng bằng “Giữ tài khoản”, không xoá tài khoản demo.

## 3. Dữ liệu demo tối thiểu

Hai hồ sơ nên có cùng một vài tín hiệu công khai để Coco Fit giải thích được kết quả:

- cùng mục tiêu “Học nhóm” hoặc “Team Project”;
- cùng tỉnh/thành phố;
- một khung giờ rảnh chung;
- phong cách cộng tác hoặc mức cam kết tương đồng.

Không nhập số điện thoại, địa chỉ chính xác, mật khẩu hoặc dữ liệu nhạy cảm vào nội dung demo.

## 4. Nếu có sự cố

- Trang trắng do cấu hình: kiểm tra `.env.local`, sau đó khởi động lại Vite.
- Không thấy hồ sơ khác: hoàn thiện đủ chín trường bắt buộc, bật “Nhận kết nối mới” ở cả hai tài khoản và kiểm tra hai tài khoản không chặn nhau.
- Không gửi được lời mời: kiểm tra mục tiêu hợp lệ, lời nhắn 8–240 ký tự và không có kết nối đang pending/accepted.
- Bị giới hạn lời mời: chờ hết cửa sổ 10 phút/24 giờ hoặc 60 phút trước khi gửi lại cùng cặp; không xoá dữ liệu để né giới hạn.
- Không nhắn được: kết nối phải ở trạng thái `accepted`.
- Realtime chậm: làm mới trang; dữ liệu đã lưu vẫn được tải lại từ Supabase.

## 5. Thông điệp sản phẩm

> CocoApp giúp sinh viên chuyển từ “đi tìm người trong các nhóm rời rạc” sang một hành trình có mục tiêu: hiểu vì sao phù hợp, kết nối an toàn, trò chuyện và thống nhất bước tiếp theo.
