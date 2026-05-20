import { useEffect, useMemo, useRef, useState } from 'react'

import { BOOKS } from '@/assets/wxbooks/books'
import './ReadingNotesCollection.css'

type Route =
  | { view: 'gallery'; bookId?: undefined }
  | { view: 'detail'; bookId: string }

type LibraryNote = {
  readonly u: number
  readonly t: string
  readonly r: string
  readonly c: number
}

type LibraryBook = {
  readonly bookId: string
  readonly title: string
  readonly author: string
  readonly cover: string
  readonly category: string
  readonly readDate?: string
  readonly rating: string
  readonly noteCount: number
  readonly publisher?: string
  readonly intro?: string
  readonly isbn?: string
  readonly publishTime?: string
  readonly ratingCount?: number
  readonly ratingDetail?: {
    readonly title?: string
  }
  readonly notes?: readonly LibraryNote[]
}

const LIBRARY = BOOKS as readonly LibraryBook[]

const COLLAGE_STYLES = [
  { height: 104, rotate: -7 },
  { height: 152, rotate: 6 },
  { height: 126, rotate: -4 },
  { height: 168, rotate: 8 },
  { height: 114, rotate: -10 },
  { height: 144, rotate: 4 },
  { height: 138, rotate: -3 },
  { height: 160, rotate: 7 },
  { height: 118, rotate: -5 },
  { height: 150, rotate: 3 },
  { height: 132, rotate: -8 },
  { height: 172, rotate: 5 },
] as const

function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const reveals = root.querySelectorAll<HTMLElement>('.reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )

    reveals.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return ref
}

function formatDate(timestamp?: number) {
  return timestamp ? new Date(timestamp * 1000).toLocaleDateString('zh-CN') : ''
}

function getHashRoute(): Route {
  const hash = window.location.hash || '#gallery'
  if (hash.startsWith('#book-')) {
    return { view: 'detail', bookId: hash.replace('#book-', '') }
  }
  return { view: 'gallery' }
}

function getReadingSpan() {
  const years = new Set<number>()
  LIBRARY.forEach((book) => {
    if (book.readDate) years.add(Number(book.readDate.split('-')[0]))
  })
  return years.size > 0 ? Math.max(...years) - Math.min(...years) + 1 : 0
}

function Ornament() {
  return <div className="ornament">· · ·</div>
}

