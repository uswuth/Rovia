import * as React from 'react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  onGeneratePassword?: () => void;
  showGenerateButton?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, onGeneratePassword, showGenerateButton = true, type: _type, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative flex items-center w-full">
        <Input
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-20', className)}
          ref={ref}
          {...props}
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {showGenerateButton && onGeneratePassword && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onGeneratePassword}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-500 cursor-pointer"
              title="Generate Random Password"
            >
              <Sparkles size={14} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword((prev) => !prev)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
        </div>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
