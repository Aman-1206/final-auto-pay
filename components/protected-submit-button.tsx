"use client";

import { useEffect, useRef, useState } from "react";

type ProtectedSubmitButtonProps = {
  children: string;
  className?: string;
  confirmationMessage?: string;
};

export function ProtectedSubmitButton({
  children,
  className,
  confirmationMessage
}: ProtectedSubmitButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    const form = buttonRef.current?.form;
    const passwordInput = form?.querySelector<HTMLInputElement>('input[name="operationPassword"]');

    if (!passwordInput) {
      setHasPassword(true);
      return;
    }

    function updatePasswordState() {
      setHasPassword(Boolean(passwordInput?.value.trim()));
    }

    updatePasswordState();
    passwordInput.addEventListener("input", updatePasswordState);

    return () => {
      passwordInput.removeEventListener("input", updatePasswordState);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="submit"
      className={className}
      disabled={!hasPassword}
      aria-disabled={!hasPassword}
      title={!hasPassword ? "Enter the required password to continue." : undefined}
      onClick={(event) => {
        if (!hasPassword) {
          event.preventDefault();
          return;
        }

        if (confirmationMessage && !window.confirm(confirmationMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
