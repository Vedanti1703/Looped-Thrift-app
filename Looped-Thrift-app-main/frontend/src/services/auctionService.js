import api from './api';

export const getAuctions = async (status) => {
  const url = status && status !== 'all' ? `/auction?status=${status}` : '/auction';
  const res = await api.get(url);
  return res.data;
};

export const getAuction = async (id) => {
  const res = await api.get(`/auction/${id}`);
  return res.data;
};

export const createAuction = async (data) => {
  const res = await api.post('/auction', data);
  return res.data;
};

export const placeBid = async (auctionId, amount) => {
  const res = await api.post(`/auction/${auctionId}/bid`, { amount });
  return res.data;
};

export const getMyAuctions = async () => {
  const res = await api.get('/auction/mine');
  return res.data;
};
