import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function LoginPage() {
  const { login, loginLoading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.email) errs.email = '請輸入電子信箱';
    if (!form.password) errs.password = '請輸入密碼';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await login(form);
    } catch {
      // error handled in hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900 text-center">登入</h2>

      <Input
        label="電子信箱"
        type="email"
        placeholder="your@email.com"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email}
      />

      <Input
        label="密碼"
        type="password"
        placeholder="請輸入密碼"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password}
      />

      <Button type="submit" loading={loginLoading} className="w-full">
        登入
      </Button>

      <div className="text-center text-sm text-gray-500 space-y-2">
        <p>
          <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-500 font-medium">
            忘記密碼？
          </Link>
        </p>
        <p>
          還沒有帳號？{' '}
          <Link to="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">
            註冊
          </Link>
        </p>
      </div>
    </form>
  );
}
