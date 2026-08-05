import { useEffect, useId, useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { validateVehicleSnapshotFile } from '@/lib/vehicleSnapshot'

interface VehicleSnapshotFieldProps {
  file: File | null
  previewUrl: string | null
  onChange: (file: File | null, previewUrl: string | null) => void
  error?: string
}

export function VehicleSnapshotField({
  file,
  previewUrl,
  onChange,
  error,
}: VehicleSnapshotFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = (selected: File | null) => {
    if (!selected) {
      onChange(null, null)
      return
    }

    try {
      validateVehicleSnapshotFile(selected)
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      onChange(selected, URL.createObjectURL(selected))
    } catch (e) {
      onChange(null, null)
      if (inputRef.current) inputRef.current.value = ''
      throw e
    }
  }

  const clearSelection = () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    if (inputRef.current) inputRef.current.value = ''
    onChange(null, null)
  }

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
        Vehicle snapshot <span className="font-normal text-slate-400">(optional)</span>
      </label>

      {previewUrl ? (
        <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <img
            src={previewUrl}
            alt={file?.name ?? 'Vehicle snapshot preview'}
            className="h-32 w-48 rounded-lg border border-slate-200 object-cover"
          />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-slate-900">{file?.name ?? 'Selected image'}</p>
            {file && (
              <p className="mt-1 text-slate-500">
                {(file.size / 1024).toFixed(0)} KB · compressed before save
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-sky-300 hover:bg-sky-50/40"
        >
          <div className="mb-3 flex items-center gap-2 text-sky-600">
            <ImagePlus className="h-5 w-5" />
            <Camera className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-700">Upload vehicle photo</p>
          <p className="mt-1 text-xs text-slate-500">
            JPEG, PNG, or WebP up to 5 MB · compressed and saved with the delivery
          </p>
        </label>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null
          try {
            handleFileChange(selected)
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Invalid image')
          }
        }}
      />

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  )
}
