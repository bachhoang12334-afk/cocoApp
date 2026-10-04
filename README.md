# CocoApp

CocoApp là nền tảng kết nối sinh viên theo nhu cầu thực tế: học nhóm, lập team project và tìm người ghép trọ. Ứng dụng dùng React, Vite và Supabase cho Auth, dữ liệu, RLS và Realtime.

## Chức năng hiện có

- Trang giới thiệu công khai giải thích ba nhu cầu, cách ghép phù hợp và cam kết an toàn trước khi đăng ký.
- Trung tâm tin cậy công khai giải thích quyền riêng tư, tiêu chuẩn cộng đồng, điều khoản và cách tự bảo vệ mình.
- Đăng ký, đăng nhập và hồ sơ đồng bộ với Supabase.
- Khám phá sinh viên theo mục tiêu và phạm vi khu vực gần đúng, không thu GPS.
- Lưu hồ sơ riêng tư để xem lại mà không thông báo cho người được lưu.
- Tạm dừng kết nối mới để ẩn hồ sơ khỏi Khám phá mà vẫn giữ hội thoại hiện có.
- Tự xoá tài khoản bằng xác nhận nhiều bước; dữ liệu gắn với tài khoản được xoá theo cascade.
- Sao chép lời mời tham gia CocoApp từ trạng thái Khám phá chưa có người dùng khác.
- Gửi, chấp nhận, từ chối, hủy và ngắt kết nối.
- Thông báo Realtime với trạng thái đã đọc.
- Tin nhắn Realtime, lịch sử, phân trang và số tin chưa đọc.
- Coco Plan giúp hai kết nối đề xuất, thống nhất và hoàn thành một bước tiếp theo.
- Khôi phục mật khẩu và gửi lại email xác nhận.
- Giao diện responsive và hỗ trợ thao tác bàn phím.

## Chạy local

Yêu cầu Node.js tương thích với Vite 8.

```powershell
npm.cmd install
npm.cmd run dev
```

Các biến môi trường được mô tả trong `.env.example`. Tạo `.env.local` trên máy cá nhân và không commit file này.

## Supabase

Chạy migrations theo đúng thứ tự trong `supabase/migrations`:

1. `20260917000000_create_profile_schema.sql`
2. `20260917000001_create_connection_requests.sql`
3. `20260917000002_allow_connection_disconnect.sql`
4. `20260917000003_create_notifications.sql`
5. `20260917000004_create_messages.sql`
6. `20260917000005_add_message_read_status.sql`
7. `20260917000006_sync_profile_registration_metadata.sql`
8. `20260917000007_create_safety_tools.sql`
9. `20260917000008_add_profile_trust_signals.sql`
10. `20260917000009_add_connection_request_intros.sql`
11. `20260917000010_add_matching_preferences.sql`
12. `20260917000011_harden_profile_access.sql`
13. `20260917000012_create_connection_plans.sql`
14. `20260917000013_harden_connection_plan_transitions.sql`
15. `20260917000014_add_coco_plan_notifications.sql`
16. `20260917000015_harden_reports_and_plan_completion.sql`
17. `20260917000016_harden_connection_request_privileges.sql`
18. `20260917000017_add_private_proximity_scope.sql`
19. `20260917000018_enforce_connection_readiness.sql`
20. `20260917000019_create_saved_profiles.sql`
21. `20260917000020_add_connection_pause.sql`
22. `20260917000021_add_self_service_account_deletion.sql`

Không chỉnh sửa migration đã chạy. Mọi thay đổi schema tiếp theo phải nằm trong migration mới.

### Redirect URLs cho Auth

Trong Supabase Dashboard, mở `Authentication → URL Configuration` và thêm các URL đang dùng khi phát triển:

```text
http://127.0.0.1:5173/login
http://127.0.0.1:5173/reset-password
http://localhost:5173/login
http://localhost:5173/reset-password
```

Khi deploy, thêm URL `/login` và `/reset-password` của domain production. Không dùng wildcard rộng cho production.

## Kiểm tra chất lượng

```powershell
npm.cmd run check
```

Lệnh này chạy tuần tự lint, unit tests, production build và `git diff --check`.

Playwright là bộ kiểm thử riêng và không nằm trong checkpoint mặc định.

Khi chuẩn bị thuyết trình, dùng [DEMO_CHECKLIST.md](./DEMO_CHECKLIST.md) để kiểm tra dữ liệu và đi theo kịch bản demo 5–7 phút.

## Checklist khôi phục tài khoản

1. Từ `/login`, mở “Quên mật khẩu?”.
2. Gửi email khôi phục và kiểm tra thông báo không tiết lộ tài khoản có tồn tại hay không.
3. Mở liên kết trong email và thử hai mật khẩu không trùng nhau.
4. Lưu mật khẩu hợp lệ, sau đó xác nhận ứng dụng quay về `/login`.
5. Kiểm tra mật khẩu cũ thất bại, mật khẩu mới đăng nhập thành công.
6. Kiểm tra session cũ trên thiết bị khác đã bị đăng xuất.
7. Với tài khoản chưa xác nhận, kiểm tra nút gửi lại email xác nhận.

## Nguyên tắc dữ liệu

- `profile_private` không được đưa vào Realtime hoặc hiển thị cho người dùng khác.
- Client không được tự tạo notification tùy ý hoặc sửa nội dung tin nhắn đã gửi.
- Tin nhắn chỉ hoạt động khi connection đang ở trạng thái `accepted`.
- Không lưu khóa Supabase hoặc thông tin riêng tư trong repository.
