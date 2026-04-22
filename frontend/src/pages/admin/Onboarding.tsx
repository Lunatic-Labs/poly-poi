import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import Step1Identity from './onboarding/Step1Identity';
import Step2Content from './onboarding/Step2Content';
import Step3Stops from './onboarding/Step3Stops';
import Step4Amenities from './onboarding/Step4Amenities';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  branding: {
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
  };
}

const STEPS = ['Identity', 'Content', 'Tour Stops', 'Amenities'];

const STEP_TITLES = [
  'Set up your site',
  'Upload your content',
  'Add tour stops',
  'Add amenities',
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [step, setStep] = useState(0);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    navigate('/admin/login');
  }

  // Resume onboarding if tenant already exists (e.g. after a page refresh)
  useEffect(() => {
    api.get<Tenant>('/api/admin/tenants/me').then((t) => {
      setTenant(t);
      setStep(1);
    }).catch(() => {
      // No tenant yet — start at step 0 as normal
    });
  }, []);

  async function handleStep1(data: {
    name: string;
    slug: string;
    branding: {
      primary_color: string;
      accent_color: string;
    };
    logoFile?: File;
  }) {
    setError(null);
    setSaving(true);
    try {
      if (!tenant) {
        const created = await api.post<Tenant>('/api/admin/tenants', {
          name: data.name,
          slug: data.slug,
        });
        setTenant(created);
      } else if (data.name !== tenant.name) {
        await api.patch('/api/admin/tenants/me', { name: data.name });
        setTenant({ ...tenant, name: data.name });
      }

      let logo_url: string | undefined;
      if (data.logoFile) {
        const fd = new FormData();
        fd.append('file', data.logoFile);
        const res = await api.postForm<{ logo_url: string }>(
          '/api/admin/tenants/me/logo',
          fd,
        );
        logo_url = res.logo_url;
      }

      await api.patch('/api/admin/tenants/me', {
        branding: { ...data.branding, ...(logo_url ? { logo_url } : {}) },
      });

      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow">
        {/* Account bar */}
        <div className="mb-6 flex items-center justify-end gap-2 text-xs text-gray-400">
          {user?.email && <span className="truncate">Signed in as {user.email}</span>}
          {user?.email && <span aria-hidden="true">·</span>}
          <button
            type="button"
            onClick={handleSignOut}
            className="hover:text-gray-600 hover:underline"
          >
            Sign out
          </button>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                onClick={() => { if (i < step) setStep(i); }}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i <= step
                    ? 'bg-brand-navy text-white'
                    : 'bg-gray-200 text-gray-500'
                } ${i < step ? 'cursor-pointer hover:bg-brand-navy/90' : ''}`}
              >
                {i < step ? (
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-sm ${i === step ? 'font-medium text-brand-navy' : 'text-gray-400'}`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="mx-1 h-px w-8 shrink-0 bg-gray-200" />
              )}
            </div>
          ))}
        </div>

        <h2 className="mb-6 text-xl font-bold text-brand-navy">
          {STEP_TITLES[step]}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 0 && (
          <Step1Identity
            onNext={handleStep1}
            loading={saving}
            initialData={tenant ? { name: tenant.name, slug: tenant.slug, branding: tenant.branding } : undefined}
          />
        )}
        {step === 1 && tenant && (
          <Step2Content onNext={() => setStep(2)} onBack={() => setStep(0)} />
        )}
        {step === 2 && (
          <Step3Stops onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <Step4Amenities onNext={() => navigate('/admin/dashboard')} onBack={() => setStep(2)} />
        )}
      </div>
    </div>
  );
}
