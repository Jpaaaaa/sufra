import { useEffect, useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../../components/i18n/LanguageSwitcher';
import { useAuth } from '../../contexts/AuthContext';
import { getServerConfig, subscribeToServerUrlChanges } from '../../lib/server-config';

export default function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const config = getServerConfig();
    setServerUrl(config.serverUrl);
    return subscribeToServerUrlChanges((updated) => {
      setServerUrl(updated.serverUrl);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول. يرجى التحقق من اسم الموظف (اسم الدخول) وكلمة المرور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-cloud-soft-white via-white to-cyber-aqua/10 p-4">
      <div className="absolute right-4 top-4 z-10 rounded-xl border border-black/5 bg-white p-2 shadow-soft">
        <LanguageSwitcher className="[&_span]:text-obsidian/80 [&_select]:border-black/10 [&_select]:bg-white" />
      </div>
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {/* Logo/Title */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-obsidian">Sufra Lite</h1>
            <p className="text-graphite">{t('loginTagline')}</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-obsidian mb-2">
                اسم الموظف <span className="font-normal text-graphite">(اسم الدخول)</span>
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/20"
                placeholder="نفس الاسم المسجّل في إعدادات المستخدمين"
                dir="ltr"
                autoComplete="username"
              />
              <p className="mt-1.5 text-xs text-graphite">
                يطابق اسم الموظف في جدول المستخدمين — ليس حقلًا منفصلًا عن اسم الدخول.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-obsidian mb-2">
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua/20"
                placeholder="أدخل كلمة المرور"
                dir="ltr"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-cyber-aqua px-4 py-3 font-semibold text-white transition-colors hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-graphite">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">عنوان الخادم الحالي:</p>
                <p className="truncate font-mono text-[11px]" dir="ltr">{serverUrl || 'غير محدد'}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/setup/server')}
                className="rounded-md bg-white px-3 py-2 text-[12px] font-medium text-obsidian shadow-sm ring-1 ring-black/10 hover:bg-gray-100"
              >
                إعدادات الخادم
              </button>
            </div>
          </div>

          {/* Default Credentials Hint */}
          <div className="mt-6 rounded-lg bg-gray-50 p-4 text-xs text-graphite border border-gray-200">
            <p className="font-medium mb-1">بيانات الدخول الافتراضية:</p>
            <p>اسم المستخدم: <span className="font-mono">admin</span></p>
            <p>كلمة المرور: <span className="font-mono">admin123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
