-- CocoApp Campus ecosystem: privacy-first room discovery, bookings and Study Hub.
-- This migration is intentionally additive and can be applied after 20260917000023.

create table if not exists public.room_listings (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  area_label text not null default '',
  university_near text not null default '',
  distance_label text not null default '',
  price_per_month integer not null check (price_per_month > 0),
  deposit_amount integer not null default 0 check (deposit_amount >= 0),
  area_m2 numeric(6,1) not null default 20 check (area_m2 > 0),
  total_rooms integer not null default 1 check (total_rooms >= 0),
  floor_label text not null default '',
  move_in_label text not null default '',
  electricity_rate integer not null default 0 check (electricity_rate >= 0),
  water_rate integer not null default 0 check (water_rate >= 0),
  room_type text not null default 'Phòng khép kín',
  vacant_rooms integer not null default 1 check (vacant_rooms >= 0),
  gender_preference text not null default 'Tất cả',
  amenities text[] not null default '{}',
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  reviews_count integer not null default 0 check (reviews_count >= 0),
  description text not null default '' check (char_length(description) <= 1200),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_listings
  add column if not exists deposit_amount integer not null default 0 check (deposit_amount >= 0),
  add column if not exists total_rooms integer not null default 1 check (total_rooms >= 0),
  add column if not exists floor_label text not null default '',
  add column if not exists move_in_label text not null default '',
  add column if not exists electricity_rate integer not null default 0 check (electricity_rate >= 0),
  add column if not exists water_rate integer not null default 0 check (water_rate >= 0);

create table if not exists public.room_bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.room_listings(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  visit_date date not null,
  time_slot text not null check (char_length(btrim(time_slot)) between 3 and 60),
  student_phone text not null check (char_length(btrim(student_phone)) between 8 and 24),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default 'Sinh viên Coco',
  university text not null default '',
  title text not null check (char_length(btrim(title)) between 3 and 160),
  subject text not null check (char_length(btrim(subject)) between 2 and 100),
  description text not null default '' check (char_length(description) <= 1200),
  members_needed integer not null default 1 check (members_needed between 1 and 20),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_name text not null default 'Sinh viên Coco',
  title text not null check (char_length(btrim(title)) between 2 and 160),
  subject text not null check (char_length(btrim(subject)) between 2 and 100),
  material_type text not null default 'Tài liệu',
  description text not null default '' check (char_length(description) <= 800),
  resource_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists room_listings_set_updated_at on public.room_listings;
create trigger room_listings_set_updated_at
before update on public.room_listings
for each row execute function public.set_updated_at();

drop trigger if exists study_posts_set_updated_at on public.study_posts;
create trigger study_posts_set_updated_at
before update on public.study_posts
for each row execute function public.set_updated_at();

drop trigger if exists study_materials_set_updated_at on public.study_materials;
create trigger study_materials_set_updated_at
before update on public.study_materials
for each row execute function public.set_updated_at();

alter table public.room_listings enable row level security;
alter table public.room_bookings enable row level security;
alter table public.study_posts enable row level security;
alter table public.study_materials enable row level security;

revoke all on table public.room_listings, public.room_bookings, public.study_posts, public.study_materials from anon, authenticated;
grant select on table public.room_listings, public.study_posts, public.study_materials to authenticated;
grant insert, update, delete on table public.room_listings, public.study_posts, public.study_materials to authenticated;
grant select, insert on table public.room_bookings to authenticated;

drop policy if exists "Authenticated users can discover available rooms" on public.room_listings;
create policy "Authenticated users can discover available rooms"
on public.room_listings for select to authenticated
using (is_available or owner_id = (select auth.uid()));

drop policy if exists "Owners manage their room listings" on public.room_listings;
create policy "Owners manage their room listings"
on public.room_listings for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Students and room owners view relevant bookings" on public.room_bookings;
create policy "Students and room owners view relevant bookings"
on public.room_bookings for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.room_listings room
    where room.id = room_bookings.room_id
      and room.owner_id = (select auth.uid())
  )
);

drop policy if exists "Students create their own room bookings" on public.room_bookings;
create policy "Students create their own room bookings"
on public.room_bookings for insert to authenticated
with check (student_id = (select auth.uid()));

drop policy if exists "Authenticated users can read open study posts" on public.study_posts;
create policy "Authenticated users can read open study posts"
on public.study_posts for select to authenticated
using (status = 'open' or author_id = (select auth.uid()));

drop policy if exists "Authors manage their study posts" on public.study_posts;
create policy "Authors manage their study posts"
on public.study_posts for all to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

drop policy if exists "Authenticated users can read study materials" on public.study_materials;
create policy "Authenticated users can read study materials"
on public.study_materials for select to authenticated
using (true);

drop policy if exists "Owners manage their study materials" on public.study_materials;
create policy "Owners manage their study materials"
on public.study_materials for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

insert into public.room_listings (
  slug, owner_id, title, area_label, university_near, distance_label,
  price_per_month, deposit_amount, area_m2, total_rooms, floor_label, move_in_label,
  electricity_rate, water_rate, room_type, vacant_rooms, gender_preference,
  amenities, rating, reviews_count, description
)
values
  (
    'z115-studio', null, 'Studio ban công gần ICTU',
    'Ngõ 18 đường Z115 · Quyết Thắng · Thái Nguyên', 'ICTU',
    'Khoảng 250 m tới cổng trường', 2200000, 2000000, 26, 8, 'Tầng 3', 'Vào ở ngay',
    3500, 25000, 'Studio', 2, 'Tất cả',
    array['Điều hòa','Nóng lạnh','Ban công','Khóa vân tay','Wi‑Fi'],
    4.9, 18,
    'Phòng khép kín, có bàn học và ban công. Coco chỉ công khai khu vực gần đúng.'
  ),
  (
    'tan-thinh-mini', null, 'Căn hộ mini full đồ gần KTX',
    'Tân Thịnh · Thái Nguyên', 'ICTU',
    'Khoảng 400 m tới khu KTX', 2800000, 2500000, 32, 12, 'Tầng 2 · Có thang máy', 'Còn 1 phòng duy nhất',
    3800, 28000, 'Căn hộ mini', 1, 'Tất cả',
    array['Bếp riêng','Tủ lạnh','Điều hòa','Thang máy','Camera 24/7'],
    5.0, 24,
    'Không gian tách bếp, phù hợp sinh viên muốn ở lâu dài.'
  ),
  (
    'quang-trung-room', null, 'Phòng khép kín giá sinh viên',
    'Quang Trung · Thái Nguyên', 'ICTU',
    'Khoảng 1.2 km tới trường', 1500000, 1500000, 20, 10, 'Tầng 1', 'Có thể vào ở ngay',
    3500, 25000, 'Khép kín', 3, 'Nữ',
    array['Nóng lạnh','Wi‑Fi','Chỗ để xe','Giờ giấc tự do'],
    4.7, 11,
    'Phòng gọn, đủ nhu cầu cơ bản; ưu tiên sinh viên nữ.'
  )
on conflict (slug) do nothing;

create index if not exists room_listings_available_idx
  on public.room_listings (is_available, price_per_month, created_at desc);
create index if not exists room_bookings_student_idx
  on public.room_bookings (student_id, created_at desc);
create index if not exists study_posts_status_created_idx
  on public.study_posts (status, created_at desc);
create index if not exists study_materials_created_idx
  on public.study_materials (created_at desc);
