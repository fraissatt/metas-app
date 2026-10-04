'use client'

import { Menu } from '@base-ui/react/menu'
import { Check, Sparkles } from 'lucide-react'
import { useBackground } from '@/components/background-provider'
import {
  BACKGROUND_LABELS,
  BACKGROUND_STYLES,
  type BackgroundStyle,
} from '@/lib/background-options'

const itemClass =
  'flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-default outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground'

export function BackgroundPicker() {
  const { style, setStyle } = useBackground()

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Fundo: ${BACKGROUND_LABELS[style]}`}
        className="rounded-md px-2 py-2 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        <Sparkles className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md min-w-44">
            <Menu.RadioGroup
              value={style}
              onValueChange={(value) => setStyle(value as BackgroundStyle)}
            >
              {BACKGROUND_STYLES.map((option) => (
                <Menu.RadioItem
                  key={option}
                  value={option}
                  closeOnClick
                  className={itemClass}
                >
                  <span className="flex size-4 items-center justify-center">
                    <Menu.RadioItemIndicator>
                      <Check className="size-4" />
                    </Menu.RadioItemIndicator>
                  </span>
                  {BACKGROUND_LABELS[option]}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
