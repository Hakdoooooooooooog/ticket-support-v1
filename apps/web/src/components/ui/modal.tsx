import { cn } from "@lib/helpers"
import { ButtonHTMLAttributes, forwardRef, HTMLAttributes, KeyboardEvent, useEffect } from "react"

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
    isOpen: boolean;
    onClose: () => void;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(({isOpen, onClose, className, children, ...props}, ref) =>{
    
    // Close on Escape Key
    useEffect(() => {
        const handleKeyDown = (e:globalThis.KeyboardEvent) => {
            if(e.key === "Escape") onClose();
        };
        
        if(isOpen) {
            document.body.style.overflow = "hidden";
            window.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.body.style.overflow = "auto";
            window.removeEventListener("keydown", handleKeyDown);
        }
    }, [onClose, isOpen]);

    if (!isOpen) return null;

    return (
        <div
        ref={ref}
        role="dialog"
        aria-modal={true}
        className={cn("fixed inset-0 z-50 overflow-y-auto m-auto size-fit", className)}
        {...props}
        aria-hidden={!isOpen}
    >
        {children}
    </div>
    )
})

Modal.displayName = "Modal";

const ModalOverlay = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "fixed inset-0 z-[-1] bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in",
      className
    )}
    {...props}
  />
));

ModalOverlay.displayName = "ModalOverlay";

const ModalContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex flex-col w-full max-h-[90vh] rounded-xl border border-spruce-800/80 bg-[#0d2226] text-spruce-100 shadow-2xl transition-all overflow-hidden",
      className
    )}
    {...props}
  />
));
ModalContent.displayName = "ModalContent";

const ModalHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col gap-1.5 px-6 pt-6 pb-4 border-b border-spruce-900/60 shrink-0",
      className
    )}
    {...props}
  />
));
ModalHeader.displayName = "ModalHeader";

const ModalTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight text-white",
      className
    )}
    {...props}
  />
));
ModalTitle.displayName = "ModalTitle";

const ModalDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-spruce-300/70", className)}
    {...props}
  />
));
ModalDescription.displayName = "ModalDescription";

const ModalBody = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto px-6 py-4 space-y-5", className)}
    {...props}
  />
));
ModalBody.displayName = "ModalBody";

const ModalFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-end gap-3 px-6 py-4 border-t border-spruce-900/60 bg-[#0a1b1e] shrink-0",
      className
    )}
    {...props}
  />
));
ModalFooter.displayName = "ModalFooter";

const ModalClose = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "absolute right-6 top-6 rounded-sm text-xs font-medium text-spruce-400 hover:text-white transition-colors focus:outline-none",
      className
    )}
    {...props}
  />
));
ModalClose.displayName = "ModalClose";

export { Modal, ModalOverlay, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter, ModalClose };