import { Link } from 'react-router-dom'
import '../TrustCenter.css'

function TrustIcon({ name }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'shield') {
    return <svg {...commonProps}><path d="M12 3 4.5 6v5.2c0 4.6 3.1 7.8 7.5 9.8 4.4-2 7.5-5.2 7.5-9.8V6L12 3Z"/><path d="m8.8 12 2.1 2.1 4.4-4.5"/></svg>
  }

  if (name === 'lock') {
    return <svg {...commonProps}><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>
  }

  if (name === 'people') {
    return <svg {...commonProps}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.5A4.5 4.5 0 0 1 21 19"/></svg>
  }

  if (name === 'document') {
    return <svg {...commonProps}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>
  }

  return <svg {...commonProps}><path d="m5 12 4 4L19 6"/></svg>
}

const privacyGroups = [
  {
    title: 'Hiển thị để kết nối',
    text: 'Họ tên, trường, ngành, mục tiêu, khu vực rộng và các lựa chọn cộng tác mà cậu chủ động lưu.',
    tone: 'violet',
  },
  {
    title: 'Giữ riêng tư',
    text: 'Email đăng nhập, số điện thoại, danh sách đã lưu, báo cáo và dữ liệu quản trị tài khoản.',
    tone: 'mint',
  },
  {
    title: 'Không thu thập',
    text: 'Coco không yêu cầu GPS, số nhà, căn cước, dữ liệu thanh toán hoặc mật khẩu trong hồ sơ.',
    tone: 'coral',
  },
]

const communityRules = [
  {
    title: 'Đúng mục đích',
    text: 'Gửi lời mời có ngữ cảnh học nhóm, làm dự án hoặc ghép trọ. Không spam hay quảng cáo trá hình.',
  },
  {
    title: 'Tôn trọng ranh giới',
    text: 'Không quấy rối, đe doạ, phân biệt đối xử hoặc tiếp tục liên hệ khi người kia đã từ chối hay ngắt kết nối.',
  },
  {
    title: 'Giữ an toàn ngoài đời',
    text: 'Tự xác minh thông tin, gặp ở nơi công cộng và không chuyển tiền chỉ dựa trên một hồ sơ Coco.',
  },
  {
    title: 'Báo cáo có trách nhiệm',
    text: 'Chỉ gửi báo cáo khi có vấn đề thật. Nội dung báo cáo được giữ riêng tư và không hiển thị cho người bị báo cáo.',
  },
]

