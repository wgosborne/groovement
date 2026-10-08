'use client';

interface DisconnectButtonProps {
  action: () => Promise<void>;
  label: string;
  confirmMessage: string;
}

export function DisconnectButton({ action, label, confirmMessage }: DisconnectButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-block text-sm font-light text-red-300 hover:text-red-200 underline"
      >
        {label}
      </button>
    </form>
  );
}
