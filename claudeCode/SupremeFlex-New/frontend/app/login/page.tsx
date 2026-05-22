'use client';

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { phpApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type Step = 'mobile' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('mobile');
  const [contactNumber, setContactNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const fullNumber = contactNumber.trim() ? `+880${contactNumber.trim()}` : '';

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!contactNumber.trim()) return;

    setLoading(true);
    try {
      await phpApi.post('/auth/otp/request', { contact_number: fullNumber });
      toast.success('OTP sent to your number');
      setStep('otp');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;

    setLoading(true);
    try {
      const res = await phpApi.post('/auth/otp/verify', {
        contact_number: fullNumber,
        code: otp,
      });
      flushSync(() => {
        login(res.data.access_token, res.data.user);
      });
      router.replace('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid or expired OTP');
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="bg-background border rounded-xl shadow-sm p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-xl font-bold tracking-tight">SupremeFlex</h1>
            <p className="text-sm text-muted-foreground mt-1">GPFI Operations Console</p>
          </div>

          {step === 'mobile' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5" htmlFor="contact">
                  Mobile number
                </label>
                <div className="flex items-center border rounded-md focus-within:ring-2 focus-within:ring-primary/50 bg-background">
                  <span className="px-3 py-2 text-sm text-muted-foreground border-r select-none">+880</span>
                  <input
                    id="contact"
                    type="tel"
                    autoComplete="tel"
                    autoFocus
                    value={contactNumber}
                    onChange={e => setContactNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="1XXXXXXXXX"
                    className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !contactNumber.trim()}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  OTP sent to <span className="font-medium text-foreground">{fullNumber}</span>
                </p>
                <label className="text-sm font-medium block mb-1.5" htmlFor="otp">
                  Enter 6-digit OTP
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('mobile'); setOtp(''); }}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a different number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
