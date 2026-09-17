import Link from "next/link";

export function InstructorEmptySection({ label, title, description, actionHref, actionLabel }: {
  label: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return <section className="system-card empty-workspace instructor-empty-section"><p className="card-label">{label}</p><span aria-hidden="true">○</span><h2>{title}</h2><p>{description}</p><Link className="solid-link" href={actionHref}>{actionLabel} →</Link></section>;
}
