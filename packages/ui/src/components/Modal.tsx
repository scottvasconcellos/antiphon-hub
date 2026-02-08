import { modalVariant } from '@antiphon/motion';
import { AnimatePresence, motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
}

export const Modal = ({ open, title, onClose, children }: PropsWithChildren<ModalProps>) => (
  <AnimatePresence>
    {open ? (
      <motion.div className="a-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="a-modal" variants={modalVariant} initial="hidden" animate="visible" exit="exit">
          <header className="a-modal__header">
            <h3>{title}</h3>
            <button type="button" className="a-modal__close" onClick={onClose}>
              Close
            </button>
          </header>
          <div className="a-modal__body">{children}</div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);
