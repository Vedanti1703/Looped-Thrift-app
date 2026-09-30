import api from './api';

export const createOffer = async (productId, offeredPrice, message) => {
  const res = await api.post('/bargain/offer', { productId, offeredPrice, message });
  return res.data;
};

export const respondToOffer = async (bargainId, action, counterPrice) => {
  const res = await api.put(`/bargain/respond/${bargainId}`, { action, counterPrice });
  return res.data;
};

export const getMyOffers = async (productId) => {
  const url = productId ? `/bargain/mine?productId=${productId}` : '/bargain/mine';
  const res = await api.get(url);
  return res.data;
};
