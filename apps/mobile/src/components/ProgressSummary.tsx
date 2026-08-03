import { StyleSheet, Text, View } from 'react-native';
import { Card } from './ui';
import { colors } from '../theme';

export function ProgressSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <Card>
      <View style={styles.grid}>
        {items.map((item, index) => (
          <View
            key={item.label}
            style={[
              styles.item,
              items.length <= 3 && styles.itemThird,
              index > 0 && styles.itemBorder,
            ]}
          >
            <Text style={styles.value}>{item.value}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    width: '50%',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  itemThird: {
    width: '33.333%',
  },
  itemBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  value: {
    color: colors.textStrong,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
    textAlign: 'center',
  },
});
