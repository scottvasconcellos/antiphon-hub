interface ToastPayload {
  id: number;
  message: string;
}

interface CreateToastCoalescerOptions {
  delayMs?: number;
  ttlMs?: number;
  onShow: (payload: ToastPayload) => void;
  onHide: () => void;
}

export const createToastCoalescer = ({
  delayMs = 350,
  ttlMs = 1800,
  onShow,
  onHide,
}: CreateToastCoalescerOptions) => {
  let pendingMessage: string | undefined;
  let displayTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    if (displayTimer) {
      clearTimeout(displayTimer);
      displayTimer = undefined;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  };

  return {
    enqueue(message: string) {
      pendingMessage = message;
      if (displayTimer) {
        clearTimeout(displayTimer);
      }

      displayTimer = setTimeout(() => {
        if (!pendingMessage) {
          return;
        }

        onShow({
          id: Date.now(),
          message: pendingMessage,
        });

        pendingMessage = undefined;

        if (hideTimer) {
          clearTimeout(hideTimer);
        }

        hideTimer = setTimeout(() => {
          onHide();
        }, ttlMs);
      }, delayMs);
    },
    clear() {
      pendingMessage = undefined;
      clearTimers();
      onHide();
    },
  };
};
