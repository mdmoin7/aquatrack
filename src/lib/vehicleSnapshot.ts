const MAX_INPUT_BYTES = 5 * 1024 * 1024
/** Target binary size — keeps embedded data URL well under Firestore's 1 MB doc limit. */
export const MAX_EMBEDDED_SNAPSHOT_BYTES = 350 * 1024

const COMPRESSION_STEPS = [
  { maxDimension: 960, quality: 0.78 },
  { maxDimension: 720, quality: 0.68 },
  { maxDimension: 560, quality: 0.58 },
] as const

export function validateVehicleSnapshotFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (JPEG, PNG, or WebP).')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image must be 5 MB or smaller.')
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the selected image.'))
    }
    image.src = url
  })
}

async function renderSnapshot(
  image: HTMLImageElement,
  maxDimension: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not process the image.')

  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })

  if (!blob) throw new Error('Could not compress the image.')
  return blob
}

/** Resize and compress for embedding directly in Firestore (no Storage needed). */
export async function compressVehicleSnapshot(file: File): Promise<Blob> {
  validateVehicleSnapshotFile(file)
  const image = await loadImage(file)

  let smallest: Blob | null = null
  for (const step of COMPRESSION_STEPS) {
    const blob = await renderSnapshot(image, step.maxDimension, step.quality)
    if (!smallest || blob.size < smallest.size) smallest = blob
    if (blob.size <= MAX_EMBEDDED_SNAPSHOT_BYTES) return blob
  }

  if (!smallest) throw new Error('Could not compress the image.')

  if (smallest.size > MAX_EMBEDDED_SNAPSHOT_BYTES) {
    throw new Error(
      `Photo is still too large after compression (${Math.ceil(smallest.size / 1024)} KB). ` +
        'Try a closer crop of the vehicle or a lower-resolution photo.',
    )
  }

  return smallest
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not encode the image.'))
    reader.readAsDataURL(blob)
  })
}

/** Compress and return a data URL stored on the delivery document. */
export async function embedVehicleSnapshot(file: File): Promise<string> {
  const blob = await compressVehicleSnapshot(file)
  return blobToDataUrl(blob)
}
