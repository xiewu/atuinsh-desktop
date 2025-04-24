import React, { useState, useCallback } from 'react';
import { Input, InputProps } from "@heroui/react";
import { Eye, EyeOff } from 'lucide-react';

interface MaskedInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value: string;
  size?: "sm" | "md" | "lg";
  onChange: (value: string) => void;
  maskRegex: RegExp;
  maskChar?: string;
}

const MaskedInput: React.FC<MaskedInputProps> = ({
  value,
  onChange,
  maskRegex,
  maskChar = '*',
  size = "md",
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const maskValue = useCallback((val: string) => {
    return val.replace(maskRegex, match => maskChar.repeat(match.length));
  }, [maskRegex, maskChar]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const toggleShowPassword = () => setShowPassword(prev => !prev);

  const displayValue = (isFocused || showPassword) ? value : maskValue(value);

  return (
    <Input
      {...props}
      value={displayValue}
      onChange={(e) => onChange(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      size={size}
      endContent={
        maskRegex.test(value) &&
        <button onClick={toggleShowPassword} type="button">
          {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      }
    />
  );
};

export default MaskedInput;
