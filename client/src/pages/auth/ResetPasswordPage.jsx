import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { resetPassword } from '../../services/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';

  const [form, setForm] = useState({
    token: tokenFromUrl,
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.token.trim()) errs.token = '請輸入重設 Token';
    if (!form.newPassword) errs.newPassword = '請輸入新密碼';
    else if (form.newPassword.length < 8) errs.newPassword = '密碼至少 8 個字元';
    else if (!/[a-z]/.test(form.newPassword)) errs.newPassword = '需包含小寫字母';
    else if (!/[A-Z]/.test(form.newPassword)) errs.newPassword = '需包含大寫字母';
    else if (!/[0-9]/.test(form.newPassword)) errs.newPassword = '需包含數字';
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = '密碼不一致';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await resetPassword({
        token: form.token.trim(),
        newPassword: form.newPassword,
      });
      setSuccess(true);
      toast.success('密碼重設成功，請用新密碼登入');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || '重設失敗，Token 可能已過期');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">密碼已重設</h2>
        <p className="text-gray-500">
          您的密碼已成功重設，請用新密碼登入。
        </p>
        <Link
          to="/login"
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700"
        >
          前往登入
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900 text-center">重設密碼</h2>
      <p className="text-sm text-gray-500 text-center">
        輸入您收到的重設 Token 和新密碼
      </p>

      <Input
        label="重設 Token"
        placeholder="貼上您收到的 Token"
        value={form.token}
        onChange={(e) => setForm({ ...form, token: e.target.value })}
        error={errors.token}
      />

      <Input
        label="新密碼"
        type="password"
        placeholder="至少 8 字元，含大小寫與數字"
        value={form.newPassword}
        onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        error={errors.newPassword}
      />

      <Input
        label="確認新密碼"
        type="password"
        placeholder="再次輸入新密碼"
        value={form.confirmPassword}
        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        error={errors.confirmPassword}
      />

      <Button type="submit" loading={loading} className="w-full">
        重設密碼
      </Button>

      <p className="text-center text-sm text-gray-500">
        <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
          返回登入
        </Link>
      </p>
    </form>
  );
}
