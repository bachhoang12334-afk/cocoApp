import { Link } from 'react-router-dom'
import '../Landing.css'

function LandingIcon({ name }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'study') {
    return <svg {...commonProps}><path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 13v4c3 2.2 7 2.2 10 0v-4"/><path d="M21 10v6"/></svg>
  }

  if (name === 'team') {
    return <svg {...commonProps}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.5A4.5 4.5 0 0 1 21 19"/></svg>
  }

  if (name === 'home') {
    return <svg {...commonProps}><path d="m3 11 9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9 20v-6h6v6"/></svg>
  }

  if (name === 'shield') {
    return <svg {...commonProps}><path d="M12 3 4.5 6v5.2c0 4.6 3.1 7.8 7.5 9.8 4.4-2 7.5-5.2 7.5-9.8V6L12 3Z"/><path d="m8.8 12 2.1 2.1 4.4-4.5"/></svg>
  }

  if (name === 'spark') {
    return <svg {...commonProps}><path d="M12 3c.7 3.5 2.5 5.3 6 6-3.5.7-5.3 2.5-6 6-.7-3.5-2.5-5.3-6-6 3.5-.7 5.3-2.5 6-6Z"/><path d="M19 15c.3 1.7 1.3 2.7 3 3-1.7.3-2.7 1.3-3 3-.3-1.7-1.3-2.7-3-3 1.7-.3 2.7-1.3 3-3Z"/></svg>
  }

  if (name === 'chat') {
    return <svg {...commonProps}><path d="M20 14a4 4 0 0 1-4 4H9l-5 3v-6.5A6.5 6.5 0 0 1 3 11V9a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2a5 5 0 0 1-1 3Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>
  }

  return <svg {...commonProps}><path d="m5 12 4 4L19 6"/></svg>
}

const goals = [
  {
    icon: 'study',
    index: '01',
    title: 'Học nhóm có mục tiêu',
    description: 'Tìm bạn cùng ngành, môn học và khung giờ để bắt đầu nhanh hơn.',
    tone: 'violet',
  },
  {
    icon: 'team',
    index: '02',
    title: 'Lập team làm dự án',
    description: 'Ghép kỹ năng bổ trợ và cách làm việc phù hợp cho đồ án hoặc ý tưởng mới.',
    tone: 'coral',
  },
  {
    icon: 'home',
    index: '03',
    title: 'Tìm người ghép trọ',
    description: 'Lọc theo khu vực và nhu cầu sống, nhưng vẫn giữ thông tin nhạy cảm riêng tư.',
    tone: 'mint',
  },
]

const steps = [
  {
    number: '01',
    title: 'Cho Coco biết cậu cần gì',
    description: 'Hoàn thiện hồ sơ, mục tiêu, kỹ năng và cách cậu muốn cộng tác.',
  },
  {
    number: '02',
    title: 'Hiểu vì sao hai người hợp nhau',
    description: 'Mỗi gợi ý đều có tín hiệu phù hợp rõ ràng, không chỉ là một điểm số bí ẩn.',
  },
  {
    number: '03',
    title: 'Kết nối có chủ đích',
    description: 'Gửi lời mời có lời nhắn, trò chuyện và biến cuộc gặp thành một kế hoạch cụ thể.',
  },
]

