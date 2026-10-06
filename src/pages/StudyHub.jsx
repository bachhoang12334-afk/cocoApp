import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { supabase } from '../lib/supabaseClient'
import '../StudyHub.css'

const SAMPLE_POSTS = [
  {
    id: 'dsa-study',
    authorName: 'Minh Anh',
    university: 'ICTU',
    title: 'Ôn Graph & Dijkstra trước kiểm tra DSA',
    subject: 'Cấu trúc dữ liệu & giải thuật',
    description: 'Tìm 2–3 bạn học buổi tối, ưu tiên cùng giải bài rồi giải thích lại cho nhau.',
    membersNeeded: 3,
    status: 'open',
    createdAt: '2026-10-05T13:00:00.000Z',
  },
  {
    id: 'toeic-team',
    authorName: 'Khánh Linh',
    university: 'ICTU',
    title: 'Nhóm luyện TOEIC 650+',
    subject: 'Tiếng Anh',
    description: 'Mỗi ngày 45 phút Part 5 + đọc thành tiếng, cuối tuần làm mini test.',
    membersNeeded: 4,
    status: 'open',
    createdAt: '2026-10-04T10:30:00.000Z',
  },
  {
    id: 'react-project',
    authorName: 'Tuấn',
    university: 'ICTU',
    title: 'Cần frontend cho mini project React',
    subject: 'Web Development',
    description: 'Nhóm đã có ý tưởng và backend cơ bản, cần bạn thích UI/UX và React.',
    membersNeeded: 2,
    status: 'open',
    createdAt: '2026-10-03T08:00:00.000Z',
  },
]

const SAMPLE_MATERIALS = [
  { id: 'm1', title: 'Checklist ôn Graph', subject: 'DSA', type: 'Checklist', description: 'DFS, BFS, ma trận kề, Dijkstra và lỗi thường gặp.', resourceUrl: '' },
  { id: 'm2', title: 'NumPy quick reference', subject: 'AI / Python', type: 'Cheat sheet', description: 'Array, shape, indexing, broadcasting và các phép thống kê cơ bản.', resourceUrl: '' },
  { id: 'm3', title: 'Mẫu user story', subject: 'System Design', type: 'Template', description: 'Cấu trúc As a / I want / So that và acceptance criteria.', resourceUrl: '' },
]

function readLocal(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null')
    return Array.isArray(value) ? value : fallback
  } catch {
    return fallback
  }
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Gần đây'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date)
}

