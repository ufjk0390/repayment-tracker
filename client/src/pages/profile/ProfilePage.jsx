import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserCircle, Link2, Unlink, Key, Copy, Clock, Mail, Phone } from 'lucide-react';
import Card, { CardTitle } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loading from '../../components/ui/Loading';
import useAuthStore from '../../stores/authStore';
import { getMe, getPairing, dissolvePairing, createInvite, joinPairing } from '../../services/api';
import { ROLE_LABELS } from '../../utils/constants';
import api from '../../services/api';
import { formatDateTime } from '../../utils/format';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();

  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    monthlyIncome: '',
    monthlyFixedExp: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
  });

  const { data: pairingData } = useQuery({
    queryKey: ['pairing'],
    queryFn: () => getPairing().then((r) => r.data),
  });

  useEffect(() => {
    if (meData?.data) {
      const u = meData.data;
      setProfileForm({
        name: u.name || '',
        phone: u.phone || '',
        monthlyIncome: u.monthlyIncome?.toString() || '',
        monthlyFixedExp: u.monthlyFixedExp?.toString() || '',
      });
    }
  }, [meData]);

  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.put('/auth/profile', data),
    onSuccess: (res) => {
      toast.success('個人資料已更新');
      updateUser(res.data?.data);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '更新失敗'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data) => api.put('/auth/password', data),
    onSuccess: () => {
      toast.success('密碼已變更');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '變更失敗'),
  });

  const dissolveMutation = useMutation({
    mutationFn: dissolvePairing,
    onSuccess: () => {
      toast.success('配對已解除');
      queryClient.invalidateQueries({ queryKey: ['pairing'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '解除失敗'),
  });

  const inviteMutation = useMutation({
    mutationFn: createInvite,
    onSuccess: () => {
      toast.success('邀請碼已產生');
      queryClient.invalidateQueries({ queryKey: ['pairing'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '產生邀請碼失敗'),
  });

  const joinMutation = useMutation({
    mutationFn: joinPairing,
    onSuccess: () => {
      toast.success('配對成功');
      setInviteCodeInput('');
      queryClient.invalidateQueries({ queryKey: ['pairing'] });
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || '配對失敗'),
  });

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('邀請碼已複製');
  };

  const handleJoin = () => {
    if (!inviteCodeInput.trim()) {
      toast.error('請輸入邀請碼');
      return;
    }
    joinMutation.mutate({ inviteCode: inviteCodeInput.trim() });
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      name: profileForm.name,
      phone: profileForm.phone,
      monthlyIncome: profileForm.monthlyIncome ? Number(profileForm.monthlyIncome) : undefined,
      monthlyFixedExp: profileForm.monthlyFixedExp ? Number(profileForm.monthlyFixedExp) : undefined,
    });
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      toast.error('新密碼至少 8 個字元，需包含大小寫字母與數字');
      return;
    }
    if (!/[a-z]/.test(passwordForm.newPassword) || !/[A-Z]/.test(passwordForm.newPassword) || !/[0-9]/.test(passwordForm.newPassword)) {
      toast.error('新密碼需包含大小寫字母與數字');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('新密碼不一致');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleDissolve = () => {
    if (window.confirm('確定要解除配對嗎？此操作無法復原。')) {
      dissolveMutation.mutate();
    }
  };

  const pairing = pairingData?.data;
  const pairingStatus = pairing?.status; // PENDING | ACTIVE | undefined
  const isActive = pairingStatus === 'ACTIVE';
  const isPending = pairingStatus === 'PENDING';
  const isSupervisor = user?.role === 'SUPERVISOR';

  // Partner info (only when ACTIVE)
  const partner = isActive
    ? (isSupervisor ? pairing.user : pairing.supervisor)
    : null;

  if (meLoading) return <Loading />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">個人設定</h1>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <UserCircle className="h-6 w-6 text-indigo-600" />
          <CardTitle>個人資料</CardTitle>
        </div>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-500">角色</span>
            <Badge color="indigo">{ROLE_LABELS[user?.role]}</Badge>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-500">信箱</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>

          <Input
            label="姓名"
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
          />
          <Input
            label="手機號碼"
            type="tel"
            value={profileForm.phone}
            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
          />
          <Input
            label="每月收入"
            type="number"
            min="0"
            value={profileForm.monthlyIncome}
            onChange={(e) => setProfileForm({ ...profileForm, monthlyIncome: e.target.value })}
          />
          <Input
            label="每月固定支出"
            type="number"
            min="0"
            value={profileForm.monthlyFixedExp}
            onChange={(e) => setProfileForm({ ...profileForm, monthlyFixedExp: e.target.value })}
          />

          <Button type="submit" loading={updateProfileMutation.isPending}>
            儲存變更
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link2 className="h-6 w-6 text-indigo-600" />
            <CardTitle>配對狀態</CardTitle>
          </div>
          {isActive ? (
            <Badge color="green">已配對</Badge>
          ) : isPending ? (
            <Badge color="yellow">配對中</Badge>
          ) : (
            <Badge color="gray">尚未配對</Badge>
          )}
        </div>

        {/* ACTIVE: Show partner info */}
        {isActive && partner && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-green-800">
                配對對象：{partner.name}
                <span className="ml-2 text-xs text-green-600">
                  （{isSupervisor ? '當事人' : '監督人'}）
                </span>
              </p>
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Mail className="h-4 w-4" />
                <span>{partner.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Phone className="h-4 w-4" />
                <span>{partner.phone || '未提供'}</span>
              </div>
              {pairing.pairedAt && (
                <p className="text-xs text-green-600 pt-1 border-t border-green-200">
                  配對時間：{formatDateTime(pairing.pairedAt)}
                </p>
              )}
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDissolve}
              loading={dissolveMutation.isPending}
            >
              <Unlink className="h-4 w-4" />
              解除配對
            </Button>
          </div>
        )}

        {/* PENDING (Supervisor view): Show invite code */}
        {isPending && isSupervisor && (
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                請提供以下邀請碼給當事人完成配對
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-2xl font-mono font-bold text-yellow-900 bg-white rounded px-3 py-2 text-center tracking-widest">
                  {pairing.inviteCode}
                </code>
                <button
                  type="button"
                  onClick={() => copyInviteCode(pairing.inviteCode)}
                  className="p-2 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700"
                  title="複製"
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-yellow-700">
                <Clock className="h-3 w-3" />
                <span>
                  有效期限：{pairing.expiresAt ? formatDateTime(pairing.expiresAt) : '24 小時'}
                  {pairing.expired && <span className="ml-2 text-red-600 font-semibold">（已過期）</span>}
                </span>
              </div>
            </div>
            {pairing.expired && (
              <Button
                size="sm"
                onClick={() => inviteMutation.mutate()}
                loading={inviteMutation.isPending}
              >
                重新產生邀請碼
              </Button>
            )}
          </div>
        )}

        {/* No pairing - Supervisor: show generate button */}
        {!pairing && isSupervisor && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              請產生邀請碼，並將邀請碼提供給當事人以完成配對。
            </p>
            <Button
              onClick={() => inviteMutation.mutate()}
              loading={inviteMutation.isPending}
            >
              產生邀請碼
            </Button>
          </div>
        )}

        {/* No pairing - User: show join form */}
        {!pairing && !isSupervisor && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              請向您的監督人取得邀請碼，並輸入以完成配對。
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="輸入邀請碼"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleJoin}
                loading={joinMutation.isPending}
              >
                配對
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Key className="h-6 w-6 text-indigo-600" />
          <CardTitle>變更密碼</CardTitle>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            label="目前密碼"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) =>
              setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
            }
          />
          <Input
            label="新密碼"
            type="password"
            placeholder="至少6個字元"
            value={passwordForm.newPassword}
            onChange={(e) =>
              setPasswordForm({ ...passwordForm, newPassword: e.target.value })
            }
          />
          <Input
            label="確認新密碼"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) =>
              setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
            }
          />
          <Button type="submit" loading={changePasswordMutation.isPending}>
            變更密碼
          </Button>
        </form>
      </Card>
    </div>
  );
}
