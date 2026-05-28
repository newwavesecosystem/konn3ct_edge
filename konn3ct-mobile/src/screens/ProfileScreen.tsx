import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <View className="flex-1 bg-slate-50 p-6 items-center">
      <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mt-10 mb-4">
        <Text className="text-blue-600 text-3xl font-bold">{user?.name?.charAt(0) || 'U'}</Text>
      </View>
      <Text className="text-2xl font-bold text-slate-900">{user?.name || 'User'}</Text>
      <Text className="text-slate-500">{user?.email || 'Pro Plan'}</Text>

      <TouchableOpacity className="w-full bg-white border border-slate-200 p-4 rounded-xl mt-10 items-center">
        <Text className="text-slate-800 font-bold">Manage Billing</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="w-full bg-red-50 border border-red-200 p-4 rounded-xl mt-4 items-center"
        onPress={logout}
      >
        <Text className="text-red-600 font-bold">Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}