function GalleryHero({ totalNotes, totalDays }: { totalNotes: number; totalDays: number }) {
  const ref = useReveal()
  const collageBooks = LIBRARY.slice(0, 18)

  return (
    <section className="gallery-hero" ref={ref}>
      <div className="gallery-hero-bg" />
      <div className="gallery-hero-grain" />
      <div className="covers-collage" aria-hidden="true">
        {collageBooks.map((book, index) => {
          const style = COLLAGE_STYLES[index % COLLAGE_STYLES.length]
          return (
            <img
              key={book.bookId}
              src={book.cover}
              alt=""
              loading="lazy"
              style={{
                height: `${style.height}px`,
                transform: `rotate(${style.rotate}deg)`,
              }}
            />
          )
        })}
      </div>
      <div className="gallery-hero-content">
        <div className="gallery-hero-subtitle reveal">微信读书 · 阅读笔记</div>
        <h1 className="gallery-hero-title serif reveal">读书笔记合集</h1>
        <div className="gallery-hero-desc reveal">{LIBRARY.length} 册书 · 横跨考古、历史、艺术与文学</div>
        <div className="gallery-stats reveal">
          <div className="stat">
            <span className="gallery-stat-num">{LIBRARY.length}</span>
            <span className="gallery-stat-label">本书</span>
          </div>
          <div className="stat">
            <span className="gallery-stat-num">{totalNotes}</span>
            <span className="gallery-stat-label">条笔记</span>
          </div>
          <div className="stat">
            <span className="gallery-stat-num">{totalDays}</span>
            <span className="gallery-stat-label">年阅读</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function BookCard({ book, onClick }: { book: LibraryBook; onClick: () => void }) {
  const noteMeta =
    book.noteCount > 0 ? (
      <span className="note-count has-notes">📝 {book.noteCount} 条笔记</span>
    ) : (
      <span className="note-count zero">暂无笔记</span>
    )

  return (
    <button type="button" className="book-card reveal" onClick={onClick}>
      <div className="book-card-cover">
        <img src={book.cover} alt={book.title} loading="lazy" />
        <span className="rating-badge">{book.rating}</span>
      </div>
      <div className="book-card-body">
        <div className="book-card-title serif">{book.title}</div>
        <div className="book-card-author">{book.author}</div>
        <div className="book-card-meta">
          <span className="category-tag">{book.category.split('-').pop()}</span>
          {noteMeta}
        </div>
      </div>
    </button>
  )
}

function BooksGrid({ onBookClick }: { onBookClick: (bookId: string) => void }) {
  const ref = useReveal()

  return (
    <section className="gallery-section" ref={ref}>
      <div className="gallery-header reveal">
        <span className="gallery-tag">BOOKSHELF</span>
        <h2 className="gallery-title serif">我的书架</h2>
        <p className="gallery-sub">点击任一书籍查看详情与笔记</p>
      </div>
      <div className="books-grid">
        {LIBRARY.map((book) => (
          <BookCard key={book.bookId} book={book} onClick={() => onBookClick(book.bookId)} />
        ))}
      </div>
    </section>
  )
}

function ChapterFilter({
  notes,
  activeChapter,
  onFilter,
}: {
  notes: readonly LibraryNote[]
  activeChapter: string
  onFilter: (chapter: string) => void
}) {
  const chapters = useMemo(() => {
    const set = new Set<string>()
    notes.forEach((note) => set.add(String(note.u || 'unknown')))
    return [...set].sort((a, b) => Number(a) - Number(b))
  }, [notes])

  if (chapters.length === 0) return null

  return (
    <div className="chapters-nav reveal">
      <button
        type="button"
        className={`chapter-pill ${activeChapter === 'all' ? 'active' : ''}`}
        onClick={() => onFilter('all')}
      >
        全部
      </button>
      {chapters.map((chapter) => (
        <button
          key={chapter}
          type="button"
          className={`chapter-pill ${activeChapter === chapter ? 'active' : ''}`}
          onClick={() => onFilter(chapter)}
        >
          第{chapter}章
        </button>
      ))}
    </div>
  )
}

function NoteCard({ note, bookId }: { note: LibraryNote; bookId: string }) {
  const deepLink = `weread://bestbookmark?bookId=${bookId}&chapterUid=${note.u}&range=${note.r}`

  return (
    <div className="note-card reveal" data-chapter={String(note.u || 'unknown')}>
      <div className="note-chapter">第{note.u || '?'}章</div>
      <div className="note-text">{note.t}</div>
      <div className="note-actions">
        <a className="note-link" href={deepLink}>
          在微信读书中打开 →
        </a>
        <span className="note-date">{formatDate(note.c)}</span>
      </div>
    </div>
  )
}

function DetailView({ bookId, onBack }: { bookId: string; onBack: () => void }) {
  const [filterChapter, setFilterChapter] = useState('all')
  const ref = useReveal()
  const book = LIBRARY.find((item) => item.bookId === bookId)

  useEffect(() => {
    window.scrollTo(0, 0)
    setFilterChapter('all')
  }, [bookId])

  if (!book) {
    return <div className="section">书籍未找到</div>
  }

  const notes = book.notes ?? []
  const filteredNotes =
    filterChapter === 'all'
      ? notes
      : notes.filter((note) => String(note.u || 'unknown') === filterChapter)
  const ratingVal = Number.parseFloat(book.rating).toFixed(1)
  const ratingCount = book.ratingCount || 0
  const ratingTitle = book.ratingDetail?.title || ''
  const pubTime = book.publishTime ? book.publishTime.split(' ')[0] : ''

  return (
    <div ref={ref}>
      <a
        className="back-btn visible"
        href="#gallery"
        onClick={(event) => {
          event.preventDefault()
          onBack()
        }}
      >
        ← 返回书架
      </a>

      <section className="detail-hero">
        <div className="detail-hero-bg" />
        <div className="detail-hero-grain" />
        <div className="detail-hero-content">
          <div className="cover-wrap">
            <div className="cover-glow" />
            <img className="cover-img" src={book.cover} alt={book.title} />
          </div>
          <div className="detail-hero-text">
            <div className="detail-hero-subtitle">微信读书 · 阅读笔记</div>
            <h1 className="detail-hero-title">{book.title}</h1>
            <div className="detail-hero-author">
              {book.author}
              <span>{` / ${book.publisher || ''}${pubTime ? ` / ${pubTime}` : ''}`}</span>
            </div>
            {book.intro ? <div className="detail-hero-desc">{book.intro}</div> : null}
            <div className="detail-hero-stats">
              <div className="stat">
                <span className="stat-num">{ratingVal}</span>
                <span className="stat-label">评分</span>
              </div>
              <div className="stat">
                <span className="stat-num">{book.noteCount}</span>
                <span className="stat-label">条笔记</span>
              </div>
              <div className="stat">
                <span className="stat-num">{ratingCount}</span>
                <span className="stat-label">人评价</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Ornament />

      <section className="section">
        <div className="section-header reveal">
          <span className="section-tag">BOOK INFO</span>
          <h2 className="section-title serif">书籍信息</h2>
          <p className="section-sub">基本信息 · 评分 · 内容概要</p>
        </div>
        <div className="info-grid reveal">
          <div className="info-card">
            <div className="info-label">书名</div>
            <div className="info-value serif" style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
              {book.title}
            </div>
            <div className="info-label" style={{ marginTop: '16px' }}>作者</div>
            <div className="info-value">{book.author}</div>
            {book.publisher ? (
              <>
                <div className="info-label" style={{ marginTop: '16px' }}>出版社</div>
                <div className="info-value">{book.publisher}</div>
              </>
            ) : null}
            {pubTime ? (
              <>
                <div className="info-label" style={{ marginTop: '16px' }}>出版时间</div>
                <div className="info-value">{pubTime}</div>
              </>
            ) : null}
            {book.isbn ? (
              <>
                <div className="info-label" style={{ marginTop: '16px' }}>ISBN</div>
                <div className="info-value">{book.isbn}</div>
              </>
            ) : null}
          </div>
          <div className="info-card">
            <div className="info-label">评分</div>
            <div className="info-value" style={{ marginBottom: '16px' }}>
              <span className="rating-big">{ratingVal}</span>
              <span className="rating-max"> / 10</span>
              <div className="rating-count">{ratingCount} 人评价</div>
              {ratingTitle ? <div className="rating-title">{ratingTitle}</div> : null}
            </div>
            <div className="info-label">分类</div>
            <div className="info-value">{book.category}</div>
            <div className="info-label" style={{ marginTop: '16px' }}>阅读日期</div>
            <div className="info-value">{book.readDate || '未知'}</div>
          </div>
        </div>
      </section>

      <Ornament />

      <section className="section notes-section">
        <div className="section-header reveal">
          <span className="section-tag">HIGHLIGHTS</span>
          <h2 className="section-title serif">读书笔记</h2>
          <p className="section-sub">{book.noteCount > 0 ? `${book.noteCount} 条划线笔记` : '暂无笔记'}</p>
        </div>
        {book.noteCount === 0 ? (
          <div className="no-notes reveal">
            <div className="no-notes-icon">📖</div>
            <div className="no-notes-text serif">暂无笔记</div>
            <div className="no-notes-sub">阅读时未留下划线笔记</div>
          </div>
        ) : (
          <>
            <ChapterFilter notes={notes} activeChapter={filterChapter} onFilter={setFilterChapter} />
            {filteredNotes.map((note, index) => (
              <NoteCard key={`${note.u}-${index}`} note={note} bookId={bookId} />
            ))}
          </>
        )}
      </section>

      <Ornament />

      <footer className="footer">
        <p>
          📖 {book.title} &nbsp;·&nbsp; {book.author}
        </p>
        <p style={{ marginTop: '8px', opacity: 0.6 }}>
          由微信读书笔记自动生成 &nbsp;·&nbsp;{' '}
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(getHashRoute)
  const stats = useMemo(() => {
    const totalNotes = LIBRARY.reduce((sum, book) => sum + book.noteCount, 0)
    return { totalNotes, totalDays: getReadingSpan() }
  }, [])

  useEffect(() => {
    const onHashChange = () => setRoute(getHashRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleBookClick = (bookId: string) => {
    window.location.hash = `#book-${bookId}`
  }

  const handleBack = () => {
    window.location.hash = '#gallery'
  }

  if (route.view === 'detail') {
    return (
      <div className="app-shell">
        <DetailView bookId={route.bookId} onBack={handleBack} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <GalleryHero totalNotes={stats.totalNotes} totalDays={stats.totalDays} />
      <BooksGrid onBookClick={handleBookClick} />
      <footer className="footer">
        <p>📖 读书笔记合集 &nbsp;·&nbsp; 微信读书阅读记录</p>
        <p style={{ marginTop: '8px', opacity: 0.6 }}>
          由微信读书笔记自动生成 &nbsp;·&nbsp;{' '}
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </footer>
    </div>
  )
}
