import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  getMe,
} from '../services/api';

export default function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setAuth, clearAuth, updateUser } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: loginApi,
    onSuccess: (res) => {
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      toast.success('登入成功');
      navigate('/dashboard');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '登入失敗，請檢查帳號密碼');
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerApi,
    onSuccess: () => {
      toast.success('註冊成功，請登入');
      navigate('/login');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || '註冊失敗');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutApi,
    onSettled: () => {
      clearAuth();
      toast.success('已登出');
      navigate('/login');
    },
  });

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
    enabled: isAuthenticated,
    onSuccess: (data) => {
      if (data?.data) {
        updateUser(data.data);
      }
    },
  });

  const login = useCallback(
    (data) => loginMutation.mutateAsync(data),
    [loginMutation]
  );

  const registerUser = useCallback(
    (data) => registerMutation.mutateAsync(data),
    [registerMutation]
  );

  const logout = useCallback(
    () => logoutMutation.mutate(),
    [logoutMutation]
  );

  return {
    user,
    isAuthenticated,
    login,
    register: registerUser,
    logout,
    loginLoading: loginMutation.isPending,
    registerLoading: registerMutation.isPending,
  };
}
