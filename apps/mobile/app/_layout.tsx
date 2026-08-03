import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initDatabase } from '../src/db/database';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDatabase().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="session/start" options={{ title: '生成本次训练' }} />
      <Stack.Screen name="session/run" options={{ title: '跟练' }} />
      <Stack.Screen name="session/review" options={{ title: '训练复盘' }} />
      <Stack.Screen name="recordings/index" options={{ headerShown: false }} />
      <Stack.Screen name="recordings/detail" options={{ title: '录音详情' }} />
      <Stack.Screen name="progress/index" options={{ headerShown: false }} />
      <Stack.Screen name="ai/index" options={{ title: 'AI 辅助' }} />
      <Stack.Screen name="ai/weekly" options={{ title: 'AI 周复盘' }} />
      <Stack.Screen name="ai/script" options={{ title: '训练稿生成' }} />
      <Stack.Screen name="settings/index" options={{ headerShown: false }} />
    </Stack>
  );
}
