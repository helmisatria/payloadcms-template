'use client'

import { useFormFields, useTheme } from '@payloadcms/ui'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { useState } from 'react'

type ViewMode = 'inline' | 'split'

const panelStyle = {
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 8,
  overflow: 'hidden',
}

const buttonStyle = {
  background: 'transparent',
  border: 0,
  borderRadius: 4,
  color: 'var(--theme-elevation-600)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  padding: '6px 10px',
}

export const AuditLogDiff = () => {
  const previousValue = useFormFields(([fields]) => fields.previousValue?.value)
  const currentValue = useFormFields(([fields]) => fields.currentValue?.value)
  const operation = useFormFields(([fields]) => fields.operation?.value)
  const { theme } = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('split')

  if (previousValue == null && currentValue == null) {
    return (
      <section className="field-type" aria-labelledby="audit-log-changes-heading">
        <div className="field-label" id="audit-log-changes-heading">
          Changes
        </div>
        <div style={{ ...panelStyle, padding: '18px 20px' }}>
          <div style={{ fontWeight: 600, marginBlockEnd: 4 }}>No document snapshot</div>
          <p style={{ color: 'var(--theme-elevation-600)', margin: 0 }}>
            This log was created before change snapshots were enabled.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="field-type" aria-labelledby="audit-log-changes-heading">
      <div
        style={{
          alignItems: 'end',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
          marginBlockEnd: 10,
        }}
      >
        <div>
          <div className="field-label" id="audit-log-changes-heading">
            Changes
          </div>
          <div style={{ color: 'var(--theme-elevation-600)', fontSize: 13 }}>
            {String(operation || 'change')} document snapshot
          </div>
        </div>

        <div
          aria-label="Diff layout"
          role="group"
          style={{
            background: 'var(--theme-elevation-100)',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 6,
            display: 'inline-flex',
            padding: 3,
          }}
        >
          {(['split', 'inline'] as const).map((mode) => {
            const selected = viewMode === mode

            return (
              <button
                key={mode}
                type="button"
                aria-pressed={selected}
                onClick={() => setViewMode(mode)}
                style={{
                  ...buttonStyle,
                  background: selected ? 'var(--theme-elevation-800)' : buttonStyle.background,
                  color: selected ? 'var(--theme-elevation-0)' : buttonStyle.color,
                }}
              >
                {mode === 'split' ? 'Side by side' : 'Inline'}
              </button>
            )
          })}
        </div>
      </div>

      <div style={panelStyle}>
        <ReactDiffViewer
          oldValue={(previousValue ?? {}) as Record<string, unknown>}
          newValue={(currentValue ?? {}) as Record<string, unknown>}
          compareMethod={DiffMethod.JSON}
          splitView={viewMode === 'split'}
          leftTitle="Before"
          rightTitle="After"
          showDiffOnly={false}
          useDarkTheme={theme === 'dark'}
          disableWorker
          styles={{
            diffContainer: {
              fontSize: 13,
              minWidth: viewMode === 'split' ? 760 : 0,
            },
            line: {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              lineHeight: 1.55,
            },
            titleBlock: {
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              padding: '10px 12px',
              textTransform: 'uppercase',
            },
            variables: {
              dark: {
                addedBackground: '#143527',
                addedGutterBackground: '#1b4634',
                removedBackground: '#3b2024',
                removedGutterBackground: '#502a30',
                wordAddedBackground: '#276344',
                wordRemovedBackground: '#743842',
              },
              light: {
                addedBackground: '#e7f5ec',
                addedGutterBackground: '#d2eadb',
                removedBackground: '#fbeaec',
                removedGutterBackground: '#f3d6da',
                wordAddedBackground: '#bce0c8',
                wordRemovedBackground: '#edbdc3',
              },
            },
          }}
        />
      </div>
    </section>
  )
}
