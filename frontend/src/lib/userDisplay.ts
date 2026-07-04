import i18n from '../i18n';
import type { UserRole } from '../contexts/AuthContext';

/**
 * الاسم الظاهر للموظف: القيمة المخزّنة في username، مع تسمية واضحة لحساب التثبيت الافتراضي "admin".
 * يعتمد على لغة الواجهة لـ "مدير النظام" / System administrator.
 */
export function getEmployeeDisplayName(username: string): string {
  const name = username.trim();
  if (name.toLowerCase() === 'admin') {
    return i18n.t('layout.adminDisplayName');
  }
  return name;
}

/** تسمية الدور حسب لغة الواجهة */
export function roleLabelAr(role: UserRole | string): string {
  const key = `layout.role.${role}`;
  const translated = i18n.t(key);
  return translated === key ? String(role) : translated;
}
