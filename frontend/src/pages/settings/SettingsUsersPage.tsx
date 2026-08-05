import { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import SettingsTabs from '../../components/tabs/SettingsTabs';
import { UserRole } from '../../contexts/AuthContext';
import { showToast } from '../../components/ui/Toast';
import { showConfirm } from '../../components/ui/ConfirmDialog';
import { showPasswordDialog } from '../../components/ui/PasswordDialog';
import { useAuth } from '../../contexts/AuthContext';

interface User {
  id: number;
  username: string;
  role: UserRole;
  password_plain?: string | null;
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CreateUserDto {
  username: string;
  password: string;
  role: UserRole;
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'مدير',
  manager: 'مدير',
  cashier: 'كاشير',
  waiter: 'نادل',
  kitchen: 'مطبخ',
  customer: 'عميل',
};

export default function SettingsUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Record<number, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('waiter');
  const [formRequireCaptainApproval, setFormRequireCaptainApproval] = useState(false);
  const [formCustomerFreeOrder, setFormCustomerFreeOrder] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (window.sufra?.users?.findAll) {
        const usersData = await window.sufra.users.findAll();
        setUsers(usersData);
      } else {
        showToast('وظيفة إدارة المستخدمين غير متاحة', 'error');
      }
    } catch (error: any) {
      console.error('Failed to load users:', error);
      showToast('فشل تحميل المستخدمين', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormRole('waiter');
    setFormRequireCaptainApproval(false);
    setFormCustomerFreeOrder(false);
    setEditingUser(null);
    setShowFormPassword(false);
  };

  const toggleCodeReveal = (userId: number) => {
    setRevealedCodes((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleEdit = (user: User) => {
    setFormUsername(user.username);
    setFormPassword('');
    setFormRole(user.role);
    setFormRequireCaptainApproval(user.require_captain_approval || false);
    setFormCustomerFreeOrder(user.customer_free_order || false);
    setEditingUser(user);
    setShowFormPassword(false);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formUsername.trim()) {
      showToast('الرجاء إدخال اسم الموظف', 'warning');
      return;
    }

    if (!editingUser && !formPassword.trim()) {
      showToast('الرجاء إدخال الرمز', 'warning');
      return;
    }

    if (formPassword.trim() && formPassword.length < 4) {
      showToast('الرمز يجب أن يكون 4 أحرف على الأقل', 'warning');
      return;
    }

    try {
      if (editingUser) {
        const updateData: any = {
          username: formUsername.trim(),
          role: formRole,
          require_captain_approval: formRequireCaptainApproval,
          customer_free_order: formCustomerFreeOrder,
        };

        if (formPassword.trim()) {
          updateData.password = formPassword.trim();
        }

        if (window.sufra?.users?.update) {
          await window.sufra.users.update(editingUser.id, updateData);
          showToast('تم تحديث المستخدم بنجاح', 'success');
        } else {
          showToast('وظيفة تحديث المستخدم غير متاحة', 'error');
          return;
        }
      } else {
        const createData: CreateUserDto = {
          username: formUsername.trim(),
          password: formPassword.trim(),
          role: formRole,
          require_captain_approval: formRequireCaptainApproval,
          customer_free_order: formCustomerFreeOrder,
        };

        if (window.sufra?.users?.create) {
          await window.sufra.users.create(createData);
          showToast('تم إنشاء المستخدم بنجاح', 'success');
        } else {
          showToast('وظيفة إنشاء المستخدم غير متاحة', 'error');
          return;
        }
      }

      setShowCreateModal(false);
      resetForm();
      await loadUsers();
    } catch (error: any) {
      console.error('Failed to save user:', error);
      showToast(error.message || 'فشل حفظ المستخدم', 'error');
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      showToast('لا يمكنك حذف حسابك الخاص', 'error');
      return;
    }

    const confirmed = await showConfirm({
      title: 'حذف المستخدم',
      message: `هل أنت متأكد من حذف الموظف "${user.username}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });

    if (!confirmed) return;

    setDeletingUserId(user.id);
    try {
      if (window.sufra?.users?.remove) {
        await window.sufra.users.remove(user.id);
        showToast('تم حذف المستخدم بنجاح', 'success');
        await loadUsers();
      } else {
        showToast('وظيفة حذف المستخدم غير متاحة', 'error');
      }
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      showToast(error.message || 'فشل حذف المستخدم', 'error');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleChangePassword = async (user: User) => {
    await showPasswordDialog({
      title: 'تغيير الرمز',
      message: `إدخال رمز جديد للموظف "${user.username}"${
        user.password_plain ? ` (الحالي: ${user.password_plain})` : ''
      }`,
      onConfirm: async (newPassword: string) => {
        if (newPassword.length < 4) {
          showToast('الرمز يجب أن يكون 4 أحرف على الأقل', 'warning');
          return false;
        }

        try {
          if (window.sufra?.users?.update) {
            await window.sufra.users.update(user.id, { password: newPassword });
            showToast('تم تغيير الرمز بنجاح', 'success');
            await loadUsers();
            return true;
          } else {
            showToast('وظيفة تحديث المستخدم غير متاحة', 'error');
            return false;
          }
        } catch (error: any) {
          console.error('Failed to change password:', error);
          showToast(error.message || 'فشل تغيير الرمز', 'error');
          return false;
        }
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title="إدارة المستخدمين" />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <SettingsTabs />

          <div className="mt-6 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[20px] leading-tight font-semibold text-obsidian">
                  إدارة المستخدمين
                </h2>
                <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-obsidian/65">
                  عمود <strong className="font-semibold text-obsidian/85">اسم الموظف</strong> هو الاسم
                  الظاهر في التقارير وعلى الطلبات؛ وهو نفسه المعرف الذي يُدخل عند تسجيل الدخول.
                  عمود <strong className="font-semibold text-obsidian/85">الرمز</strong> يظهر للأدمن فقط ويمكن تغييره في أي وقت.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="shrink-0 rounded-soft-lg bg-cyber-aqua px-4 py-2.5 text-[14px] leading-normal font-medium text-white hover:bg-cyber-aqua/90"
              >
                + إضافة موظف
              </button>
            </div>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 inline-block h-8 w-8 rounded-full border-4 border-cyber-aqua border-t-transparent"></div>
                  <p className="text-[15px] leading-normal text-graphite">جاري التحميل...</p>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-soft-lg border border-dashed border-black/10 bg-cloud-soft-white">
                <p className="text-[15px] leading-normal text-graphite">لا يوجد مستخدمين</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black/10">
                      <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">
                        <span className="block text-obsidian">اسم الموظف</span>
                        <span className="mt-0.5 block text-[11px] font-normal leading-snug text-obsidian/50">
                          (نفس اسم الدخول)
                        </span>
                      </th>
                      <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">
                        الدور
                      </th>
                      <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">
                        الرمز
                      </th>
                      <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">
                        موافقة الكابتن
                      </th>
                      <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70">
                        طلب مجاني
                      </th>
                      <th className="text-right py-3 px-4 text-[13px] font-medium text-obsidian/70 w-40">
                        إجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const code = user.password_plain?.trim() || '';
                      const revealed = !!revealedCodes[user.id];
                      return (
                        <tr
                          key={user.id}
                          className={`border-b border-black/5 hover:bg-cloud-soft-white ${
                            user.id === currentUser?.id ? 'bg-cyber-aqua/5' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <span className="text-[14px] font-medium text-obsidian">
                              {user.username}
                              {user.id === currentUser?.id && (
                                <span className="ml-2 text-[12px] text-cyber-aqua">(أنت)</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-medium bg-cyber-aqua/10 text-cyber-aqua">
                              {roleLabels[user.role] || user.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {code ? (
                              <div className="flex items-center gap-2">
                                <code
                                  className="rounded-md bg-cloud-soft-white px-2 py-1 font-mono text-[13px] text-obsidian tracking-wide"
                                  dir="ltr"
                                >
                                  {revealed ? code : '••••••••'}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => toggleCodeReveal(user.id)}
                                  className="rounded-md px-2 py-1 text-[12px] font-medium text-cyber-aqua hover:bg-cyber-aqua/10"
                                >
                                  {revealed ? 'إخفاء' : 'عرض'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[12px] text-obsidian/45">
                                غير محفوظ — غيّر الرمز لعرضه
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[13px] text-obsidian/70">
                              {user.require_captain_approval ? '✓ نعم' : '✗ لا'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[13px] text-obsidian/70">
                              {user.customer_free_order ? '✓ نعم' : '✗ لا'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(user)}
                                className="rounded-lg bg-blue-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-600"
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChangePassword(user)}
                                className="rounded-lg bg-yellow-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-yellow-600"
                              >
                                تغيير الرمز
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(user)}
                                disabled={user.id === currentUser?.id || deletingUserId === user.id}
                                className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingUserId === user.id ? 'جاري...' : 'حذف'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-soft-xl bg-white p-6 shadow-soft">
            <h3 className="mb-2 text-[18px] leading-tight font-semibold text-obsidian">
              {editingUser ? 'تعديل بيانات الموظف' : 'إضافة موظف'}
            </h3>
            <p className="mb-6 text-[13px] leading-relaxed text-obsidian/60">
              أدخل الاسم الحقيقي للموظف كما تريد أن يظهر في النظام؛ سيتم استخدامه أيضاً لتسجيل الدخول.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] leading-relaxed font-medium text-obsidian mb-1.5">
                  اسم الموظف
                </label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="مثال: أحمد — نفس الاسم عند تسجيل الدخول"
                  autoComplete="off"
                  className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-1 focus:ring-cyber-aqua"
                />
                <p className="mt-1.5 text-[12px] leading-relaxed text-obsidian/50">
                  لا يوجد حقل منفصل لاسم المستخدم: هذا الاسم هو معرف الدخول واسم الموظف معاً.
                </p>
              </div>

              <div>
                <label className="block text-[13px] leading-relaxed font-medium text-obsidian mb-1.5">
                  الرمز {editingUser && '(اتركه فارغاً للاحتفاظ بالرمز الحالي)'}
                </label>
                {editingUser?.password_plain && !formPassword && (
                  <p className="mb-1.5 text-[12px] text-obsidian/55">
                    الرمز الحالي:{' '}
                    <code className="font-mono" dir="ltr">
                      {editingUser.password_plain}
                    </code>
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="الرمز"
                    autoComplete="new-password"
                    className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-1 focus:ring-cyber-aqua"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword((v) => !v)}
                    className="shrink-0 rounded-soft-lg border border-black/10 px-3 py-2 text-[12px] font-medium text-obsidian/70 hover:bg-cloud-soft-white"
                  >
                    {showFormPassword ? 'إخفاء' : 'عرض'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] leading-relaxed font-medium text-obsidian mb-1.5">
                  الدور
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-1 focus:ring-cyber-aqua"
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {formRole === 'customer' && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="requireCaptainApproval"
                      checked={formRequireCaptainApproval}
                      onChange={(e) => setFormRequireCaptainApproval(e.target.checked)}
                      className="w-4 h-4 text-cyber-aqua focus:ring-cyber-aqua"
                    />
                    <label
                      htmlFor="requireCaptainApproval"
                      className="text-[13px] leading-relaxed text-obsidian cursor-pointer"
                    >
                      يتطلب موافقة الكابتن
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="customerFreeOrder"
                      checked={formCustomerFreeOrder}
                      onChange={(e) => setFormCustomerFreeOrder(e.target.checked)}
                      className="w-4 h-4 text-cyber-aqua focus:ring-cyber-aqua"
                    />
                    <label
                      htmlFor="customerFreeOrder"
                      className="text-[13px] leading-relaxed text-obsidian cursor-pointer"
                    >
                      طلب مجاني
                    </label>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 rounded-soft-lg bg-cyber-aqua px-4 py-2.5 text-[14px] leading-normal font-medium text-white hover:bg-cyber-aqua/90"
                >
                  {editingUser ? 'حفظ التغييرات' : 'إنشاء'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 rounded-soft-lg bg-graphite/10 px-4 py-2.5 text-[14px] leading-normal font-medium text-obsidian hover:bg-graphite/20"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