export default function Landing({ account, isCheckingSession }) {
  const isAuthenticated = Boolean(account)
  const primaryTarget = isAuthenticated ? '/dashboard' : '/register'
  const primaryLabel = isAuthenticated ? 'Vào không gian của cậu' : 'Tạo hồ sơ miễn phí'

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#landing-main">Đi tới nội dung chính</a>

      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="Coco, trang chủ">
          <span className="landing-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="7" cy="8" r="2.5" fill="currentColor" />
              <circle cx="17" cy="7" r="2.5" fill="currentColor" />
              <circle cx="12" cy="17" r="2.5" fill="currentColor" />
              <path d="M9.2 9.2 11 14.6M14.4 14.8l1.8-5.4M9.4 7.8h5.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span>Coco<span>.</span></span>
        </Link>

        <nav className="landing-nav" aria-label="Điều hướng trang giới thiệu">
          <a href="#goals">Cậu có thể tìm gì?</a>
          <a href="#how-it-works">Cách hoạt động</a>
          <a href="#trust">An toàn</a>
        </nav>

        <div className="landing-header-actions">
          {!isAuthenticated && !isCheckingSession && <Link className="landing-login-link" to="/login">Đăng nhập</Link>}
          {isCheckingSession ? (
            <span className="landing-session-check" role="status">Đang kiểm tra…</span>
          ) : (
            <Link className="landing-header-cta" to={primaryTarget}>{isAuthenticated ? 'Mở Coco' : 'Bắt đầu'}</Link>
          )}
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><span aria-hidden="true" /> Không gian kết nối dành cho sinh viên</p>
            <h1 id="landing-title">Đừng chỉ tìm một người. <span>Tìm đúng người đồng hành.</span></h1>
            <p className="landing-hero-description">
              Coco giúp cậu tìm bạn học, đồng đội làm dự án và người ghép trọ dựa trên mục tiêu, kỹ năng và cách hai người có thể phối hợp thật sự.
            </p>

            <div className="landing-hero-actions">
              {isCheckingSession ? (
                <span className="landing-primary-cta is-pending" role="status">Đang chuẩn bị Coco…</span>
              ) : (
                <Link className="landing-primary-cta" to={primaryTarget}>
                  {primaryLabel}<span aria-hidden="true">→</span>
                </Link>
              )}
              <a className="landing-secondary-cta" href="#how-it-works">Xem Coco hoạt động</a>
            </div>

            <ul className="landing-hero-assurances" aria-label="Cam kết nhanh của Coco">
              <li><LandingIcon name="check" /> Không công khai số điện thoại</li>
              <li><LandingIcon name="check" /> Có quyền tạm dừng kết nối</li>
            </ul>
          </div>

          <div className="landing-hero-visual" aria-label="Minh hoạ cách Coco giải thích một gợi ý phù hợp">
            <div className="landing-orbit landing-orbit-one" aria-hidden="true" />
            <div className="landing-orbit landing-orbit-two" aria-hidden="true" />
            <div className="landing-match-card">
              <div className="landing-match-topline">
                <span className="landing-match-label"><LandingIcon name="spark" /> Gợi ý phù hợp</span>
                <span className="landing-match-score">Rất phù hợp</span>
              </div>
              <div className="landing-match-profile">
                <div className="landing-match-avatar" aria-hidden="true">C</div>
                <div>
                  <strong>Một người cùng hướng</strong>
                  <span>Coco giải thích trước khi cậu kết nối</span>
                </div>
              </div>
              <div className="landing-match-signals">
                <span><i aria-hidden="true" /> Cùng mục tiêu học tập</span>
                <span><i aria-hidden="true" /> Kỹ năng có thể bổ trợ</span>
                <span><i aria-hidden="true" /> Lịch làm việc tương thích</span>
              </div>
              <div className="landing-match-action">
                <span><LandingIcon name="chat" /> Lời mời có lời nhắn</span>
                <strong aria-hidden="true">→</strong>
              </div>
            </div>
            <div className="landing-floating-note landing-floating-note-safety">
              <LandingIcon name="shield" />
              <span><strong>Riêng tư theo mặc định</strong><small>Chỉ chia sẻ khi cậu muốn</small></span>
            </div>
            <div className="landing-floating-note landing-floating-note-purpose">
              <LandingIcon name="team" />
              <span><strong>Kết nối có mục đích</strong><small>Không lướt vô định</small></span>
            </div>
          </div>
        </section>

        <section className="landing-proof-strip" aria-label="Điểm khác biệt của Coco">
          <div><strong>03</strong><span>Nhu cầu sinh viên thực tế</span></div>
          <div><strong>Rõ ràng</strong><span>Lý do phù hợp cho mỗi gợi ý</span></div>
          <div><strong>Chủ động</strong><span>Quyền riêng tư trong tay cậu</span></div>
        </section>

        <section id="goals" className="landing-section landing-goals" aria-labelledby="goals-title">
          <div className="landing-section-heading">
            <p>Coco phù hợp khi nào?</p>
            <h2 id="goals-title">Một nơi cho những kết nối có ích ngoài đời thật.</h2>
            <span>Chọn mục tiêu, hiểu độ phù hợp và bắt đầu cuộc trò chuyện đúng ngữ cảnh.</span>
          </div>

          <div className="landing-goal-grid">
            {goals.map((goal) => (
              <article className={`landing-goal-card ${goal.tone}`} key={goal.title}>
                <div className="landing-goal-card-top">
                  <span className="landing-goal-icon"><LandingIcon name={goal.icon} /></span>
                  <span className="landing-goal-index">{goal.index}</span>
                </div>
                <h3>{goal.title}</h3>
                <p>{goal.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="landing-section landing-process" aria-labelledby="process-title">
          <div className="landing-process-copy">
            <p className="landing-section-kicker">Ít lướt hơn, hiểu nhau nhanh hơn</p>
            <h2 id="process-title">Từ một nhu cầu mơ hồ đến một kế hoạch rõ ràng.</h2>
            <p>Coco không dừng ở “match”. Sau khi kết nối, hai người có thể nhắn tin, thống nhất mục tiêu và theo dõi Coco Plan chung.</p>
            <Link to={isAuthenticated ? '/matches' : '/register'}>
              {isAuthenticated ? 'Xem các kết nối của cậu' : 'Bắt đầu kết nối'}<span aria-hidden="true">→</span>
            </Link>
          </div>

          <ol className="landing-step-list">
            {steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section id="trust" className="landing-section landing-trust" aria-labelledby="trust-title">
          <div className="landing-trust-mark"><LandingIcon name="shield" /></div>
          <div className="landing-trust-copy">
            <p className="landing-section-kicker">An toàn không phải tính năng phụ</p>
            <h2 id="trust-title">Cậu luôn giữ quyền quyết định.</h2>
            <p>Hồ sơ chỉ hiện thông tin cần để tìm người phù hợp. Cậu có thể lưu hồ sơ riêng tư, tạm dừng lời mời mới, chặn, báo cáo hoặc ngắt một kết nối bất cứ lúc nào.</p>
          </div>
          <ul className="landing-trust-list">
            <li><LandingIcon name="check" /><span><strong>Thông tin vừa đủ</strong><small>Không hiển thị số nhà hay số điện thoại</small></span></li>
            <li><LandingIcon name="check" /><span><strong>Công cụ an toàn rõ ràng</strong><small>Chặn và báo cáo ngay trong luồng sử dụng</small></span></li>
            <li><LandingIcon name="check" /><span><strong>Kết nối theo sự đồng thuận</strong><small>Chỉ nhắn tin sau khi lời mời được chấp nhận</small></span></li>
          </ul>
        </section>

        <section className="landing-final-cta" aria-labelledby="final-cta-title">
          <div>
            <p>Sẵn sàng tìm đúng người?</p>
            <h2 id="final-cta-title">Bắt đầu từ điều cậu muốn làm.</h2>
          </div>
          {!isCheckingSession && (
            <Link to={primaryTarget}>{primaryLabel}<span aria-hidden="true">→</span></Link>
          )}
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" className="landing-brand" aria-label="Coco, trang chủ">
          <span className="landing-brand-mark" aria-hidden="true">C</span>
          <span>Coco<span>.</span></span>
        </Link>
        <p>© 2026 Coco App · Kết nối sinh viên có mục đích.</p>
        <Link to={isAuthenticated ? '/safety' : '/register'}>{isAuthenticated ? 'Trung tâm an toàn' : 'Tham gia Coco'}</Link>
      </footer>
    </div>
  )
}
