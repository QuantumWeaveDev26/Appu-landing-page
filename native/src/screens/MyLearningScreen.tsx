import React from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme, tc } from '../theme';
import { useSavedLessonsStore } from '../stores/savedLessonsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'MyLearning'>;

export function MyLearningScreen({ navigation }: Props) {
  const { items, remove } = useSavedLessonsStore();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} activeOpacity={0.7}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Learning</Text>
        <View style={{ width: 64 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.lesson.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>No saved lessons yet</Text>
            <Text style={styles.muted}>Tap “Save lesson” under any answer and it will wait for you here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Lesson', { lessonId: item.lesson.id })}
            >
              <Text style={styles.cardTitle}>{item.lesson.topic}</Text>
              <Text style={styles.muted} numberOfLines={1}>
                {item.lesson.question}
              </Text>
              <Text style={styles.meta}>
                Saved {new Date(item.savedAt).toLocaleDateString()} · {item.lesson.quiz.length} quiz ·{' '}
                {item.lesson.flashcards.length} cards
              </Text>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => navigation.navigate('Lesson', { lessonId: item.lesson.id })}
              >
                <Text style={styles.openText}>Study</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeBtn} onPress={() => remove(item.lesson.id)} accessibilityLabel="Remove lesson">
                <Text style={styles.removeText}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 64, paddingVertical: 6 },
  backText: { color: c.cyanSoft, fontSize: 16, fontFamily: theme.fonts.bodyBold },
  title: { color: c.text, fontSize: 20, fontFamily: theme.fonts.heading },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { color: c.text, fontSize: 18, fontFamily: theme.fonts.heading },
  muted: { color: c.textMuted, fontSize: 14, fontFamily: theme.fonts.body, textAlign: 'left' },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  cardTitle: { color: c.text, fontSize: 17, fontFamily: theme.fonts.heading, marginBottom: 2 },
  meta: { color: c.textMuted, fontSize: 12, fontFamily: theme.fonts.body, marginTop: 4 },
  actions: { alignItems: 'center', gap: 8 },
  openBtn: { backgroundColor: c.cyan, borderRadius: 12, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  openText: { color: tc('#04121f', 't'), fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  removeBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 18 },
});
