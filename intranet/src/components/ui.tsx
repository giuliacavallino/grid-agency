"use client";

import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn as clsx } from "@/lib/cn";
import { accentFill, accentText } from "@/lib/theme";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";

// ---------- Buttons ----------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  /** Text während des Ladens, z. B. „Wird gespeichert …“ */
  loadingText?: string;
  icon?: React.ReactNode;
};

/** Button nach UI-Konvention: Wer etwas auslöst, das dauert, zeigt Spinner,
 * Statustext, disabled und aria-busy. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, loadingText, icon, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[transform,background-color,box-shadow,opacity] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow aria-busy:cursor-progress aria-busy:opacity-100",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "btn-rainbow bg-snow text-sky",
        variant === "secondary" && "border border-snow/15 bg-snow/[0.06] text-snow hover:bg-snow/[0.12]",
        variant === "ghost" && "text-snow/75 hover:bg-snow/[0.08] hover:text-snow",
        variant === "danger" && "border border-error/30 text-error hover:bg-error/10",
        className
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-snow/70 transition-colors hover:bg-snow/[0.08] hover:text-snow disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-snow",
        active && "bg-snow/[0.12] text-snow",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------- Formulare ----------

const fieldClass =
  "w-full rounded-xl border border-snow/12 bg-ink/60 px-3 text-sm text-snow placeholder:text-snow/35 outline-none transition-[border-color,box-shadow] focus:border-snow/40 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-snow)_10%,transparent)] disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(fieldClass, "h-10", className)} {...props} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={clsx(fieldClass, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
  }
);

type SelectOption = { value: string; label: string; disabled: boolean; group?: string };

/** Text eines Elementbaums (Inhalt von <option>). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** <option>/<optgroup> wie beim nativen Select in eine flache Liste. */
function readOptions(children: React.ReactNode, group?: string): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: unknown; disabled?: boolean; label?: string; children?: React.ReactNode }>(child)) return;
    if (child.type === "optgroup") out.push(...readOptions(child.props.children, child.props.label));
    else if (child.type === "option") {
      const label = textOf(child.props.children);
      out.push({ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled, group });
    } else out.push(...readOptions(child.props.children, group));
  });
  return out;
}

type SelectProps = {
  id?: string;
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  "aria-busy"?: boolean;
  /** Eigener Auslöser statt des Feld-Looks (z. B. Avatar in der Aufgabenliste) */
  renderButton?: (label: string) => React.ReactNode;
};

/** Auswahlfeld im Hub-Design statt des nativen Dropdowns. Gleiche API wie
 * <select> mit <option>/<optgroup>; onChange bekommt { target: { value } }.
 * Bedienung: Pfeiltasten, Home/End, Enter, Escape, Tippen springt zum
 * passenden Eintrag. Die Liste liegt im Portal, damit Sheets und Dialoge
 * sie nicht abschneiden. */
