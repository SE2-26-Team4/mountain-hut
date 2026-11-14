/**
 * @param {{
 *   children: import("react").ReactNode,
 *   variant?: "primary" | "secondary" | "success" | "danger" | "warning"
 * }} props
 */
export default function StatusBadge({ children, variant = "secondary" }) {
  const isDanger = variant === "danger";

  return (
    <span
      className={`badge rounded-pill ${
        isDanger ? "text-white mh-status-badge-danger" : `text-bg-${variant}`
      }`}
    >
      {children}
    </span>
  );
}
