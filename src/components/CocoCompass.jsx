import { Link } from 'react-router-dom'
import { Icon } from './AppLayout'

function getJourneyState({ completion, emailConfirmed, accepted, pending }) {
  const steps = [
    {
      id: 'profile',
      icon: 'profile',
      title: 'Hồ sơ đủ rõ',
      detail: `${completion}% thông tin đã hoàn thiện`,
      done: completion >= 70,
      to: '/profile',
    },
    {
      id: 'trust',
      icon: 'safety',
      title: 'Danh tính đáng tin',
      detail: emailConfirmed ? 'Email tài khoản đã xác nhận' : 'Xác nhận email để tăng độ tin cậy',
      done: emailConfirmed,
      to: '/profile',
    },
    {
      id: 'connection',
      icon: 'connection',
      title: 'Kết nối đầu tiên',
      detail: accepted > 0 ? `${accepted} kết nối đã chấp nhận` : 'Bắt đầu từ một mục tiêu thật cụ thể',
      done: accepted > 0,
      to: accepted > 0 ? '/matches' : '/discover',
    },
  ]

  if (completion < 70) {
    return {
      steps,
      title: 'Làm hồ sơ đủ rõ để người phù hợp hiểu cậu nhanh hơn.',
      description: 'Ưu tiên mục tiêu, kỹ năng và khu vực. Một hồ sơ rõ ràng giúp lời mời kết nối có lý do hơn.',
      action: 'Hoàn thiện hồ sơ',
      to: '/profile',
    }
  }

  if (!emailConfirmed) {
    return {
      steps,
      title: 'Thêm một tín hiệu tin cậy trước khi bắt đầu kết nối.',
      description: 'Email đã xác nhận giúp cộng đồng biết tài khoản này có một danh tính đăng nhập hợp lệ.',
      action: 'Xem trạng thái tin cậy',
      to: '/profile',
    }
  }

  if (accepted === 0) {
    return {
      steps,
      title: 'Chọn một mục tiêu, rồi tìm người phù hợp nhất với nó.',
      description: 'Đừng bắt đầu bằng việc lướt vô định. Hãy chọn học nhóm, team project hoặc ghép trọ trước.',
      action: 'Khám phá có mục tiêu',
      to: '/discover',
    }
  }

  if (pending > 0) {
    return {
      steps,
      title: `Cậu đang có ${pending} lời mời cần được xem lại.`,
      description: 'Phản hồi sớm để cả hai bên biết có nên bắt đầu một cuộc trò chuyện hay không.',
      action: 'Xem lời mời',
      to: '/matches',
    }
  }

  return {
    steps,
    title: 'Biến một kết nối thành kế hoạch cụ thể cho tuần này.',
    description: 'Mở cuộc trò chuyện gần nhất và thống nhất việc đầu tiên: lịch học, vai trò dự án hoặc buổi xem trọ.',
    action: 'Tiếp tục trò chuyện',
    to: '/matches',
  }
}

export default function CocoCompass({ completion, emailConfirmed, accepted, pending }) {
  const journey = getJourneyState({ completion, emailConfirmed, accepted, pending })
  const completedSteps = journey.steps.filter((step) => step.done).length
  const activeStep = journey.steps.find((step) => !step.done)?.id

  return (
    <section className="coco-compass" aria-labelledby="coco-compass-title">
      <div className="coco-compass-intro">
        <div className="coco-compass-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <p className="coco-compass-kicker">
          <Icon name="spark" /> Coco Compass
        </p>
        <h2 id="coco-compass-title">{journey.title}</h2>
        <p>{journey.description}</p>

        <Link className="coco-compass-cta" to={journey.to}>
          {journey.action}
          <Icon name="arrow" />
        </Link>

        <div className="coco-compass-progress">
          <span>{completedSteps}/3 nền tảng đã sẵn sàng</span>
          <div
            role="progressbar"
            aria-label="Tiến độ sẵn sàng để kết nối"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={completedSteps}
          >
            <span style={{ width: `${(completedSteps / 3) * 100}%` }} />
          </div>
        </div>
      </div>

      <ol className="coco-journey-list" aria-label="Các bước bắt đầu với Coco">
        {journey.steps.map((step, index) => {
          const isActive = step.id === activeStep

          return (
            <li
              key={step.id}
              className={step.done ? 'is-complete' : isActive ? 'is-active' : ''}
            >
              <Link to={step.to} aria-current={isActive ? 'step' : undefined}>
                <span className="coco-journey-index" aria-hidden="true">
                  {step.done ? <Icon name="safety" /> : index + 1}
                </span>
                <span className="coco-journey-copy">
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </span>
                <span className="coco-journey-state">
                  {step.done ? 'Đã xong' : isActive ? 'Tiếp theo' : 'Sau đó'}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
