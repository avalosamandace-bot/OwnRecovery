import { useState } from "react";
import { Input } from "./ui/input";
import { Eye, EyeOff } from "lucide-react";

/**
 * Password input with show/hide eye toggle.
 * Matches the existing dark glass form styling.
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  required = false,
  minLength,
  placeholder,
  testId,
  className = "",
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        data-testid={testId}
        className={`pr-10 bg-white/5 border-white/10 text-white ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
        data-testid={testId ? `${testId}-toggle` : "password-toggle"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
