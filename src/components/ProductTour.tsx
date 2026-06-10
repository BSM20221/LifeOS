import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

export type ProductTourStep = {
  id: string;
  title: string;
  body: string;
  targetSelector?: string;
  page?: string;
};

export function ProductTour({
  open,
  steps,
  onClose,
  onNavigate,
}: {
  open: boolean;
  steps: ProductTourStep[];
  onClose: () => void;
  onNavigate?: (step: ProductTourStep) => void;
}) {
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !step) {
      return;
    }

    onNavigate?.(step);
  }, [onNavigate, open, step]);

  useEffect(() => {
    if (!open || !step) {
      return;
    }

    const measure = () => {
      if (!step.targetSelector) {
        setTargetRect(null);
        return;
      }

      const target = document.querySelector(step.targetSelector);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
        setTargetRect(target.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    const timeout = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", measure);
    };
  }, [open, step]);

  const highlightStyle = useMemo<CSSProperties>(() => {
    if (!targetRect) {
      return {};
    }

    return {
      top: targetRect.top - 8,
      left: targetRect.left - 8,
      width: targetRect.width + 16,
      height: targetRect.height + 16,
    };
  }, [targetRect]);

  if (!open || !step) {
    return null;
  }

  return (
    <div className="product-tour-layer" role="dialog" aria-modal="true" aria-labelledby="product-tour-title">
      <button className="product-tour-dim" type="button" aria-label="Skip introduction" onClick={onClose} />
      {targetRect ? <div className="product-tour-highlight" style={highlightStyle} aria-hidden="true" /> : null}
      <section className="product-tour-card">
        <button className="icon-button tour-close-button" type="button" aria-label="Skip introduction" onClick={onClose}>
          <X size={18} />
        </button>
        <p className="eyebrow">LifeOS guide</p>
        <h2 id="product-tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-progress" aria-label={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((item, itemIndex) => (
            <span className={itemIndex === index ? "active" : ""} key={item.id} />
          ))}
        </div>
        <div className="tour-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            Skip
          </button>
          <div>
            <button className="secondary-button" type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                if (isLast) {
                  onClose();
                } else {
                  setIndex((value) => Math.min(steps.length - 1, value + 1));
                }
              }}
            >
              {isLast ? "Finish" : "Next"}
              {!isLast ? <ArrowRight size={16} /> : null}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
