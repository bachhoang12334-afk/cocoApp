import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflow = await readFile(
  new URL('../.github/workflows/quality.yml', import.meta.url),
  'utf8'
)

test('quality workflow uses locked dependencies and the complete project check', () => {
  assert.match(workflow, /permissions:\s+contents: read/)
  assert.match(workflow, /uses: actions\/checkout@v7/)
  assert.match(workflow, /uses: actions\/setup-node@v7/)
  assert.match(workflow, /node-version: 24/)
  assert.match(workflow, /run: npm ci/)
  assert.match(workflow, /run: npm run check/)
})

test('quality workflow avoids duplicate runs on the same branch', () => {
  assert.match(workflow, /concurrency:/)
  assert.match(workflow, /cancel-in-progress: true/)
})
