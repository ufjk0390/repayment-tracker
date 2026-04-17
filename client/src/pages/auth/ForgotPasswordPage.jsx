import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { forgotPassword } from '../../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('請輸入電子信箱');
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPassword({ email });
      setSent(true);
      if (res.data?.data?.devToken) {
        setDevToken(res.data.data.devToken);
      }
      toast.success('重設密碼連結已寄出');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || '發送失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">已寄出</h2>
        <p className="text-gray-500">
          如果您的帳號存在，我們已寄送重設密碼連結至您的信箱。
        </p>
        {devToken && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left">
            <p className="text-xs font-medium text-yellow-700 mb-1">開發模式 Token：</p>
            <code className="text-xs text-yellow-900 break-all">{devToken}</code>
          </div>
        )}
        <Link
          to="/login"
          className="inline-block text-indigo-600 hover:text-indigo-500 font-medium"
        >
          返回登入
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900 text-center">忘記密碼</h2>
      <p className="text-sm text-gray-500 text-center">
        輸入您的電子信箱，我們將寄送重設密碼連結
      </p>

      <Input
        label="電子信箱"
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Button type="submit" loading={loading} className="w-full">
        發送重設連結
      </Button>

      <div className="text-center text-sm text-gray-500 space-y-2">
        <p>
          已有重設 Token？{' '}
          <Link to="/reset-password" className="text-indigo-600 hover:text-indigo-500 font-medium">
            前往重設密碼
          </Link>
        </p>
        <p>
          <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
            返回登入
          </Link>
        </p>
      </div>
    </form>
  );
}
