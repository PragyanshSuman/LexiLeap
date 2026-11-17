import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { moodLabelKey, MOODS } from '@/components/MoodCheckIn';
import { translate } from '@/i18n';
import { LOWERCASE, UPPERCASE } from '@/content/letters';
import { summarizeResults } from '@/engine/assessment';
import { summarizeSpelling, type SpellingFlag } from '@/engine/spelling';
import { ACTIVITIES, ACTIVITY_ORDER, SKILL_ORDER, SKILLS } from '@/engine/catalog';
import { topConfusions } from '@/engine/progress';
import { currentStreak } from '@/engine/streak';
import type { Assessment } from '@/engine/types';
import { dayKey, formatDay, formatDuration, lastDays } from '@/lib/date';
import { shareAssessmentReport, shareReport, summarize } from '@/services/report';
import { soundOf } from '@/speech/phonemes';
import { useAppStore, useProgress } from '@/store/appStore';
import type { Profile } from '@/store/profile';
import { useParentSession } from '@/store/parentSession';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ChoiceChips, ProgressBar, SectionTitle } from '@/ui/controls';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

export default function ParentDashboard() {
  const { colors, space } = useTheme();
  const profiles = useAppStore((s) => s.profiles);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const lock = useParentSession((s) => s.lock);
  const [selectedId, setSelectedId] = useState(activeProfileId ?? profiles[0]?.id);
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0];
  const progress = useProgress(profile?.id);
  const [sharing, setSharing] = useState(false);

  const leave = () => {
    lock();
    router.dismissTo(activeProfileId ? '/home' : '/login');
  };

  if (!profile) {
    return (
      <Screen header={<Header title="Parent zone" onBack={leave} />}>
        <AppText muted>No children yet.</AppText>
        <Button label="Add a child" icon="person-add" onPress={() => router.push({ pathname: '/register', params: { from: 'parent' } })} />
      </Screen>
    );
  }

  const today = dayKey();
  const week = summarize(progress, 7);
  const plan = progress.plan?.day === today ? progress.plan : null;
  const recent = [...progress.sessions].reverse().slice(0, 10);
  const moodDays = lastDays(7, today);
  const mixUps = topConfusions(progress);
  const weekDays = new Set(lastDays(7, today));
  const practice = summarizeResults(progress.speechChecks.filter((c) => weekDays.has(c.day)));
  const assessments = [...progress.assessments].reverse();
  const letters = progress.writing.filter((l) => weekDays.has(l.day));

  const exportReport = async () => {
    setSharing(true);
    try {
      await shareReport(profile, progress);
    } catch (e) {
      Alert.alert('Could not create the report', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen
      scroll
      header={
        <Header
          title="Parent zone"
          subtitle="All data stays on this device"
          onBack={leave}
          right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/parent/settings')} />}
        />
      }
    >
      {profiles.length > 1 ? (
        <ChoiceChips accessibilityLabel="Child" value={profile.id} onChange={setSelectedId} options={profiles.map((p) => ({ value: p.id, label: `${p.avatar} ${p.name}` }))} />
      ) : null}

      <SectionTitle>{`${profile.name}'s week`}</SectionTitle>
      <View style={[styles.stats, { gap: space(3) }]}>
        <Stat label="activities" value={String(week.sessions.length)} />
        <Stat label="time learning" value={formatDuration(week.seconds)} />
        <Stat label="accuracy" value={week.accuracy === null ? '–' : `${Math.round(week.accuracy * 100)}%`} />
        <Stat label="day streak" value={String(currentStreak(progress.streak, today))} />
      </View>

      <SectionTitle>Today&apos;s plan</SectionTitle>
      <Card style={{ gap: space(2) }}>
        {plan ? (
          <>
            {plan.items.map((item, i) => (
              <AppText key={`${item.activityId}-${i}`}>
                {item.done ? '✅' : '⬜️'} {ACTIVITIES[item.activityId].title}
              </AppText>
            ))}
            <AppText variant="caption" muted style={{ marginTop: space(2) }}>
              Why: {plan.reason}
            </AppText>
          </>
        ) : (
          <AppText muted>The plan is created when {profile.name} opens the app today.</AppText>
        )}
      </Card>

      <SectionTitle>Skills</SectionTitle>
      <Card style={{ gap: space(4) }}>
        {SKILL_ORDER.map((id) => {
          const mastery = progress.skills[id];
          return (
            <View key={id} style={{ gap: space(1) }} accessible accessibilityLabel={`${SKILLS[id].label}: ${mastery === undefined ? 'not tried yet' : `${Math.round(mastery)} out of 100`}`}>
              <View style={styles.between}>
                <AppText variant="label">
                  {SKILLS[id].emoji} {SKILLS[id].label}
                </AppText>
                <AppText variant="caption" muted>
                  {mastery === undefined ? 'Not tried yet' : `${Math.round(mastery)} / 100`}
                </AppText>
              </View>
              <ProgressBar value={(mastery ?? 0) / 100} />
              <AppText variant="caption" muted>
                {SKILLS[id].description}
              </AppText>
            </View>
          );
        })}
      </Card>

      <SectionTitle>Activities</SectionTitle>
      <Card style={{ gap: space(3) }}>
        {ACTIVITY_ORDER.map((id) => {
          const a = progress.activities[id];
          return (
            <View key={id} style={styles.between}>
              <View style={styles.flex}>
                <AppText variant="label">
                  {ACTIVITIES[id].emoji} {ACTIVITIES[id].title}
                </AppText>
                <AppText variant="caption" muted>
                  {a ? `Level ${a.level}: ${ACTIVITIES[id].levels[a.level]}` : 'Not played yet'}
                </AppText>
              </View>
              <AppText variant="caption" muted>
                {a ? `${a.sessions}×` : ''}
              </AppText>
            </View>
          );
        })}
      </Card>

      <SectionTitle>Letter tracing</SectionTitle>
      <Card style={{ gap: space(2) }}>
        {[UPPERCASE, LOWERCASE].map((set) => (
          <View key={set[0]} style={styles.letters}>
            {set.map((glyph) => {
              const best = progress.letters[glyph]?.best;
              const bg = best === undefined ? colors.surfaceAlt : best >= 0.8 ? colors.successSoft : best >= 0.5 ? colors.warningSoft : colors.dangerSoft;
              return (
                <View key={glyph} style={[styles.letter, { backgroundColor: bg }]}>
                  <AppText variant="caption" weight="bold" muted={best === undefined}>
                    {glyph}
                  </AppText>
                </View>
              );
            })}
          </View>
        ))}
        <AppText variant="caption" muted>
          Green: confident · Yellow: getting there · Pink: needs practice · Grey: not traced yet
        </AppText>
      </Card>

      <SectionTitle>Letter mix-ups</SectionTitle>
      <Card style={{ gap: space(3) }}>
        {mixUps.length === 0 ? (
          <AppText muted>No look-alike mix-ups noticed yet.</AppText>
        ) : (
          mixUps.map(({ pair, count }) => (
            <View key={pair.join('|')} style={styles.between} accessible accessibilityLabel={`${pair[0]} and ${pair[1]} mixed up ${count} times`}>
              <AppText variant="heading">
                {pair[0]} ↔ {pair[1]}
              </AppText>
              <AppText variant="caption" muted>
                {count} time{count === 1 ? '' : 's'}
              </AppText>
            </View>
          ))
        )}
        <AppText variant="caption" muted>
          Mixing up look-alike letters (b/d, p/q) and reversible words (was/saw) is common while learning to read, and
          a key thing to watch with dyslexia. Odd One Out, Letter Hunt and Letter Trace practise exactly these.
        </AppText>
      </Card>

      <SectionTitle>Speech & writing</SectionTitle>
      <Card style={{ gap: space(3) }}>
        {assessments.length === 0 ? (
          <AppText muted>No tests yet. {profile.name} can take the Speech Test or Write Test from Clinical Tools on the home screen.</AppText>
        ) : (
          assessments.map((a) => <AssessmentRow key={a.id} profile={profile} assessment={a} />)
        )}
        <AppText variant="caption" muted>
          {practice.wordsTotal === 0
            ? 'No Say It Right practice this week.'
            : `Say It Right this week: ${practice.wordsRight} of ${practice.wordsTotal} words right${
                practice.trickySounds.length ? `. Tricky sounds: ${practice.trickySounds.slice(0, 5).map(({ phoneme }) => soundOf(phoneme).sound).join(', ')}` : ''
              }.`}
        </AppText>
        <AppText variant="caption" muted>
          {letters.length === 0
            ? 'No Write & Score practice this week.'
            : `Write & Score this week: ${letters.filter((l) => l.correct).length} of ${letters.length} letters right${
                letters.some((l) => l.reversal) ? `, ${letters.filter((l) => l.reversal).length} written reversed` : ''
              }.`}
        </AppText>
      </Card>

      <SectionTitle>Wellbeing</SectionTitle>
      <Card style={{ gap: space(3) }}>
        <View style={styles.between}>
          {moodDays.map((d) => {
            const mood = MOODS.find((m) => m.mood === progress.moods[d]);
            return (
              <View key={d} style={styles.moodDay} accessible accessibilityLabel={`${formatDay(d)}: ${mood ? translate('en', moodLabelKey(mood.mood)) : 'no check-in'}`}>
                <AppText size={22} style={{ lineHeight: 30 }}>
                  {mood?.emoji ?? '·'}
                </AppText>
                <AppText variant="caption" muted size={11}>
                  {formatDay(d).split(' ')[0]}
                </AppText>
              </View>
            );
          })}
        </View>
        <AppText variant="caption" muted>
          {week.struggles === 0
            ? 'No moments of struggle noticed this week.'
            : `${week.struggles} moment${week.struggles === 1 ? '' : 's'} of struggle this week (several misses in a row or very quick taps). Each time, ${profile.name} was offered a calm break or an easier level.`}
        </AppText>
      </Card>

      <SectionTitle>Recent sessions</SectionTitle>
      <Card style={{ gap: space(3) }}>
        {recent.length === 0 ? (
          <AppText muted>No sessions yet.</AppText>
        ) : (
          recent.map((s) => (
            <View key={s.id} style={styles.between}>
              <View style={styles.flex}>
                <AppText variant="label">{ACTIVITIES[s.activityId].title}</AppText>
                <AppText variant="caption" muted>
                  {formatDay(s.day)} · Level {s.level} · {formatDuration(s.durationSec)}
                  {s.avgResponseSec !== undefined ? ` · ${s.avgResponseSec.toFixed(1)} s per answer` : ''}
                </AppText>
              </View>
              <AppText variant="label">{Math.round(s.accuracy * 100)}%</AppText>
            </View>
          ))
        )}
      </Card>

      <View style={{ gap: space(3), marginTop: space(6) }}>
        <Button label="Share PDF report" icon="document-text" loading={sharing} onPress={exportReport} />
        <Button label={`${profile.name}'s settings`} icon="options" variant="secondary" onPress={() => router.push({ pathname: '/parent/child/[id]', params: { id: profile.id } })} />
      </View>
    </Screen>
  );
}

const FLAG_TEXT: Record<SpellingFlag, string> = { 'on-track': 'on track', monitor: 'worth monitoring', 'high-risk': 'needs support' };

function describeAssessment(assessment: Assessment): { title: string; detail: string } {
  if (assessment.kind === 'speech') {
    const summary = summarizeResults(assessment.items);
    return {
      title: `🩺 Speech: ${summary.wordsRight} / ${summary.wordsTotal} words${summary.soundAccuracy === null ? '' : ` · ${Math.round(summary.soundAccuracy * 100)}% of sounds`}`,
      detail: `${assessment.method === 'auto' ? 'scored by the app' : 'marked by an adult'}${
        summary.trickySounds.length ? ` · practise ${summary.trickySounds.slice(0, 3).map(({ phoneme }) => soundOf(phoneme).sound).join(', ')}` : ''
      }`,
    };
  }
  const summary = summarizeSpelling(assessment.items);
  return {
    title: `✍️ Spelling: ${summary.wordsRight} / ${summary.wordsTotal} words · ${Math.round(summary.accuracy * 100)}%`,
    detail: `${FLAG_TEXT[summary.flag]}${summary.errorCounts.reversal ? ` · ${summary.errorCounts.reversal} reversal${summary.errorCounts.reversal === 1 ? '' : 's'}` : ''}`,
  };
}

function AssessmentRow({ profile, assessment }: { profile: Profile; assessment: Assessment }) {
  const [sharing, setSharing] = useState(false);
  const { title, detail } = describeAssessment(assessment);
  const share = async () => {
    setSharing(true);
    try {
      await shareAssessmentReport(profile, assessment);
    } catch (e) {
      Alert.alert('Could not create the report', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  };
  return (
    <View style={styles.between}>
      <View style={styles.flex}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" muted>
          {formatDay(dayKey(new Date(assessment.takenAt)))} · {detail}
        </AppText>
      </View>
      <Button label="PDF" icon="share-outline" compact variant="secondary" loading={sharing} onPress={share} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <AppText variant="heading" center>
        {value}
      </AppText>
      <AppText variant="caption" muted center>
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { flexBasis: '46%', flexGrow: 1, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1 },
  letters: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  letter: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  moodDay: { alignItems: 'center', flex: 1 },
});
