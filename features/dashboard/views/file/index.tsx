/**
 * Keystone `file` field for the dashboard (homework hand-ins, resources).
 * Mirrors @keystone-6/core/fields/types/file/views with the dashboard's UI.
 */
import { useMemo, useRef, type SyntheticEvent } from 'react'
import { FileIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { CellComponent, FieldControllerConfig, FieldProps } from '../../types'

type FileData = { src: string; filesize: number; filename: string }

export type FileValue =
  | { kind: 'empty' }
  | { kind: 'from-server'; data: FileData }
  | { kind: 'upload'; data: { file: File; validity: ValidityState }; previous: FileValue }
  | { kind: 'remove'; previous?: Exclude<FileValue, { kind: 'remove' }> }

const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`)

export function validateFile(v: { validity: ValidityState }) {
  if (!v.validity.valid) return 'Something went wrong, please reload and try again.'
}

export const Cell: CellComponent<typeof controller> = ({ item, field }: { item: Record<string, any>; field: { path: string } }) => {
  const data = item[field.path]
  if (!data) return null
  return <a className="underline" href={data.url} target="_blank" rel="noreferrer">{data.filename}</a>
}

export function Field(props: FieldProps<typeof controller>) {
  const { field, onChange, value, autoFocus } = props as any
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputKey = useMemo(() => Math.random(), [value])
  const v = value as FileValue
  const error = v.kind === 'upload' ? validateFile(v.data) : undefined
  const shown = v.kind === 'from-server' ? { name: v.data.filename, size: v.data.filesize, href: v.data.src } : v.kind === 'upload' ? { name: v.data.file.name, size: v.data.file.size, href: null } : null

  const onUpload = ({ currentTarget: { validity, files } }: SyntheticEvent<HTMLInputElement>) => {
    const file = files?.[0]
    if (file) onChange?.({ kind: 'upload', data: { file, validity }, previous: v })
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.path}>
        {field.label}
        {field.description ? <span className="block text-sm text-muted-foreground">{field.description}</span> : null}
      </Label>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      {shown ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          <FileIcon className="size-4 text-muted-foreground" />
          {shown.href ? <a className="underline" href={shown.href} target="_blank" rel="noreferrer">{shown.name}</a> : <span>{shown.name}</span>}
          <span className="text-muted-foreground">{bytes(shown.size)}</span>
          {v.kind === 'upload' ? <span className="text-muted-foreground">Save to finish the upload.</span> : null}
          {onChange ? (
            <span className="ml-auto flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>Change</Button>
              {v.kind === 'from-server' ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ kind: 'remove', previous: v })}>Remove</Button> : null}
              {v.kind === 'upload' ? <Button type="button" size="sm" variant="outline" onClick={() => onChange(v.previous)}>Cancel</Button> : null}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="button" disabled={onChange === undefined} onClick={() => inputRef.current?.click()}>Upload</Button>
          {v.kind === 'remove' && v.previous ? (
            <>
              <Button type="button" variant="outline" onClick={() => onChange?.(v.previous!)}>Undo removal</Button>
              <span className="text-sm text-muted-foreground">The file will be removed when you save.</span>
            </>
          ) : null}
        </div>
      )}
      <input key={inputKey} ref={inputRef} id={field.path} name={field.path} type="file" className="hidden" autoFocus={autoFocus} disabled={onChange === undefined} onChange={onUpload} />
    </div>
  )
}

export const controller = (config: FieldControllerConfig) => ({
  path: config.path,
  label: config.label,
  description: config.description,
  graphqlSelection: `${config.path} {
      url
      filename
      filesize
    }`,
  defaultValue: { kind: 'empty' } as FileValue,
  deserialize(item: any): FileValue {
    const value = item[config.path]
    if (!value) return { kind: 'empty' }
    return { kind: 'from-server', data: { src: value.url, filename: value.filename, filesize: value.filesize } }
  },
  validate(value: FileValue): boolean {
    return value.kind !== 'upload' || validateFile(value.data) === undefined
  },
  serialize(value: FileValue) {
    if (value.kind === 'upload') return { [config.path]: { upload: value.data.file } }
    if (value.kind === 'remove') return { [config.path]: null }
    return {}
  },
})
