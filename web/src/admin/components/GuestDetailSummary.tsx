import type { ReactNode } from 'react';
import './guest-detail.css';
export function GuestDetailSummary({
  name,
  identity,
  status,
  description,
  facts,
}: {
  name: string;
  identity: string;
  status: ReactNode;
  description?: string;
  facts: { label: string; value: ReactNode }[];
}) {
  return (
    <section className="guest-detail-summary">
      <div className="guest-detail-eyebrow">{identity}</div>
      <div className="guest-detail-heading">
        <h2>{name}</h2>
        {status}
      </div>
      {description && <p>{description}</p>}
      <dl className="guest-detail-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
