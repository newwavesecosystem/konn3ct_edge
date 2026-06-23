import { apiClient } from './client';

export interface ProfileData {
  user?: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    referral_code?: string;
    [key: string]: any;
  };
  user_plan?: {
    name?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export async function fetchProfile(): Promise<ProfileData | null> {
  const res = await apiClient.get('/profile');
  return res.data?.data || null;
}

export async function updateProfile(data: { firstname: string; lastname: string; phone: string }) {
  const formData = new FormData();
  formData.append('firstname', data.firstname);
  formData.append('lastname', data.lastname);
  formData.append('phone', data.phone);

  const res = await apiClient.post('/update-profile', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function updatePassword(data: { current_password: string; new_password: string }) {
  // Postman says PUT /update-password, raw JSON
  const res = await apiClient.put('/update-password', data);
  return res.data;
}
