import { api } from ".";

export const getBankList = async () => {
  const res = await api.get("/banks");
  return res.data?.data || [];
};

export const verifyBank = async (account_number, bank_code) => {
  const res = await api.post("/verify-bank", { account_number, bank_code });
  return res.data;
};

export const submitKyc = async (formData) => {
  const res = await api.post("/kyc/submit", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const submitBusinessKyc = async (formData) => {
  const res = await api.post("/kyc-corporate/submit", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export const fetchKyc = async () => {
  const res = await api.get("/kyc/fetch");
  return res.data;
};

export const fetchDonations = async () => {
  const res = await api.get("/donation/in"); 
  return res.data;
};

export const fetchDonationStats = async () => {
  const res = await api.get("/donation/stats"); 
  return res.data;
};