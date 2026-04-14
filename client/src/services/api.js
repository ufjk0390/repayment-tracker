import axios from 'axios';
import useAuthStore from '../stores/authStore';

const api = axios.create({
  baseURL: 'http://localhost:3001/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          'http://localhost:3001/api/v1/auth/refresh',
          {},
          { withCredentials: true }
        );
        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const refreshToken = () => api.post('/auth/refresh');
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');
export const forgotPassword = (data) => api.post('/auth/forgot-password', data);
export const resetPassword = (data) => api.post('/auth/reset-password', data);

// Pairing
export const createInvite = () => api.post('/pairing/invite');
export const joinPairing = (data) => api.post('/pairing/join', data);
export const getPairing = () => api.get('/pairing');
export const dissolvePairing = () => api.post('/pairing/dissolve');

// Transactions
export const getTransactions = (params) => api.get('/transactions', { params });
export const createTransaction = (data) => api.post('/transactions', data);
export const getTransaction = (id) => api.get(`/transactions/${id}`);
export const updateTransaction = (id, data) => api.put(`/transactions/${id}`, data);
export const deleteTransaction = (id) => api.delete(`/transactions/${id}`);
export const reviewTransaction = (id, data) => api.patch(`/transactions/${id}/review`, data);
export const batchReview = (data) => api.post('/transactions/batch-review', data);

// Categories
export const getCategories = () => api.get('/categories');
export const createCategory = (data) => api.post('/categories', data);

// Debts
export const getDebts = () => api.get('/debts');
export const createDebt = (data) => api.post('/debts', data);
export const getDebt = (id) => api.get(`/debts/${id}`);
export const updateDebt = (id, data) => api.put(`/debts/${id}`, data);
export const deleteDebt = (id) => api.delete(`/debts/${id}`);
export const getDebtPayments = (id) => api.get(`/debts/${id}/payments`);

// Plans
export const getPlans = () => api.get('/plans');
export const createPlan = (data) => api.post('/plans', data);
export const getPlan = (id) => api.get(`/plans/${id}`);
export const updatePlan = (id, data) => api.put(`/plans/${id}`, data);
export const getPlanProgress = (id) => api.get(`/plans/${id}/progress`);

// Budget
export const getBudgets = (params) => api.get('/budgets', { params });
export const createBudget = (data) => api.post('/budgets', data);
export const updateBudget = (id, data) => api.put(`/budgets/${id}`, data);
export const deleteBudget = (id) => api.delete(`/budgets/${id}`);
export const getBudgetSummary = (params) => api.get('/budgets/summary', { params });

// Dashboard
export const getDashboardSummary = () => api.get('/dashboard/summary');

// Upload
export const uploadFile = (formData) => api.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

// Reports
export const exportTransactionsCsv = (params) => api.get('/reports/export', {
  params: { ...params, format: 'csv' },
  responseType: 'blob',
});
export const getMonthlyReport = (params) => api.get('/reports/monthly', { params });

// Notifications
export const getNotifications = (params) => api.get('/notifications', { params });
export const markAsRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllAsRead = () => api.patch('/notifications/read-all');
export const getUnreadCount = () => api.get('/notifications/unread-count');

export default api;
