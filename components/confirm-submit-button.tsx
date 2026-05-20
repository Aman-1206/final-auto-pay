"use client";

type ConfirmSubmitButtonProps = {
  children: string;
  className?: string;
  confirmationMessage: string;
};

export function ConfirmSubmitButton({
  children,
  className,
  confirmationMessage
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmationMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
