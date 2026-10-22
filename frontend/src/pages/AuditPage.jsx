import { useBreadcrumb } from '../components/Layout';
import { AuditLogCard } from '../components/AuditLogCard';

export function AuditPage() {
  useBreadcrumb([{ label: 'Vault', to: '/secrets' }, { label: 'Audit log' }]);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit log</h1>
          <p className="page-sub">Every attempt to read, rotate or change access to a secret, including denied ones.</p>
        </div>
      </div>
      <AuditLogCard />
    </>
  );
}
