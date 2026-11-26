/**
 * Parental screen-time lock (website parental-controls-ui.js). The app reports study time to
 * the server; when the parent's limit is reached the server says `locked` and a parent unlocks
 * with a one-time code sent to their WhatsApp. If the server has the feature switched off
 * (`enabled: false`) nothing is ever shown.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from './AppText';
import { theme, tc } from '../theme';
import { config } from '../config';

const HEARTBEAT_MS = 30000;
const sessionId = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

async function call(path: string, accessToken: string, method: 'GET' | 'POST', body?: object) {
  try {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

interface Props {
  accessToken?: string | null;
  childId?: string | null;
  onAddPhone: () => void;
}

export function ParentalLock({ accessToken, childId, onAddPhone }: Props) {
  const [locked, setLocked] = useState(false);
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [needsPhone, setNeedsPhone] = useState(false);
  const last = useRef(Date.now());
  const visible = useRef(true);

  useEffect(() => {
    if (!accessToken || !childId) return;
    let stopped = false;

    const beat = async () => {
      const now = Date.now();
      const ms = now - last.current;
      last.current = now;
      const res = await call('/api/appu/session/heartbeat', accessToken, 'POST', {
        sessionId,
        childId,
        activeMsSinceLast: visible.current ? ms : 0,
        awayMsSinceLast: visible.current ? 0 : ms,
        visibility: visible.current ? 'visible' : 'hidden',
      });
      if (stopped || !res || res.enabled !== true) return;
      if (res.locked) setLocked(true);
    };

    const timer = setInterval(beat, HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (state) => {
      void beat(); // close out the time spent in the previous state
      visible.current = state === 'active';
    });
    void beat();
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [accessToken, childId]);

  const requestCode = async () => {
    if (!accessToken || !childId) return;
    setBusy(true);
    setNotice('');
    const res = await call('/api/appu/session/otp/request', accessToken, 'POST', { sessionId, childId });
    setBusy(false);
    if (res?.requested) {
      setStep('verify');
      setNotice("We sent a 6-digit code to the parent's WhatsApp.");
    } else if (res?.needsPhone) {
      setNeedsPhone(true);
      setNotice("Add the parent's WhatsApp number in Parent Zone to get unlock codes.");
    } else if (res?.error === 'rate_limited') {
      setNotice('Too many codes requested. Please wait a few minutes and try again.');
    } else {
      setNotice('Could not send the code right now. Please try again.');
    }
  };

  const verify = async () => {
    if (!accessToken || !childId || code.trim().length !== 6) return;
    setBusy(true);
    const res = await call('/api/appu/session/otp/verify', accessToken, 'POST', { sessionId, childId, code: code.trim() });
    setBusy(false);
    if (res?.verified) {
      setStep('success');
      setTimeout(() => {
        setLocked(false);
        setStep('request');
        setCode('');
        setNotice('');
        last.current = Date.now();
      }, 1500);
    } else if (res?.lockedOut) {
      setStep('request');
      setCode('');
      setNotice('Too many wrong codes. Ask for a new code.');
    } else {
      setNotice(
        typeof res?.attemptsLeft === 'number'
          ? `That code didn't match. ${res.attemptsLeft} tries left.`
          : 'That code didn\'t match or has expired.'
      );
    }
  };

  return (
    <Modal visible={locked} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          {step === 'success' ? (
            <>
              <Text style={styles.big}>🎉</Text>
              <Text style={styles.title}>Session unlocked!</Text>
              <Text style={styles.muted}>Happy learning. Take a short stretch break first!</Text>
            </>
          ) : (
            <>
              <Text style={styles.big}>⏰</Text>
              <Text style={styles.title}>Time for a break</Text>
              <Text style={styles.muted}>
                You've reached today's study time. A parent can unlock more time with a code sent to their WhatsApp.
              </Text>
              {step === 'verify' && (
                <TextInput
                  style={styles.code}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="6-digit code"
                  placeholderTextColor={theme.colors.textMuted}
                  maxLength={6}
                />
              )}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {busy ? (
                <ActivityIndicator color={theme.colors.cyan} />
              ) : step === 'verify' ? (
                <>
                  <TouchableOpacity style={[styles.primary, code.length !== 6 && styles.off]} onPress={verify} disabled={code.length !== 6}>
                    <Text style={styles.primaryText}>Unlock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondary} onPress={requestCode}>
                    <Text style={styles.secondaryText}>Send a new code</Text>
                  </TouchableOpacity>
                </>
              ) : needsPhone ? (
                <TouchableOpacity style={styles.primary} onPress={onAddPhone}>
                  <Text style={styles.primaryText}>Add parent's WhatsApp number</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.primary} onPress={requestCode}>
                  <Text style={styles.primaryText}>Send code to parent</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: tc('rgba(2,6,15,0.85)', 'b'), alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: c.bgElevated, borderRadius: 24, padding: 22, gap: 12, borderWidth: 1, borderColor: c.line, alignItems: 'stretch' },
  big: { fontSize: 44, textAlign: 'center' },
  title: { color: c.text, fontSize: 22, fontFamily: theme.fonts.heading, textAlign: 'center' },
  muted: { color: c.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  notice: { color: c.cyanSoft, fontSize: 14, textAlign: 'center' },
  code: { color: c.text, fontSize: 26, letterSpacing: 8, textAlign: 'center', backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, minHeight: 56 },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: c.cyan, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: tc('#04121f', 't'), fontSize: 16, fontFamily: theme.fonts.bodyBold },
  off: { opacity: 0.4 },
  secondary: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.cyanSoft, fontSize: 15, fontFamily: theme.fonts.bodyBold },
});
