# CocoApp Demo Checklist

Checklist này giúp chuẩn bị một buổi demo ngắn, có dữ liệu thật và không phụ thuộc vào thao tác ngẫu nhiên.

## 1. Trước buổi demo

- Chạy đủ migrations từ `20260917000000` đến `20261006000024` trên đúng Supabase project. Nếu migration Campus chưa kịp chạy, Rooms và Study Hub vẫn tự chuyển sang dữ liệu dự phòng để không làm gián đoạn buổi demo.
- Xác nhận `.env.local` chỉ có `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; không dùng service role key.
- Chuẩn bị ít nhất hai tài khoản đã xác nhận email.
- Hoàn thiện chín trường bắt buộc ở cả hai hồ sơ: họ tên, trường, ngành, năm học, giới tính, mục tiêu, tỉnh/thành phố, khu vực và phạm vi kết nối.
- Đặt hai tài khoản ở hai cửa sổ hoặc hai hồ sơ trình duyệt riêng để tránh dùng nhầm session.
- Chạy checkpoint chất lượng:

```powershell
npm.cmd run check
```

## 2. Kịch bản trình bày 5–7 phút

1. **Trang chủ, tin cậy và workspace:** mở `/` để giới thiệu nhanh ba nhu cầu; mở Trung tâm tin cậy để chỉ ra quyền dữ liệu và tiêu chuẩn cộng đồng, sau đó vào workspace để giới thiệu thanh điều hướng nhanh, mục tiêu kết nối, tab khu vực và bảng ngữ cảnh. Nhấn `Ctrl/Cmd + K`, tìm “tin cay” không dấu rồi dùng bàn phím để đi nhanh tới đúng khu vực.
2. **Khám phá:** cho xem Coco Fit, vị trí gần đúng, tín hiệu tin cậy và giải thích rằng app không thu GPS hay công khai số nhà.
3. **Đã lưu:** lưu một hồ sơ, bật bộ lọc “Đã lưu”, rồi bỏ lưu để chứng minh shortlist là riêng tư và không gửi notification.
4. **Kết nối có mục đích:** gửi lời mời kèm lời nhắn; tài khoản thứ hai chấp nhận, sau đó mở chuông và bật “Chưa đọc” để chỉ ra thông báo mới cùng mốc thời gian hoạt động.
5. **Tin nhắn Realtime:** tìm một hội thoại, bật lọc “Chưa đọc”, gõ một đoạn nháp rồi chuyển hội thoại và quay lại để chứng minh nháp được giữ trong tab; thêm một ảnh chỗ ở hoặc địa điểm mẫu, kiểm tra preview và dòng xác nhận đã loại metadata vị trí rồi gửi kèm chú thích; mở ảnh trong viewer riêng tư rồi đóng bằng `Escape`; tiếp tục gõ ở một phía để chỉ ra trạng thái đang nhập tạm thời, sau đó dùng `Ctrl/Cmd + Enter` để gửi; chỉ ra trạng thái đã gửi/đã đọc và hội thoại vừa nhận tin được đưa lên đầu.
6. **Coco Plan:** đề xuất một bước tiếp theo, chấp nhận và giải thích quy tắc hoàn thành theo thời gian.
7. **Quyền riêng tư chủ động:** tắt “Nhận kết nối mới”, cho thấy hồ sơ được ẩn khỏi Khám phá nhưng hội thoại hiện có vẫn giữ nguyên; sau đó bật lại.
8. **Chống mất dữ liệu:** sửa thử một trường ở Hồ sơ rồi mở mục khác; chọn “Ở lại chỉnh sửa” trong cảnh báo thay đổi chưa lưu và lưu hồ sơ trước khi tiếp tục.
9. **Mất mạng an toàn:** tắt mạng tạm thời, chỉ ra banner ngoại tuyến không che nội dung và trang Kết nối vẫn giữ dữ liệu gần nhất; bật mạng để thấy xác nhận kết nối lại và dữ liệu tự đồng bộ.
10. **An toàn:** mở menu chặn/báo cáo, giải thích dữ liệu báo cáo riêng tư; không cần tạo báo cáo giả nếu dữ liệu demo cần giữ sạch.
11. **Phòng trọ:** mở `Phòng trọ`, thử tìm theo khu vực/tiện ích, đổi mức giá rồi mở `Đặt lịch xem`. Nhấn mạnh rằng danh sách chỉ hiển thị khu vực gần đúng và số điện thoại người đặt không nằm trong dữ liệu phòng công khai.
12. **Study Hub:** mở `Study Hub`, chuyển giữa `Nhóm học` và `Tài liệu`, thử tạo một bài tìm nhóm hoặc tài liệu. Nếu backend Campus chưa được migrate, banner sẽ nói rõ đang dùng dữ liệu dự phòng trên thiết bị thay vì làm app lỗi.
13. **Quyền dữ liệu:** chỉ ra nút tải bản sao JSON; mở hộp thoại xoá tài khoản để trình bày câu xác nhận và hậu quả, sau đó đóng bằng “Giữ tài khoản”, không xoá tài khoản demo.

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
- Không gửi được ảnh: kiểm tra migration `20260917000023`, bucket `message-images` đang private, ảnh nguồn là JPG/PNG/WebP nhỏ hơn 12 MB và kết nối vẫn `accepted`.
- Rooms hoặc Study Hub báo đang dùng dữ liệu dự phòng: migration `20261006000024_add_campus_ecosystem.sql` chưa có trên Supabase hoặc request bị lỗi. Với buổi thi, vẫn có thể demo đầy đủ UI/interaction; sau buổi thi hãy chạy migration để dữ liệu mới được lưu thật vào Supabase.
- Banner ngoại tuyến không biến mất: kiểm tra lại kết nối của thiết bị; banner chỉ phản ánh tín hiệu `navigator.onLine`, không khẳng định Supabase đang hoạt động.
- Realtime chậm: làm mới trang; dữ liệu đã lưu vẫn được tải lại từ Supabase.

## 5. Thông điệp sản phẩm

> CocoApp giúp sinh viên chuyển từ “đi tìm người trong các nhóm rời rạc” sang một hành trình có mục tiêu: hiểu vì sao phù hợp, kết nối an toàn, trò chuyện và thống nhất bước tiếp theo.


## 6. Luồng an toàn nhất cho buổi thi

Nếu thời gian trình bày ngắn hoặc mạng không ổn định, ưu tiên đúng thứ tự này:

1. Login → Dashboard.
2. Discover → giải thích Coco Fit + privacy.
3. Ghép trọ → chứng minh rule cùng giới tính.
4. Kết nối → chat Realtime hoặc mở hội thoại đã chuẩn bị sẵn.
5. Phòng trọ → lọc + mở form đặt lịch.
6. Study Hub → chuyển tab + tạo bài mẫu.
7. Safety / Trust Center → chốt bằng privacy và RLS.

Không cần cố demo reset password, xoá tài khoản hoặc mất mạng nếu giảng viên không hỏi. Các flow đó đã có trong code nhưng dễ tốn thời gian trình bày.


## 7. Điểm nên show của bản hợp nhất nhóm

- UI/UX và Login/Register: giữ nguyên bản React/Supabase ổn định.
- Chat: mở một hội thoại và bấm thử một **Quick prompt**; nội dung chỉ được điền vào ô nhắn, chưa tự gửi.
- Rooms: chỉ khu vực gần đúng được công khai; show thêm đặt cọc, tầng, ngày vào ở, giá điện/nước.
- Study Hub: nội dung mẫu bám sát DSA, TOEIC và project sinh viên ICTU.
- Không dùng các flow Flutter cũ như auth local, polling chat hoặc API mock trong buổi demo.
