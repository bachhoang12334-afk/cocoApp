import { useMemo, useState } from 'react'
import AppLayout, { Icon } from '../components/AppLayout'
import './Rooms.css'

const SAMPLE_ROOMS = [
  {
    id: 'z115-studio',
    title: 'Studio ban công gần ICTU',
    area: 'Ngõ 18 đường Z115 · Quyết Thắng · Thái Nguyên',
    university: 'ICTU',
    distance: 'Khoảng 250 m tới cổng trường',
    price: 2200000,
    size: 26,
    type: 'Studio',
    vacant: 2,
    gender: 'Tất cả',
    amenities: ['Điều hòa', 'Nóng lạnh', 'Ban công', 'Khóa vân tay', 'Wi‑Fi'],
    rating: 4.9,
    reviews: 18,
    description: 'Phòng khép kín, có bàn học và ban công. Coco chỉ hiển thị khu vực gần đúng trước khi lịch xem được xác nhận.',
  },
  {
    id: 'tan-thinh-mini',
    title: 'Căn hộ mini full đồ gần KTX',
    area: 'Tân Thịnh · Thái Nguyên',
    university: 'ICTU',
    distance: 'Khoảng 400 m tới khu KTX',
    price: 2800000,
    size: 32,
    type: 'Căn hộ mini',
    vacant: 1,
    gender: 'Tất cả',
    amenities: ['Bếp riêng', 'Tủ lạnh', 'Điều hòa', 'Thang máy', 'Camera 24/7'],
    rating: 5,
    reviews: 24,
    description: 'Không gian tách bếp, phù hợp sinh viên muốn ở lâu dài. Số nhà và số điện thoại chủ trọ được ẩn ở bước khám phá.',
  },
  {
    id: 'quang-trung-room',
    title: 'Phòng khép kín giá sinh viên',
    area: 'Quang Trung · Thái Nguyên',
    university: 'ICTU',
    distance: 'Khoảng 1.2 km tới trường',
    price: 1500000,
    size: 20,
    type: 'Khép kín',
    vacant: 3,
    gender: 'Nữ',
    amenities: ['Nóng lạnh', 'Wi‑Fi', 'Chỗ để xe', 'Giờ giấc tự do'],
    rating: 4.7,
    reviews: 11,
    description: 'Phòng gọn, đủ nhu cầu cơ bản. Chủ trọ ưu tiên sinh viên nữ và cho phép hẹn xem phòng theo khung giờ.',
  },
]

const priceOptions = [
  { value: 'all', label: 'Mọi mức giá' },
  { value: 'under2', label: 'Dưới 2 triệu' },
  { value: '2to25', label: '2–2.5 triệu' },
  { value: 'over25', label: 'Trên 2.5 triệu' },
]

const timeSlots = ['09:00 – 10:00', '14:00 – 15:00', '17:30 – 18:30']

function money(value) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' đ/tháng'
}

function loadBookings() {
  try {
    return JSON.parse(window.localStorage.getItem('cocoapp:room-bookings') || '[]')
  } catch {
    return []
  }
}

