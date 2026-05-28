import React from 'react';
import { View, Text } from 'react-native';

export default function ScheduleScreen() {
  return (
    <View className="flex-1 bg-slate-50 p-6 justify-center items-center">
      <Text className="text-2xl font-bold text-slate-900">Schedule</Text>
      <Text className="text-slate-500 mt-2 text-center">Your calendar integration will appear here.</Text>
    </View>
  );
}
