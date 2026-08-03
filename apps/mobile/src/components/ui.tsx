import { ReactElement, ReactNode } from 'react';
import {
  Pressable,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, ChevronRight, Home, Mic, Settings } from 'lucide-react-native';
import { colors, radii, shadow } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function MainScreen({
  active,
  children,
  refreshControl,
  contentStyle,
}: {
  active: MainTabKey;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={styles.mainRoot}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[styles.mainContent, contentStyle]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <BottomNav active={active} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.secondaryButtonText,
          variant === 'danger' && styles.dangerButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.activePill]}>
      <Text style={[styles.pillText, active && styles.activePillText]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {icon}
    </Pressable>
  );
}

export function ActionRow({
  title,
  subtitle,
  icon,
  onPress,
  tone = 'blue',
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onPress: () => void;
  tone?: 'blue' | 'green' | 'warm';
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View
        style={[
          styles.actionIcon,
          tone === 'green' && styles.actionIconGreen,
          tone === 'warm' && styles.actionIconWarm,
        ]}
      >
        {icon}
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={20} color={colors.subtle} strokeWidth={2.4} />
    </Pressable>
  );
}

export type MainTabKey = 'home' | 'recordings' | 'progress' | 'settings';

const mainTabs = [
  { key: 'home', label: '训练', href: '/', Icon: Home },
  { key: 'recordings', label: '录音', href: '/recordings', Icon: Mic },
  { key: 'progress', label: '进展', href: '/progress', Icon: BarChart3 },
  { key: 'settings', label: '设置', href: '/settings', Icon: Settings },
] as const;

function BottomNav({ active }: { active: MainTabKey }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {mainTabs.map((tab) => {
        const selected = active === tab.key;
        const Icon = tab.Icon;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) router.replace(tab.href as never);
            }}
            style={({ pressed }) => [styles.navItem, pressed && !selected && styles.pressed]}
          >
            <Icon size={23} color={selected ? colors.accent : colors.subtle} strokeWidth={selected ? 2.7 : 2.25} />
            <Text style={[styles.navText, selected && styles.navTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  mainRoot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mainScroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    marginBottom: 12,
    ...shadow,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  button: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginVertical: 5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.accentDark,
  },
  dangerButton: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F4B8B1',
  },
  dangerButtonText: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  pill: {
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  activePill: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  activePillText: {
    color: '#FFFFFF',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  actionRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: 12,
  },
  actionIconGreen: {
    backgroundColor: colors.successSoft,
  },
  actionIconWarm: {
    backgroundColor: colors.warmSoft,
  },
  actionText: {
    flex: 1,
    paddingRight: 8,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  navWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  navTextActive: {
    color: colors.accent,
  },
});