export default function Rooms() {
  const [query, setQuery] = useState('')
  const [price, setPrice] = useState('all')
  const [onlyVacant, setOnlyVacant] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [bookings, setBookings] = useState(loadBookings)
  const [bookingForm, setBookingForm] = useState({
    date: '',
    time: timeSlots[0],
    phone: '',
    note: '',
  })
  const [status, setStatus] = useState('')

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')

    return SAMPLE_ROOMS.filter((room) => {
      const haystack = [
        room.title,
        room.area,
        room.university,
        room.type,
        ...room.amenities,
      ].join(' ').toLocaleLowerCase('vi')

      const priceMatches =
        price === 'all' ||
        (price === 'under2' && room.price < 2000000) ||
        (price === '2to25' && room.price >= 2000000 && room.price <= 2500000) ||
        (price === 'over25' && room.price > 2500000)

      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        priceMatches &&
        (!onlyVacant || room.vacant > 0)
      )
    })
  }, [onlyVacant, price, query])

  function openBooking(room) {
    setSelectedRoom(room)
    setStatus('')
    setBookingForm({
      date: '',
      time: timeSlots[0],
      phone: '',
      note: '',
    })
  }

  function closeBooking() {
    setSelectedRoom(null)
    setStatus('')
  }

  function submitBooking(event) {
    event.preventDefault()

    if (!bookingForm.date || bookingForm.phone.trim().length < 8) {
      setStatus('Hãy chọn ngày xem phòng và nhập số điện thoại hợp lệ.')
      return
    }

    const booking = {
      id: crypto.randomUUID?.() || String(Date.now()),
      roomId: selectedRoom.id,
      roomTitle: selectedRoom.title,
      area: selectedRoom.area,
      date: bookingForm.date,
      time: bookingForm.time,
      phone: bookingForm.phone.trim(),
      note: bookingForm.note.trim(),
      createdAt: new Date().toISOString(),
    }

    const nextBookings = [booking, ...bookings]
    setBookings(nextBookings)

    try {
      window.localStorage.setItem('cocoapp:room-bookings', JSON.stringify(nextBookings))
    } catch {
      // The confirmation still works even when storage is unavailable.
    }

    setStatus('Đã lưu lịch xem trên thiết bị này. Bản production sẽ đồng bộ lịch qua Supabase.')
  }

  return (
    <AppLayout>
      <main className="rooms-page">
        <section className="rooms-hero">
          <div>
            <p className="rooms-eyebrow">COCO ROOMS · PREVIEW</p>
            <h1>Tìm phòng trọ mà không cần công khai quá nhiều</h1>
            <p>
              Lọc theo khu vực, giá và tiện ích. Coco chỉ hiển thị khu vực gần đúng;
              số nhà và liên hệ chi tiết được giữ lại cho bước xác nhận lịch xem.
            </p>
          </div>

          <div className="rooms-hero-stats" aria-label="Tóm tắt phòng trọ">
            <span><strong>{SAMPLE_ROOMS.length}</strong> phòng mẫu</span>
            <span><strong>{SAMPLE_ROOMS.reduce((sum, room) => sum + room.vacant, 0)}</strong> chỗ trống</span>
            <span><strong>{bookings.length}</strong> lịch đã lưu</span>
          </div>
        </section>

        <section className="rooms-filter-card" aria-label="Bộ lọc phòng trọ">
          <label className="rooms-search">
            <Icon name="discover" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm Z115, Tân Thịnh, điều hòa…"
            />
          </label>

          <select value={price} onChange={(event) => setPrice(event.target.value)}>
            {priceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <label className="rooms-checkbox">
            <input
              type="checkbox"
              checked={onlyVacant}
              onChange={(event) => setOnlyVacant(event.target.checked)}
            />
            Chỉ còn phòng
          </label>
        </section>

        <div className="rooms-results-head">
          <div>
            <strong>{filtered.length} kết quả</strong>
            <span>Thông tin demo được chuyển từ concept Flutter sang React/Supabase.</span>
          </div>
          <a href="/roommates">Tìm bạn ghép trọ →</a>
        </div>

        <section className="rooms-grid">
          {filtered.map((room) => (
            <article key={room.id} className="room-card">
              <div className="room-card-cover" aria-hidden="true">
                <span>{room.type}</span>
                <strong>{room.size} m²</strong>
              </div>

              <div className="room-card-body">
                <div className="room-card-topline">
                  <span>{room.distance}</span>
                  <span>★ {room.rating} ({room.reviews})</span>
                </div>

                <h2>{room.title}</h2>
                <p className="room-area">{room.area}</p>
                <p className="room-price">{money(room.price)}</p>
                <p className="room-description">{room.description}</p>

                <div className="room-amenities">
                  {room.amenities.map((item) => <span key={item}>{item}</span>)}
                </div>

                <div className="room-card-footer">
                  <div>
                    <strong>{room.vacant} phòng trống</strong>
                    <span>Ưu tiên: {room.gender}</span>
                  </div>
                  <button type="button" onClick={() => openBooking(room)}>
                    Đặt lịch xem
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        {filtered.length === 0 && (
          <section className="rooms-empty">
            <Icon name="discover" />
            <h2>Chưa có phòng khớp bộ lọc</h2>
            <p>Thử bỏ bớt từ khóa hoặc mở rộng mức giá.</p>
          </section>
        )}

        {bookings.length > 0 && (
          <section className="rooms-bookings">
            <div>
              <p className="rooms-eyebrow">LỊCH XEM CỦA CẬU</p>
              <h2>Booking gần đây</h2>
            </div>
            <div className="rooms-booking-list">
              {bookings.slice(0, 3).map((booking) => (
                <article key={booking.id}>
                  <strong>{booking.roomTitle}</strong>
                  <span>{booking.date} · {booking.time}</span>
                  <small>{booking.area}</small>
                </article>
              ))}
            </div>
          </section>
        )}

        {selectedRoom && (
          <div className="room-dialog-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBooking()
          }}>
            <section className="room-dialog" role="dialog" aria-modal="true" aria-labelledby="room-dialog-title">
              <header>
                <div>
                  <p className="rooms-eyebrow">ĐẶT LỊCH XEM PHÒNG</p>
                  <h2 id="room-dialog-title">{selectedRoom.title}</h2>
                  <span>{selectedRoom.area}</span>
                </div>
                <button type="button" className="room-dialog-close" onClick={closeBooking} aria-label="Đóng">
                  ×
                </button>
              </header>

              <form onSubmit={submitBooking}>
                <label>
                  Ngày xem phòng
                  <input
                    type="date"
                    required
                    value={bookingForm.date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setBookingForm({ ...bookingForm, date: event.target.value })}
                  />
                </label>

                <label>
                  Khung giờ
                  <select
                    value={bookingForm.time}
                    onChange={(event) => setBookingForm({ ...bookingForm, time: event.target.value })}
                  >
                    {timeSlots.map((slot) => <option key={slot}>{slot}</option>)}
                  </select>
                </label>

                <label>
                  Số điện thoại của cậu
                  <input
                    type="tel"
                    placeholder="Ví dụ: 09xxxxxxxx"
                    value={bookingForm.phone}
                    onChange={(event) => setBookingForm({ ...bookingForm, phone: event.target.value })}
                  />
                </label>

                <label className="room-dialog-note">
                  Ghi chú
                  <textarea
                    rows="3"
                    placeholder="Ví dụ: Em muốn xem phòng sau giờ học."
                    value={bookingForm.note}
                    onChange={(event) => setBookingForm({ ...bookingForm, note: event.target.value })}
                  />
                </label>

                <div className="room-privacy-note">
                  <Icon name="safety" />
                  <span>Địa chỉ chính xác và liên hệ chủ trọ không được công khai ở bước khám phá.</span>
                </div>

                {status && <p className="room-booking-status" role="status">{status}</p>}

                <div className="room-dialog-actions">
                  <button type="button" className="secondary-action" onClick={closeBooking}>Để sau</button>
                  <button type="submit">Xác nhận lịch xem</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </AppLayout>
  )
}
