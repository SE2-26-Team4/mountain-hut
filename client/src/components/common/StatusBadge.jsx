/**
 * @param {{
 *   children: import("react").ReactNode,
 *   variant?: "primary" | "secondary" | "success" | "danger" | "warning"
 * }} props
 */
export default function StatusBadge({ children, variant = "secondary" }) {
  return (
    <span className={`badge rounded-pill text-bg-${variant}`}>{children}</span>
  );
}
