export const MESSAGE_IMAGE_BUCKET = 'message-images'
export const MESSAGE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const MESSAGE_IMAGE_MAX_SOURCE_BYTES = 12 * 1024 * 1024
export const MESSAGE_IMAGE_MAX_STORED_BYTES = 5 * 1024 * 1024
export const MESSAGE_IMAGE_MAX_DIMENSION = 1600

const acceptedTypes = new Set(MESSAGE_IMAGE_ACCEPT.split(','))

export function getMessageImageValidationError(file) {
  if (!file) return 'Hãy chọn một ảnh để gửi.'
  if (!acceptedTypes.has(file.type)) {
    return 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.'
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return 'Ảnh này đang trống hoặc không đọc được.'
  }
  if (file.size > MESSAGE_IMAGE_MAX_SOURCE_BYTES) {
    return 'Ảnh gốc cần nhỏ hơn 12 MB.'
  }

  return ''
}

export function calculateMessageImageDimensions(width, height, maxDimension = MESSAGE_IMAGE_MAX_DIMENSION) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('message_image_dimensions_invalid')
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function buildMessageImagePath(connectionRequestId, senderId, objectId = crypto.randomUUID()) {
  if (!connectionRequestId || !senderId || !objectId) {
    throw new Error('message_image_path_missing')
  }

  return `${connectionRequestId}/${senderId}/${objectId}.webp`
}

export function buildMessageInsert({ id, connectionRequestId, senderId, text, image = null }) {
  const body = text?.trim() || null

  return {
    id,
    connection_request_id: connectionRequestId,
    sender_id: senderId,
    body,
    image_path: image?.path || null,
    image_mime_type: image?.mimeType || null,
    image_size_bytes: image?.size || null,
  }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('message_image_encode_failed'))
      }
    }, 'image/webp', quality)
  })
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  image.src = objectUrl

  try {
    await image.decode()
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function prepareMessageImage(file) {
  const validationError = getMessageImageValidationError(file)
  if (validationError) throw new Error(validationError)

  let loadedImage

  try {
    loadedImage = await loadImageSource(file)
    const maxDimensions = [1600, 1280, 1024]
    const qualities = [0.86, 0.72, 0.58]

    for (const maxDimension of maxDimensions) {
      const dimensions = calculateMessageImageDimensions(
        loadedImage.width,
        loadedImage.height,
        maxDimension
      )
      const canvas = document.createElement('canvas')
      canvas.width = dimensions.width
      canvas.height = dimensions.height

      const context = canvas.getContext('2d')
      if (!context) throw new Error('message_image_canvas_unavailable')

      context.drawImage(loadedImage.source, 0, 0, dimensions.width, dimensions.height)

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, quality)
        if (blob.size <= MESSAGE_IMAGE_MAX_STORED_BYTES) {
          return {
            blob,
            width: dimensions.width,
            height: dimensions.height,
            originalName: file.name || 'ảnh đã chọn',
          }
        }
      }
    }

    throw new Error('Ảnh vẫn lớn hơn 5 MB sau khi nén. Hãy chọn ảnh khác.')
  } catch (error) {
    if (error?.message?.startsWith('Ảnh')) throw error
    throw new Error(
      'Không xử lý được ảnh này. Hãy thử ảnh JPG, PNG hoặc WebP khác.',
      { cause: error }
    )
  } finally {
    loadedImage?.dispose()
  }
}
