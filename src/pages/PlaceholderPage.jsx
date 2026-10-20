import React from 'react';
import { Calendar, Users, FileText, Settings, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import EmptyState from '../components/EmptyState';
import SecondaryButton from '../components/SecondaryButton';

const ICON_MAP = {
  patients: Users,
  records: FileText,
  appointments: Calendar,
  settings: Settings,
};

export default function PlaceholderPage({ title, moduleKey, description }) {
  const Icon = ICON_MAP[moduleKey] || FileText;

  return (
    <PageContainer
      title={title}
      subtitle={`CareSync Phase 2 Roadmap — ${title}`}
    >
      <div className="bg-white rounded-lg border border-brand-border p-6 shadow-card">
        <EmptyState
          icon={Icon}
          title={`${title} Module (Phase 2)`}
          description={
            description ||
            `The ${title.toLowerCase()} module is part of the Phase 2 backend & database integration milestone. Only the frontend foundation, login UI, and dashboard layout are delivered in Phase 1.`
          }
          action={
            <Link to="/dashboard">
              <SecondaryButton icon={ArrowLeft} size="sm">
                Return to Dashboard
              </SecondaryButton>
            </Link>
          }
        />
      </div>
    </PageContainer>
  );
}
