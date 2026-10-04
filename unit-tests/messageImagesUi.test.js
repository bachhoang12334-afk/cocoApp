import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const matchesSource = await readFile(
  new URL('../src/pages/Matches.jsx', import.meta.url),
  'utf8'
)
const privateImageSource = await readFile(
  new URL('../src/components/PrivateMessageImage.jsx', import.meta.url),
  'utf8'
)
const imageRulesSource = await readFile(
  new URL('../src/lib/messageImages.js', import.meta.url),
  'utf8'
)

test('message composer exposes an accessible image picker, preview, and removal action', () => {
  assert.match(matchesSource, /type="file"/)
  assert.match(matchesSource, /accept=\{MESSAGE_IMAGE_ACCEPT\}/)
  assert.match(matchesSource, /aria-label=\{selectedImage/)
  assert.match(matchesSource, /className=\{`view-student-button chat-image-picker/)
  assert.match(matchesSource, /alt="Xem trước ảnh sẽ gửi"/)
  assert.match(matchesSource, />\s*Bỏ ảnh\s*</)
})

test('message images are normalized before upload and fetched with signed URLs only', () => {
  assert.match(imageRulesSource, /canvas\.toBlob/)
  assert.match(imageRulesSource, /'image\/webp'/)
  assert.match(matchesSource, /prepareMessageImage\(file\)/)
  assert.match(privateImageSource, /createSignedUrl/)
  assert.doesNotMatch(`${matchesSource}\n${privateImageSource}`, /getPublicUrl/)
})
