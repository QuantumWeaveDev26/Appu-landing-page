/** "+" menu in the ask box: homework photo (camera / gallery), notes file, or pasted notes. */
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, TextInput } from './AppText';
import { theme, tc } from '../theme';

export type AttachChoice = 'camera' | 'library' | 'file';

interface Props {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: AttachChoice) => void;
  onPasteNotes: (text: string) => void;
}

export function AttachSheet({ visible, onClose, onChoose, onPasteNotes }: Props) {
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');

  const close = () => {
    setPasting(false);
    setText('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {pasting ? (
          <>
            <Text style={styles.title}>Paste your notes</Text>
            <Text style={styles.muted}>Appu will teach only from what you paste here.</Text>
            <TextInput
              style={styles.input}
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Paste or type your chapter notes…"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={16000}
              textAlignVertical="top"
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.secondary} onPress={() => setPasting(false)}>
                <Text style={styles.secondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primary, text.trim().length < 20 && styles.off]}
                disabled={text.trim().length < 20}
                onPress={() => {
                  onPasteNotes(text.trim());
                  close();
                }}
              >
                <Text style={styles.primaryText}>Teach me from these notes</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Add to your question</Text>
            <Option icon="📷" title="Take a photo" sub="Snap homework or a textbook page" onPress={() => { close(); onChoose('camera'); }} />
            <Option icon="🖼️" title="Choose a photo" sub="Pick a picture from your gallery" onPress={() => { close(); onChoose('library'); }} />
            <Option icon="📄" title="Upload notes" sub="PDF, Word or text file" onPress={() => { close(); onChoose('file'); }} />
            <Option icon="📝" title="Paste notes" sub="Type or paste your chapter notes" onPress={() => setPasting(true)} />
          </>
        )}
      </View>
    </Modal>
  );
}

function Option({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.optTitle}>{title}</Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: tc('rgba(2,6,15,0.6)', 'b') },
  sheet: { backgroundColor: c.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28, gap: 10, borderWidth: 1, borderColor: c.line },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 6 },
  title: { color: c.text, fontSize: 19, fontFamily: theme.fonts.heading },
  muted: { color: c.textMuted, fontSize: 13, fontFamily: theme.fonts.body },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  icon: { fontSize: 24 },
  optTitle: { color: c.text, fontSize: 16, fontFamily: theme.fonts.bodyBold },
  input: { minHeight: 180, maxHeight: 320, color: c.text, fontSize: 16, fontFamily: theme.fonts.body, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12 },
  row: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: c.cyan, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: tc('#04121f', 't'), fontSize: 15, fontFamily: theme.fonts.bodyBold },
  off: { opacity: 0.4 },
  secondary: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.cyanSoft, fontSize: 15, fontFamily: theme.fonts.bodyBold },
});
