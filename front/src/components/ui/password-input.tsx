import { Eye, EyeOff } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  'data-testid': string
}

export function PasswordInput({ className, 'data-testid': testId, ...props }: PasswordInputProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        data-testid={testId}
        className={cn('pr-9', className)}
        {...props}
      />
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-label={t(visible ? 'auth.passwordToggle.hide' : 'auth.passwordToggle.show')}
        className="absolute inset-y-0 right-0 flex items-center border border-transparent px-3 text-muted-foreground hover:text-foreground rounded-md outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