export default function StudyHub() {
  const [tab, setTab] = useState('groups')
  const [query, setQuery] = useState('')
  const [posts, setPosts] = useState(SAMPLE_POSTS)
  const [materials, setMaterials] = useState(SAMPLE_MATERIALS)
  const [dataMode, setDataMode] = useState('loading')
  const [note, setNote] = useState('Đang đồng bộ Study Hub…')
  const [user, setUser] = useState(null)
  const [postFormOpen, setPostFormOpen] = useState(false)
  const [materialFormOpen, setMaterialFormOpen] = useState(false)
  const [postForm, setPostForm] = useState({ title: '', subject: '', description: '', membersNeeded: 3 })
  const [materialForm, setMaterialForm] = useState({ title: '', subject: '', type: 'Tài liệu', description: '', resourceUrl: '' })
  const [feedback, setFeedback] = useState('')

  const loadHub = useCallback(async () => {
    try {
      const account = await getCurrentAccount()
      if (!account) throw new Error('missing-session')
      setUser(account)

      const [postResult, materialResult] = await Promise.all([
        supabase
          .from('study_posts')
          .select('id, author_id, author_name, university, title, subject, description, members_needed, status, created_at')
          .eq('status', 'open')
          .order('created_at', { ascending: false }),
        supabase
          .from('study_materials')
          .select('id, owner_id, owner_name, title, subject, material_type, description, resource_url, created_at')
          .order('created_at', { ascending: false }),
      ])

      if (postResult.error) throw postResult.error
      if (materialResult.error) throw materialResult.error

      setPosts(postResult.data?.length
        ? postResult.data.map((row) => ({
            id: row.id,
            authorName: row.author_name,
            university: row.university,
            title: row.title,
            subject: row.subject,
            description: row.description,
            membersNeeded: row.members_needed,
            status: row.status,
            createdAt: row.created_at,
          }))
        : SAMPLE_POSTS)
      setMaterials(materialResult.data?.length
        ? materialResult.data.map((row) => ({
            id: row.id,
            title: row.title,
            subject: row.subject,
            type: row.material_type,
            description: row.description,
            resourceUrl: row.resource_url || '',
            createdAt: row.created_at,
          }))
        : SAMPLE_MATERIALS)
      setDataMode('supabase')
      setNote('Study Hub đã kết nối Supabase. Nếu chưa có dữ liệu, Coco giữ nội dung mẫu để demo.')
    } catch {
      setPosts(readLocal('cocoapp:study-posts', SAMPLE_POSTS))
      setMaterials(readLocal('cocoapp:study-materials', SAMPLE_MATERIALS))
      setDataMode('preview')
      setNote('Đang dùng dữ liệu dự phòng; tạo bài và tài liệu vẫn hoạt động trên thiết bị này.')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHub()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadHub])

  const visiblePosts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi')
    if (!needle) return posts
    return posts.filter((post) =>
      [post.title, post.subject, post.description, post.authorName]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(needle)
    )
  }, [posts, query])

  const visibleMaterials = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi')
    if (!needle) return materials
    return materials.filter((material) =>
      [material.title, material.subject, material.type, material.description]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(needle)
    )
  }, [materials, query])

  async function createPost(event) {
    event.preventDefault()
    if (!postForm.title.trim() || !postForm.subject.trim()) {
      setFeedback('Hãy nhập tiêu đề và môn/lĩnh vực.')
      return
    }

    const authorName = user?.user_metadata?.fullName || user?.email?.split('@')[0] || 'Sinh viên Coco'
    const newPost = {
      id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
      authorName,
      university: user?.user_metadata?.university || 'Coco Campus',
      title: postForm.title.trim(),
      subject: postForm.subject.trim(),
      description: postForm.description.trim() || 'Muốn tìm bạn cùng học và trao đổi kiến thức.',
      membersNeeded: Number(postForm.membersNeeded) || 1,
      status: 'open',
      createdAt: new Date().toISOString(),
    }

    if (dataMode === 'supabase' && user?.id) {
      const { data, error } = await supabase
        .from('study_posts')
        .insert({
          author_id: user.id,
          author_name: newPost.authorName,
          university: newPost.university,
          title: newPost.title,
          subject: newPost.subject,
          description: newPost.description,
          members_needed: newPost.membersNeeded,
        })
        .select('id, created_at')
        .single()

      if (!error) {
        newPost.id = data.id
        newPost.createdAt = data.created_at
        setPosts((current) => [newPost, ...current.filter((item) => !String(item.id).startsWith('dsa-'))])
        setPostFormOpen(false)
        setPostForm({ title: '', subject: '', description: '', membersNeeded: 3 })
        setFeedback('Đã đăng nhu cầu học tập lên Study Hub.')
        return
      }
    }

    const next = [newPost, ...posts]
    setPosts(next)
    try {
      window.localStorage.setItem('cocoapp:study-posts', JSON.stringify(next))
    } catch {
      // Keep the current state if persistent browser storage is unavailable.
    }
    setPostFormOpen(false)
    setPostForm({ title: '', subject: '', description: '', membersNeeded: 3 })
    setFeedback('Đã lưu bài đăng trên thiết bị. Có thể chuyển sang Supabase sau khi chạy migration.')
  }

  async function createMaterial(event) {
    event.preventDefault()
    if (!materialForm.title.trim() || !materialForm.subject.trim()) {
      setFeedback('Hãy nhập tên tài liệu và môn/lĩnh vực.')
      return
    }

    const newMaterial = {
      id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
      title: materialForm.title.trim(),
      subject: materialForm.subject.trim(),
      type: materialForm.type.trim() || 'Tài liệu',
      description: materialForm.description.trim() || 'Tài nguyên do sinh viên chia sẻ.',
      resourceUrl: materialForm.resourceUrl.trim(),
      createdAt: new Date().toISOString(),
    }

    if (dataMode === 'supabase' && user?.id) {
      const ownerName = user.user_metadata?.fullName || user.email?.split('@')[0] || 'Sinh viên Coco'
      const { data, error } = await supabase
        .from('study_materials')
        .insert({
          owner_id: user.id,
          owner_name: ownerName,
          title: newMaterial.title,
          subject: newMaterial.subject,
          material_type: newMaterial.type,
          description: newMaterial.description,
          resource_url: newMaterial.resourceUrl || null,
        })
        .select('id, created_at')
        .single()

      if (!error) {
        newMaterial.id = data.id
        newMaterial.createdAt = data.created_at
        setMaterials((current) => [newMaterial, ...current.filter((item) => !String(item.id).startsWith('m'))])
        setMaterialFormOpen(false)
        setMaterialForm({ title: '', subject: '', type: 'Tài liệu', description: '', resourceUrl: '' })
        setFeedback('Đã chia sẻ tài liệu lên Study Hub.')
        return
      }
    }

    const next = [newMaterial, ...materials]
    setMaterials(next)
    try {
      window.localStorage.setItem('cocoapp:study-materials', JSON.stringify(next))
    } catch {
      // Keep the current state if persistent browser storage is unavailable.
    }
    setMaterialFormOpen(false)
    setMaterialForm({ title: '', subject: '', type: 'Tài liệu', description: '', resourceUrl: '' })
    setFeedback('Đã lưu tài liệu trên thiết bị.')
  }

  return (
    <AppLayout>
      <main className="studyhub-page">
        <section className="studyhub-hero">
          <div>
            <p className="studyhub-eyebrow">COCO STUDY HUB</p>
            <h1>Không chỉ tìm người — cùng học và cùng làm việc</h1>
            <p>Tạo nhóm học theo môn, tìm đồng đội và chia sẻ tài liệu bằng liên kết có ngữ cảnh.</p>
          </div>
          <div className="studyhub-hero-actions">
            <Link to="/study">Tìm bạn học phù hợp</Link>
            <Link to="/team">Tìm team project</Link>
          </div>
        </section>

        <div className="studyhub-status" role="status">
          <span className={dataMode === 'preview' ? 'is-preview' : 'is-online'} />
          {note}
        </div>

        <section className="studyhub-toolbar">
          <div className="studyhub-tabs" role="tablist" aria-label="Study Hub">
            <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
              Nhóm học <strong>{posts.length}</strong>
            </button>
            <button type="button" className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}>
              Tài liệu <strong>{materials.length}</strong>
            </button>
          </div>

          <label className="studyhub-search">
            <Icon name="discover" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm môn, chủ đề, kỹ năng…" />
          </label>

          <button
            type="button"
            className="studyhub-primary"
            onClick={() => tab === 'groups' ? setPostFormOpen(true) : setMaterialFormOpen(true)}
          >
            + {tab === 'groups' ? 'Tạo bài tìm nhóm' : 'Chia sẻ tài liệu'}
          </button>
        </section>

        {feedback && <p className="studyhub-feedback" role="status">{feedback}</p>}

        {tab === 'groups' ? (
          <section className="studyhub-grid">
            {visiblePosts.map((post) => (
              <article key={post.id} className="studyhub-card">
                <div className="studyhub-card-meta">
                  <span>{post.subject}</span>
                  <small>{formatDate(post.createdAt)}</small>
                </div>
                <h2>{post.title}</h2>
                <p>{post.description}</p>
                <div className="studyhub-author">
                  <span>{post.authorName?.trim()?.[0]?.toUpperCase() || 'C'}</span>
                  <div>
                    <strong>{post.authorName}</strong>
                    <small>{post.university}</small>
                  </div>
                </div>
                <footer>
                  <span>Cần thêm <strong>{post.membersNeeded}</strong> người</span>
                  <Link to="/discover">Tìm thành viên →</Link>
                </footer>
              </article>
            ))}
          </section>
        ) : (
          <section className="studyhub-materials">
            {visibleMaterials.map((material) => (
              <article key={material.id} className="studyhub-material">
                <span className="studyhub-file-icon"><Icon name="study" /></span>
                <div>
                  <small>{material.subject} · {material.type}</small>
                  <h2>{material.title}</h2>
                  <p>{material.description}</p>
                </div>
                {material.resourceUrl ? (
                  <a href={material.resourceUrl} target="_blank" rel="noreferrer">Mở tài liệu</a>
                ) : (
                  <span className="studyhub-no-link">Ghi chú học tập</span>
                )}
              </article>
            ))}
          </section>
        )}

        {tab === 'groups' && visiblePosts.length === 0 && (
          <div className="studyhub-empty">Không có bài nào khớp từ khóa này.</div>
        )}
        {tab === 'materials' && visibleMaterials.length === 0 && (
          <div className="studyhub-empty">Không có tài liệu nào khớp từ khóa này.</div>
        )}

        {postFormOpen && (
          <div className="studyhub-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPostFormOpen(false)}>
            <section className="studyhub-dialog" role="dialog" aria-modal="true" aria-labelledby="new-study-post">
              <header>
                <div>
                  <p className="studyhub-eyebrow">TẠO NHU CẦU HỌC TẬP</p>
                  <h2 id="new-study-post">Tìm đúng người cho đúng môn</h2>
                </div>
                <button type="button" aria-label="Đóng" onClick={() => setPostFormOpen(false)}>×</button>
              </header>
              <form onSubmit={createPost}>
                <label>Tiêu đề<input value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} placeholder="VD: Ôn Dijkstra tối thứ 5" /></label>
                <label>Môn / lĩnh vực<input value={postForm.subject} onChange={(event) => setPostForm({ ...postForm, subject: event.target.value })} placeholder="DSA, TOEIC, React…" /></label>
                <label>Số người cần thêm<input type="number" min="1" max="20" value={postForm.membersNeeded} onChange={(event) => setPostForm({ ...postForm, membersNeeded: event.target.value })} /></label>
                <label className="studyhub-wide">Mô tả<textarea rows="4" value={postForm.description} onChange={(event) => setPostForm({ ...postForm, description: event.target.value })} /></label>
                <div className="studyhub-dialog-actions">
                  <button type="button" className="secondary" onClick={() => setPostFormOpen(false)}>Hủy</button>
                  <button type="submit">Đăng lên Study Hub</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {materialFormOpen && (
          <div className="studyhub-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMaterialFormOpen(false)}>
            <section className="studyhub-dialog" role="dialog" aria-modal="true" aria-labelledby="new-material">
              <header>
                <div>
                  <p className="studyhub-eyebrow">CHIA SẺ TÀI NGUYÊN</p>
                  <h2 id="new-material">Thêm tài liệu có ngữ cảnh</h2>
                </div>
                <button type="button" aria-label="Đóng" onClick={() => setMaterialFormOpen(false)}>×</button>
              </header>
              <form onSubmit={createMaterial}>
                <label>Tên tài liệu<input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} /></label>
                <label>Môn / lĩnh vực<input value={materialForm.subject} onChange={(event) => setMaterialForm({ ...materialForm, subject: event.target.value })} /></label>
                <label>Loại<input value={materialForm.type} onChange={(event) => setMaterialForm({ ...materialForm, type: event.target.value })} placeholder="Slide, checklist, link…" /></label>
                <label>Link (không bắt buộc)<input type="url" value={materialForm.resourceUrl} onChange={(event) => setMaterialForm({ ...materialForm, resourceUrl: event.target.value })} placeholder="https://…" /></label>
                <label className="studyhub-wide">Mô tả<textarea rows="3" value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} /></label>
                <div className="studyhub-dialog-actions">
                  <button type="button" className="secondary" onClick={() => setMaterialFormOpen(false)}>Hủy</button>
                  <button type="submit">Chia sẻ tài liệu</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </AppLayout>
  )
}
