# Team Final Demo

Đây là bản hợp nhất dùng cho buổi demo nhóm.

## Nền tảng giữ lại

Bản cuối giữ nguyên nền React + Vite + Supabase của CocoApp hiện tại, đặc biệt:

- UI/UX tổng thể.
- Login / Register / Reset Password.
- Supabase Auth.
- Profile + privacy.
- Discover + Coco Fit.
- Connection requests.
- Realtime chat, unread, typing, private images.
- Coco Plan.
- Safety / block / report.
- PWA / offline handling.

## Ý tưởng tốt được port từ prototype Flutter

Không copy runtime Flutter vào React. Chỉ port các phần sản phẩm có ích:

- dữ liệu phòng gần ICTU;
- thông tin đặt cọc, tầng, ngày vào ở, giá điện/nước;
- Study Hub với nội dung gần bài học/sinh viên ICTU hơn;
- quick chat prompts theo mục tiêu;
- cách mô tả nhu cầu roommate/thói quen theo hướng thực tế.

## Không mang sang bản cuối

- auth giả/local;
- polling chat mỗi 2 giây;
- random compatibility score;
- API mock;
- số điện thoại chủ trọ hoặc địa chỉ chính xác trong danh sách công khai.

## Luồng demo khuyên dùng

1. Login.
2. Dashboard.
3. Discover → Coco Fit.
4. Ghép trọ → rule cùng giới tính.
5. Kết nối → Realtime chat + quick prompts.
6. Rooms → filter → chi phí → booking.
7. Study Hub → nhóm học + tài liệu.
8. Safety / privacy.

## Kiểm tra trước khi mang đi thi

```powershell
npm.cmd install
npm.cmd run check
npm.cmd run dev
```

Nếu `npm.cmd run check` pass và app mở được trên localhost thì dùng branch này để demo.
