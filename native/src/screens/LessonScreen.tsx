import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { voiceService } from '../lib/voiceService';
import { getLesson } from '../lessons/lessonApi';
import { StudyModes } from '../lessons/LessonViews';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;

/** Full-screen lesson (opened from My Learning). */
export function LessonScreen({ navigation, route }: Props) {
  const lesson = getLesson(route.params.lessonId);

  useEffect(() => {
    voiceService.stopPlayback();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <Header title={lesson ? lesson.topic : 'Lesson'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {lesson ? (
          <StudyModes lesson={lesson} initialMode={route.params.mode} />
        ) : (
          <Text style={styles.muted}>This lesson is no longer available. Ask Appu again to rebuild it.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 64 }} />
    </View>
  );
}


const c = theme.colors;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40 },
  muted: { color: c.textMuted, fontSize: 15, fontFamily: theme.fonts.body },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 64, paddingVertical: 6 },
  backText: { color: c.cyanSoft, fontSize: 16, fontFamily: theme.fonts.bodyBold },
  headerTitle: { flex: 1, color: c.text, fontSize: 18, fontFamily: theme.fonts.heading, textAlign: 'center' },
});
