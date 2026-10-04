import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMessageImagePath,
  buildMessageInsert,
  calculateMessageImageDimensions,
  getMessageImageValidationError,
  MESSAGE_IMAGE_MAX_SOURCE_BYTES,
} from '../src/lib/messageImages.js'

test('accepts supported images and rejects unsafe upload inputs', () => {
  assert.equal(getMessageImageValidationError({ type: 'image/jpeg', size: 1024 }), '')
  assert.equal(getMessageImageValidationError({ type: 'image/png', size: 1024 }), '')
  assert.equal(getMessageImageValidationError({ type: 'image/webp', size: 1024 }), '')
  assert.match(getMessageImageValidationError({ type: 'image/svg+xml', size: 1024 }), /JPG, PNG hoặc WebP/)
  assert.match(
    getMessageImageValidationError({ type: 'image/jpeg', size: MESSAGE_IMAGE_MAX_SOURCE_BYTES + 1 }),
    /12 MB/
  )
})

test('scales large images down without stretching small images', () => {
  assert.deepEqual(calculateMessageImageDimensions(3200, 1800), {
    width: 1600,
    height: 900,
  })
  assert.deepEqual(calculateMessageImageDimensions(640, 480), {
    width: 640,
    height: 480,
  })
  assert.throws(() => calculateMessageImageDimensions(0, 480), /dimensions_invalid/)
})

test('builds a participant-scoped WebP storage path', () => {
  assert.equal(
    buildMessageImagePath('connection-id', 'sender-id', 'object-id'),
    'connection-id/sender-id/object-id.webp'
  )
})

test('builds text-only, image-only, and captioned message rows', () => {
  const base = {
    id: 'message-id',
    connectionRequestId: 'connection-id',
    senderId: 'sender-id',
  }

  assert.deepEqual(buildMessageInsert({ ...base, text: '  Xin chào  ' }), {
    id: 'message-id',
    connection_request_id: 'connection-id',
    sender_id: 'sender-id',
    body: 'Xin chào',
    image_path: null,
    image_mime_type: null,
    image_size_bytes: null,
  })

  assert.deepEqual(buildMessageInsert({
    ...base,
    text: '',
    image: { path: 'connection-id/sender-id/object.webp', mimeType: 'image/webp', size: 2048 },
  }), {
    id: 'message-id',
    connection_request_id: 'connection-id',
    sender_id: 'sender-id',
    body: null,
    image_path: 'connection-id/sender-id/object.webp',
    image_mime_type: 'image/webp',
    image_size_bytes: 2048,
  })
})