export function Select({ id, value, onChange, disabled, className, children, renderButton, ...aria }: SelectProps) {
  const listId = useId();
  const options = readOptions(children);
  const current = String(value ?? "");
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; max: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const place = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const up = below < 220 && above > below;
    const width = Math.max(rect.width, 200);
    setPos({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: up ? rect.top - 6 : rect.bottom + 6,
      width,
      up,
      max: Math.min(320, up ? above : below),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!button.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const enabled = (i: number) => options[i] && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return from;
  };

  const show = () => {
    if (disabled) return;
    const index = options.findIndex((o) => o.value === current);
    setActive(index >= 0 ? index : step(-1, 1));
    setOpen(true);
    requestAnimationFrame(() => list.current?.focus());
  };

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    setOpen(false);
    button.current?.focus();
    if (option.value !== current) {
      onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  const typeahead = (key: string, now: number) => {
    typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + key.toLowerCase(), at: now };
    const match = options.findIndex((o, i) => enabled(i) && o.label.toLowerCase().startsWith(typed.current.text));
    if (match >= 0) setActive(match);
  };

  const onListKey = (event: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => step(i, 1)),
      ArrowUp: () => setActive((i) => step(i, -1)),
      Home: () => setActive(step(-1, 1)),
      End: () => setActive(step(options.length, -1)),
      Enter: () => options[active] && choose(options[active]),
      " ": () => options[active] && choose(options[active]),
      Escape: () => {
        setOpen(false);
        button.current?.focus();
      },
    };
    if (event.key === "Tab") return setOpen(false);
    if (keys[event.key]) {
      event.preventDefault();
      // Escape soll nur die Liste schließen, nicht auch Sheet oder Dialog
      event.stopPropagation();
      keys[event.key]();
    } else if (event.key.length === 1) typeahead(event.key, event.timeStamp);
  };

  const label = selected?.label ?? "";
  const placeholder = !selected || (selected.disabled && selected.value === "");

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={aria["aria-label"]}
        aria-busy={aria["aria-busy"]}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            show();
          }
        }}
        className={
          renderButton
            ? className
            : clsx(
                fieldClass,
                "flex h-10 items-center justify-between gap-2 pr-2.5 text-left disabled:cursor-not-allowed aria-expanded:border-snow/40",
                className
              )
        }
      >
        {renderButton ? (
          renderButton(label)
        ) : (
          <>
            <span className={clsx("min-w-0 truncate", placeholder && "text-snow/45")}>{label || "\u00a0"}</span>
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-snow/45 transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>
      {open && pos && (
        <Portal>
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={aria["aria-label"]}
            aria-activedescendant={`${listId}-${active}`}
            data-select-list=""
            onKeyDown={onListKey}
            style={{
              left: pos.left,
              width: pos.width,
              maxHeight: pos.max,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className="glass-solid animate-pop fixed z-[70] overflow-y-auto rounded-2xl p-1.5 outline-none"
          >
            {options.map((option, i) => {
              const isSelected = option.value === current;
              const groupStart = option.group && option.group !== options[i - 1]?.group;
              return (
                <li key={`${option.group ?? ""}|${option.value}`} role="presentation">
                  {groupStart && (
                    <p className="px-3 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-snow/45 uppercase">{option.group}</p>
                  )}
                  <div
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onPointerEnter={() => !option.disabled && setActive(i)}
                    onClick={() => choose(option)}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm",
                      option.disabled ? "cursor-default text-snow/35" : "cursor-pointer text-snow/85",
                      i === active && !option.disabled && "bg-snow/[0.08] text-snow",
                      isSelected && "text-snow"
                    )}
                  >
                    <Check className={clsx("h-4 w-4 shrink-0", isSelected ? "text-snow" : "invisible")} />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Portal>
      )}
    </>
  );
}

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
  className?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-snow/60">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-snow/40">{hint}</p>}
    </div>
  );
}

// ---------- Overlays ----------

function useEscape(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, active]);
}

function Portal({ children }: { children: React.ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

/** Seitenpanel von rechts für Details (Lead, Kunde …). */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
        <aside
          role="dialog"
          aria-modal="true"
          className={clsx(
            "glass-solid animate-sheet relative flex h-full w-full flex-col border-y-0 border-r-0 sm:rounded-l-3xl",
            width
          )}
        >
          <header className="flex items-start gap-3 border-b border-snow/10 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-medium">{title}</h2>
              {subtitle && <div className="mt-0.5 text-sm text-snow/55">{subtitle}</div>}
            </div>
            {actions}
            <IconButton label="Schließen" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </aside>
      </div>
    </Portal>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
        <div className="animate-fade absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={clsx("glass-solid animate-pop relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl sm:rounded-3xl", width)}
        >
          <header className="flex items-center gap-3 px-5 pt-5 pb-3">
            <h2 className="flex-1 text-lg font-medium">{title}</h2>
            <IconButton label="Schließen" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-snow/10 px-5 py-3">{footer}</footer>}
        </div>
      </div>
    </Portal>
  );
}

/** Kleines Aufklappmenü an einem Auslöser. */
export function Popover({
  trigger,
  children,
  align = "right",
  side = "bottom",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEscape(close, open);
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      // Auswahlliste eines Selects im Popover liegt im Portal, zählt aber dazu
      if ((event.target as Element).closest?.("[data-select-list]")) return;
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={clsx(
            "glass-solid animate-pop absolute z-40 min-w-52 rounded-2xl p-1.5",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            align === "right" ? "right-0" : "left-0",
            className
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-snow/85 hover:bg-snow/[0.08] hover:text-snow",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------- Kleinteile ----------

export function Badge({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        !color && "bg-snow/10 text-snow/75",
        className
      )}
      style={color ? { background: accentFill(color, 18), color: accentText(color) } : undefined}
    >
      {children}
    </span>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <div className="mb-1 text-snow/30">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-sm text-sm text-snow/50">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={clsx("h-5 w-5 animate-spin text-snow/50", className)} aria-label="Lädt" />;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  // Farbton stabil aus dem Namen, gedämpft passend zur Marke
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  const letters = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={clsx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", className)}
      style={{ background: `hsl(${hue} 30% 72%)`, color: "#2b2926" }}
      aria-hidden
    >
      {letters}
    </span>
  );
}

// ---------- Toasts ----------

type Toast = { id: number; text: string; tone: "info" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={clsx(
              "glass-solid animate-pop pointer-events-auto rounded-full px-4 py-2.5 text-sm",
              toast.tone === "error" && "text-error"
            )}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
