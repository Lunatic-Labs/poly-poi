import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import Step1Identity from "./onboarding/Step1Identity";
import Step2Branding from "./onboarding/Step2Branding";

interface Tenant {
  id: string;
  slug: string;
  name: string;
}

const STEPS = ["Identity", "Branding"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStep1(data: { name: string; slug: string; contact_info: Record<string, string> }) {
    setError(null);
    try {
      const created = await api.post<Tenant>("/api/admin/tenants", data);
      setTenant(created);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tenant");
    }
  }

  async function handleStep2(branding: Record<string, string>) {
    if (!tenant) return;
    setError(null);
    try {
      await api.patch("/api/admin/tenants/me", { branding });
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow">
        {/* Step indicators */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i <= step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-sm ${i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="mx-1 h-px w-8 bg-gray-200" />}
            </div>
          ))}
        </div>

        <h2 className="mb-6 text-xl font-bold text-gray-900">
          {step === 0 ? "Set up your organization" : "Customize branding"}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {step === 0 && <Step1Identity onNext={handleStep1} />}
        {step === 1 && tenant && <Step2Branding onNext={handleStep2} />}
      </div>
    </div>
  );
}
