import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { ROLES } from '../../utils/constants';

export default function RegisterPage() {
  const { register, registerLoading } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    role: 'USER',
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name) errs.name = '請輸入姓名';
    if (!form.email) errs.email = '請輸入電子信箱';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = '電子信箱格式錯誤';
    if (!form.password) errs.password = '請輸入密碼';
    else if (form.password.length < 8) errs.password = '密碼至少8個字元，需包含大小寫字母與數字';
    if (form.password !== form.confirmPassword) errs.confirmPassword = '密碼不一致';
    if (!form.role) errs.role = '請選擇角色';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const { confirmPassword, ...data } = form;
    try {
      await register(data);
    } catch {
      // error handled in hook
    }
  };

  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900 text-center">註冊</h2>

      <Input
        label="姓名"
        placeholder="請輸入姓名"
        value={form.name}
        onChange={(e) => update('name', e.target.value)}
        error={errors.name}
      />

      <Input
        label="電子信箱"
        type="email"
        placeholder="your@email.com"
        value={form.email}
        onChange={(e) => update('email', e.target.value)}
        error={errors.email}
      />

      <Input
        label="手機號碼"
        type="tel"
        placeholder="09xxxxxxxx"
        value={form.phone}
        onChange={(e) => update('phone', e.target.value)}
        error={errors.phone}
      />

      <Select
        label="角色"
        options={ROLES}
        value={form.role}
        onChange={(e) => update('role', e.target.value)}
        error={errors.role}
      />

      <Input
        label="密碼"
        type="password"
        placeholder="至少8字元，含大小寫與數字"
        value={form.password}
        onChange={(e) => update('password', e.target.value)}
        error={errors.password}
      />

      <Input
        label="確認密碼"
        type="password"
        placeholder="再次輸入密碼"
        value={form.confirmPassword}
        onChange={(e) => update('confirmPassword', e.target.value)}
        error={errors.confirmPassword}
      />

      <Button type="submit" loading={registerLoading} className="w-full">
        註冊
      </Button>

      <p className="text-center text-sm text-gray-500">
        已有帳號？{' '}
        <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
          登入
        </Link>
      </p>
    </form>
  );
}