export default function TrustCenter({ account }) {
  const isAuthenticated = Boolean(account)

  return (
    <div className="trust-center-page">
      <a className="trust-skip-link" href="#trust-main">Đi tới nội dung chính</a>

      <header className="trust-header">
        <Link to="/" className="trust-brand" aria-label="Coco, trang chủ">
          <span className="trust-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="7" cy="8" r="2.5" fill="currentColor" />
              <circle cx="17" cy="7" r="2.5" fill="currentColor" />
              <circle cx="12" cy="17" r="2.5" fill="currentColor" />
              <path d="M9.2 9.2 11 14.6M14.4 14.8l1.8-5.4M9.4 7.8h5.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span>Coco<span>.</span></span>
        </Link>

        <Link className="trust-header-action" to={isAuthenticated ? '/safety' : '/register'}>
          {isAuthenticated ? 'Mở Trung tâm an toàn' : 'Tham gia Coco'}
        </Link>
      </header>

      <main id="trust-main" className="trust-main">
        <section className="trust-hero" aria-labelledby="trust-page-title">
          <div className="trust-hero-copy">
            <p className="trust-eyebrow"><TrustIcon name="shield" /> Trung tâm tin cậy Coco</p>
            <h1 id="trust-page-title">Kết nối có ích bắt đầu từ <span>quyền kiểm soát rõ ràng.</span></h1>
            <p>
              Đây là bản giải thích dễ đọc về dữ liệu Coco sử dụng, cách cộng đồng nên đối xử với nhau
              và những giới hạn cần nhớ trước khi kết nối ngoài đời.
            </p>
          </div>

          <aside className="trust-status-card" aria-label="Thông tin tài liệu">
            <span>BẢN DEMO HỌC PHẦN</span>
            <strong>Minh bạch trước khi đăng ký</strong>
            <dl>
              <div><dt>Cập nhật</dt><dd>03/10/2026</dd></div>
              <div><dt>Phạm vi</dt><dd>CocoApp</dd></div>
              <div><dt>Ngôn ngữ</dt><dd>Tiếng Việt</dd></div>
            </dl>
          </aside>
        </section>

        <nav className="trust-section-nav" aria-label="Nội dung Trung tâm tin cậy">
          <a href="#privacy"><span>01</span> Quyền riêng tư</a>
          <a href="#community"><span>02</span> Tiêu chuẩn cộng đồng</a>
          <a href="#terms"><span>03</span> Điều khoản sử dụng</a>
          <a href="#support"><span>04</span> Tự bảo vệ mình</a>
        </nav>

        <section id="privacy" className="trust-content-section" aria-labelledby="privacy-title">
          <div className="trust-section-number" aria-hidden="true">01</div>
          <div className="trust-section-body">
            <p className="trust-section-kicker"><TrustIcon name="lock" /> Chính sách quyền riêng tư</p>
            <h2 id="privacy-title">Chỉ dùng dữ liệu cần cho một kết nối có mục đích.</h2>
            <p className="trust-section-lead">
              Coco dùng Supabase để xác thực, lưu hồ sơ và đồng bộ dữ liệu. Quyền truy cập được giới hạn
              theo tài khoản và trạng thái kết nối; ứng dụng phía trình duyệt không chứa service role key.
            </p>

            <div className="trust-data-grid">
              {privacyGroups.map((group) => (
                <article className={group.tone} key={group.title}>
                  <span><TrustIcon name={group.tone === 'mint' ? 'lock' : 'check'} /></span>
                  <h3>{group.title}</h3>
                  <p>{group.text}</p>
                </article>
              ))}
            </div>

            <div className="trust-detail-grid">
              <article>
                <h3>Coco dùng dữ liệu để làm gì?</h3>
                <ul>
                  <li>Tạo tài khoản, bảo vệ phiên đăng nhập và khôi phục mật khẩu.</li>
                  <li>Giải thích điểm chung dựa trên mục tiêu, khu vực rộng và cách cộng tác.</li>
                  <li>Vận hành lời mời, tin nhắn, thông báo, Coco Plan và công cụ an toàn.</li>
                </ul>
              </article>
              <article>
                <h3>Quyền của cậu</h3>
                <ul>
                  <li>Xem và chỉnh sửa hồ sơ của chính mình.</li>
                  <li>Tạm dừng kết nối mới mà vẫn giữ hội thoại hiện có.</li>
                  <li>Xoá vĩnh viễn tài khoản và dữ liệu gắn với tài khoản từ trang Hồ sơ.</li>
                </ul>
              </article>
            </div>

            <div className="trust-callout">
              <TrustIcon name="shield" />
              <div>
                <strong>Không coi tín hiệu email là xác minh danh tính.</strong>
                <p>Email đã xác nhận chỉ cho biết người dùng kiểm soát hộp thư đó. Cậu vẫn cần tự kiểm tra thông tin trước khi gặp hoặc giao dịch ngoài đời.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="community" className="trust-content-section" aria-labelledby="community-title">
          <div className="trust-section-number" aria-hidden="true">02</div>
          <div className="trust-section-body">
            <p className="trust-section-kicker"><TrustIcon name="people" /> Tiêu chuẩn cộng đồng</p>
            <h2 id="community-title">Tôn trọng mục tiêu, thời gian và ranh giới của nhau.</h2>
            <p className="trust-section-lead">
              Coco được thiết kế cho kết nối học tập và đời sống sinh viên. Mỗi thành viên chịu trách nhiệm
              về nội dung mình gửi và cách mình hành xử trong lẫn ngoài ứng dụng.
            </p>

            <ol className="trust-rule-list">
              {communityRules.map((rule, index) => (
                <li key={rule.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><h3>{rule.title}</h3><p>{rule.text}</p></div>
                </li>
              ))}
            </ol>

            <div className="trust-warning-card">
              <strong>Không được dùng Coco để</strong>
              <p>Mạo danh, lừa đảo, xin dữ liệu nhạy cảm, phát tán nội dung thù ghét, quấy rối, đe doạ hoặc tổ chức hoạt động trái pháp luật.</p>
            </div>
          </div>
        </section>

        <section id="terms" className="trust-content-section" aria-labelledby="terms-title">
          <div className="trust-section-number" aria-hidden="true">03</div>
          <div className="trust-section-body">
            <p className="trust-section-kicker"><TrustIcon name="document" /> Điều khoản sử dụng</p>
            <h2 id="terms-title">Một dịch vụ hỗ trợ kết nối, không phải lời bảo đảm.</h2>
            <div className="trust-terms-grid">
              <article>
                <span>01</span>
                <h3>Tài khoản chính xác</h3>
                <p>Dùng thông tin của chính cậu, giữ thông tin đăng nhập an toàn và không truy cập tài khoản của người khác.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Nội dung có trách nhiệm</h3>
                <p>Không đăng nội dung vi phạm quyền riêng tư, bản quyền hoặc gây hại. Cậu chịu trách nhiệm về nội dung mình gửi.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Không bảo đảm kết quả</h3>
                <p>Điểm phù hợp chỉ giải thích tín hiệu chung, không bảo đảm danh tính, năng lực, hành vi hay độ an toàn của một người.</p>
              </article>
              <article>
                <span>04</span>
                <h3>Giới hạn bản demo</h3>
                <p>CocoApp hiện là sản phẩm học phần, có thể thay đổi hoặc gián đoạn và không thay thế dịch vụ khẩn cấp hay tư vấn chuyên môn.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="support" className="trust-support" aria-labelledby="support-title">
          <div>
            <p className="trust-section-kicker">Tự bảo vệ mình</p>
            <h2 id="support-title">Nếu một kết nối khiến cậu không an tâm.</h2>
            <p>Ngừng chia sẻ thông tin, lưu bằng chứng cần thiết, chặn hoặc báo cáo trong Coco và liên hệ người tin cậy. Nếu có nguy hiểm tức thời, hãy tìm trợ giúp từ cơ quan chức năng tại nơi cậu đang ở.</p>
          </div>
          <div className="trust-support-actions">
            {isAuthenticated ? (
              <Link className="trust-primary-action" to="/safety">Mở Trung tâm an toàn <span aria-hidden="true">→</span></Link>
            ) : (
              <Link className="trust-primary-action" to="/register">Tạo hồ sơ Coco <span aria-hidden="true">→</span></Link>
            )}
            <Link className="trust-secondary-action" to="/">Về trang giới thiệu</Link>
          </div>
        </section>
      </main>

      <footer className="trust-footer">
        <Link to="/">Coco.</Link>
        <p>© 2026 Coco App · Bản demo học phần.</p>
        <a href="#trust-main">Về đầu trang</a>
      </footer>
    </div>
  )
}
