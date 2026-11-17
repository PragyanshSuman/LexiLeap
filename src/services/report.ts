import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BADGES } from '@/engine/badges';
import { ACTIVITIES, ACTIVITY_ORDER, SKILL_ORDER, SKILLS } from '@/engine/catalog';
import { topConfusions } from '@/engine/progress';
import { currentStreak } from '@/engine/streak';
import { summarizeResults } from '@/engine/assessment';
import { ACTIVE_SCORE, STUDIOS, summarizeFocus, type FocusFeature } from '@/engine/focus';
import { spellingRecommendations, summarizeSpelling, TRICKY_WORDS, type SpellingFlag } from '@/engine/spelling';
import type { Assessment, Mood, ProgressState, SpeechAssessment, SpellingAssessment, SpellingError } from '@/engine/types';
import { UPPERCASE, LOWERCASE } from '@/content/letters';
import { dayKey, formatDay, formatDuration, lastDays } from '@/lib/date';
import { escapeHtml } from '@/lib/text';
import { soundOf } from '@/speech/phonemes';
import type { Profile } from '@/store/profile';
import { masteryScores, riskLevel } from '@/writing/featureExtractor';
import { ALPHABET as MASTERY_LETTERS } from '@/writing/letterPaths';
import { summarizeMastery } from '@/writing/mastery';
import type { SessionFeatureSummary } from '@/writing/types';

const MOOD_LABEL: Record<Mood, string> = { great: 'Great', good: 'Good', okay: 'Okay', tired: 'Tired', upset: 'Upset' };

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Summary numbers for the last `days` days, shared by the dashboard and the PDF. */
export function summarize(progress: ProgressState, days = 7) {
  const window = new Set(lastDays(days));
  const sessions = progress.sessions.filter((s) => window.has(s.day));
  const seconds = [...window].reduce((sum, d) => sum + (progress.usage[d] ?? 0), 0);
  const accuracy = sessions.length ? sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length : null;
  const struggles = sessions.reduce((sum, s) => sum + s.struggles, 0);
  const activeDays = new Set(sessions.map((s) => s.day)).size;
  return { sessions, seconds, accuracy, struggles, activeDays };
}

export function buildReportHtml(profile: Profile, progress: ProgressState): string {
  const today = dayKey();
  const week = summarize(progress, 7);
  const month = summarize(progress, 30);
  const name = escapeHtml(profile.name);

  const skillRows = SKILL_ORDER.map((id) => {
    const mastery = progress.skills[id];
    const value = mastery === undefined ? 'Not tried yet' : `${Math.round(mastery)} / 100`;
    const width = Math.round(mastery ?? 0);
    return `<tr><td><b>${SKILLS[id].label}</b><br><span class="muted">${SKILLS[id].description}</span></td>
      <td class="bar-cell"><div class="bar"><div style="width:${width}%"></div></div>${value}</td></tr>`;
  }).join('');

  const activityRows = ACTIVITY_ORDER.map((id) => {
    const a = progress.activities[id];
    if (!a) return `<tr><td>${ACTIVITIES[id].title}</td><td colspan="3" class="muted">Not played yet</td></tr>`;
    const recent = a.recent.length ? pct(a.recent.reduce((s, v) => s + v, 0) / a.recent.length) : '–';
    return `<tr><td>${ACTIVITIES[id].title}</td><td>Level ${a.level}: ${ACTIVITIES[id].levels[a.level]}</td><td>${a.sessions}</td><td>${recent}</td></tr>`;
  }).join('');

  const letterCell = (glyph: string) => {
    const l = progress.letters[glyph];
    const cls = !l ? 'none' : l.best >= 0.8 ? 'good' : l.best >= 0.5 ? 'ok' : 'weak';
    return `<span class="letter ${cls}">${glyph}</span>`;
  };

  const recentSessions = [...progress.sessions]
    .reverse()
    .slice(0, 15)
    .map(
      (s) =>
        `<tr><td>${formatDay(s.day)}</td><td>${ACTIVITIES[s.activityId].title}</td><td>${s.level}</td><td>${pct(s.accuracy)}</td><td>${s.avgResponseSec !== undefined ? `${s.avgResponseSec.toFixed(1)} s` : '–'}</td><td>${formatDuration(s.durationSec)}</td><td>${s.struggles || ''}</td></tr>`,
    )
    .join('');

  const moods = lastDays(14)
    .filter((d) => progress.moods[d])
    .map((d) => `${formatDay(d)}: ${MOOD_LABEL[progress.moods[d]]}`)
    .join(' · ');

  const mixUps = topConfusions(progress, 8)
    .map(({ pair, count }) => `<b>${escapeHtml(pair[0])} ↔ ${escapeHtml(pair[1])}</b> (${count}×)`)
    .join(' · ');

  const earned = BADGES.filter((b) => progress.badges[b.id]).map((b) => escapeHtml(b.title));

  const monthDays = new Set(lastDays(30, today));
  const focusSummaries = summarizeFocus(progress.focus.filter((s) => monthDays.has(s.day)));
  const focusRows = focusSummaries
    .map((f) => {
      const mix = (Object.entries(f.expressions) as [keyof typeof EXPRESSION_LABEL, number][])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([e, n]) => `${EXPRESSION_LABEL[e]} ${Math.round((n / f.samples) * 100)}%`)
        .join(', ');
      return `<tr><td>${escapeHtml(featureName(f.feature))}</td><td>${f.samples} <span class="muted">(📷 ${f.sources.camera} · ✋ ${f.sources.touch})</span></td><td>${f.concentration}%</td><td>${mix}</td></tr>`;
    })
    .join('');
  const touchReadings = focusSummaries.reduce((sum, f) => sum + f.sources.touch, 0);
  const allReadings = focusSummaries.reduce((sum, f) => sum + f.samples, 0);
  const touchNote = touchReadings > 0 ? `; ${touchReadings} of ${allReadings} readings this month came from touch activity` : '';

  const letters = progress.writing.filter((l) => monthDays.has(l.day));
  const reversedLetters = [...new Set(letters.filter((l) => l.reversal).map((l) => l.letter))];

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #2E2618; margin: 32px; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0; } h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #E4D7C2; padding-bottom: 4px; }
    .muted { color: #6B5D48; font-size: 11px; }
    .stats { display: flex; gap: 12px; margin-top: 16px; }
    .stat { flex: 1; background: #F3EADB; border-radius: 8px; padding: 10px; }
    .stat b { display: block; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; } td, th { text-align: left; padding: 6px 4px; border-bottom: 1px solid #EFE6D6; vertical-align: top; }
    .bar-cell { width: 40%; } .bar { height: 8px; background: #EFE6D6; border-radius: 4px; margin-bottom: 2px; }
    .bar div { height: 8px; background: #1F7A6E; border-radius: 4px; }
    .letter { display: inline-block; width: 22px; text-align: center; margin: 2px; padding: 2px 0; border-radius: 4px; font-weight: bold; }
    .good { background: #CDEBD6; } .ok { background: #F8EACB; } .weak { background: #F7D9CF; } .none { background: #F1ECE3; color: #A89A84; }
  </style></head><body>
    <h1>${name}'s learning report</h1>
    <div class="muted">Generated ${formatDay(today)} · Age ${profile.age} · LexiLeap</div>
    <div class="stats">
      <div class="stat"><b>${week.sessions.length}</b>activities this week</div>
      <div class="stat"><b>${formatDuration(week.seconds)}</b>time this week</div>
      <div class="stat"><b>${week.accuracy === null ? '–' : pct(week.accuracy)}</b>average accuracy</div>
      <div class="stat"><b>${currentStreak(progress.streak, today)}</b>day streak (best ${progress.streak.best})</div>
    </div>
    <p class="muted">Last 30 days: ${month.sessions.length} activities on ${month.activeDays} days, ${formatDuration(month.seconds)} in total.
      Moments of struggle noticed this week: ${week.struggles}. These are times your child missed several in a row or tapped very quickly; the app offered a break or an easier level.</p>
    <h2>Skills</h2><table>${skillRows}</table>
    <h2>Activities</h2><table><tr><th>Activity</th><th>Current level</th><th>Sessions</th><th>Recent accuracy</th></tr>${activityRows}</table>
    <h2>Letter tracing</h2>
    <div>${UPPERCASE.map(letterCell).join('')}</div><div>${LOWERCASE.map(letterCell).join('')}</div>
    <p class="muted">Green: confident · Yellow: getting there · Red: needs practice · Grey: not traced yet.</p>
    <h2>Recent sessions</h2>
    ${recentSessions ? `<table><tr><th>Day</th><th>Activity</th><th>Level</th><th>Accuracy</th><th>Per answer</th><th>Time</th><th>Struggles</th></tr>${recentSessions}</table>` : '<p class="muted">No sessions yet.</p>'}
    <h2>Look-alike mix-ups</h2>
    <p>${mixUps || '<span class="muted">None noticed yet.</span>'}</p>
    <p class="muted">Mixing up look-alike letters (b/d, p/q) and reversible words (was/saw) is common while learning to read and worth watching with dyslexia.</p>
    <h2>Write &amp; Score (last 30 days)</h2>
    ${letters.length ? `<p>${letters.filter((l) => l.correct).length} of ${letters.length} letters written correctly.${reversedLetters.length ? ` Written reversed: <b>${reversedLetters.map(escapeHtml).join(', ')}</b>.` : ''}</p>` : '<p class="muted">No letters written yet.</p>'}
    <h2>Letter Mastery: handwriting analysis</h2>
    ${masterySection(progress.mastery ?? [])}
    <h2>Clinical tests</h2>
    ${testsSection(progress.assessments ?? [])}
    <h2>Focus helper (last 30 days)</h2>
    ${focusRows ? `<table><tr><th>Activity</th><th>Readings (camera · touch)</th><th>Average focus</th><th>Expressions</th></tr>${focusRows}</table><p class="muted">From the front camera, checked on the device (no photos are kept): focus = facing the screen with eyes open, minus half the time spent looking away or with eyes closing, lowered when the expression model sees frustration, sadness or worry. When the face was out of view or the camera couldn't be used, readings come from touch and speech activity (busy = ${ACTIVE_SCORE}, idle = 0)${touchNote}.</p>` : '<p class="muted">The Focus helper is off or has no readings yet.</p>'}
    <h2>Mood check-ins (last 14 days)</h2><p>${moods || '<span class="muted">No check-ins yet.</span>'}</p>
    <h2>Badges</h2><p>${earned.length ? earned.join(' · ') : '<span class="muted">None yet.</span>'}</p>
    <p class="muted" style="margin-top:24px">LexiLeap is a practice tool and not a diagnostic test. If you have concerns about your child's reading, talk to their teacher or a qualified specialist.</p>
  </body></html>`;
}

const EXPRESSION_LABEL = {
  happy: 'Happy',
  focused: 'Focused',
  surprised: 'Surprised',
  frustrated: 'Frustrated',
  sad: 'Sad',
  worried: 'Worried',
  tired: 'Tired',
  'looking-away': 'Looking away',
  active: 'Busy (not in camera view)',
  away: 'Away from the screen',
} as const;
const STUDIO_NAMES: Record<keyof typeof STUDIOS, string> = {
  writing: 'Write & Score',
  'phonic-check': 'Say It Right',
  magic: 'Magic Words',
  visual: 'Spot It',
  'speech-test': 'Speech Test',
  'spelling-test': 'Write Test',
};
const featureName = (feature: FocusFeature) => (feature in ACTIVITIES ? ACTIVITIES[feature as keyof typeof ACTIVITIES].title : (STUDIO_NAMES[feature as keyof typeof STUDIOS] ?? feature));

const RISK_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High' } as const;
const SPELL_FLAG_LABEL: Record<SpellingFlag, string> = { 'on-track': 'On track', monitor: 'Monitor', 'high-risk': 'Needs support' };

/** Letter Mastery: mastered and struggling letters, averages and the screening indicators. */
function masterySection(reports: SessionFeatureSummary[]): string {
  if (reports.length === 0) return '<p class="muted">No letters written in Letter Mastery yet.</p>';
  const summary = summarizeMastery(reports, MASTERY_LETTERS);
  const r = summary.risk;
  return `<div class="stats">
      <div class="stat"><b>${summary.totalSessions}</b>letters written</div>
      <div class="stat"><b>${summary.averageAccuracy}%</b>average accuracy</div>
      <div class="stat"><b>${summary.mastered.length} / 26</b>letters mastered</div>
      <div class="stat"><b>${RISK_LABEL[r.level]}</b>overall screening indicator</div>
    </div>
    <p>Mastered: ${summary.mastered.length ? `<b>${summary.mastered.join(' ')}</b>` : '<span class="muted">none yet</span>'}.
      Needs practice: ${summary.struggling.length ? `<b>${summary.struggling.join(' ')}</b>` : '<span class="muted">none</span>'}.</p>
    <p>Indicators from the last 10 letters (0 = no concern, 100 = strong concern): visual-spatial ${r.visualSpatial}, motor control ${r.motor}, orientation (reversals) ${r.orientation}.</p>`;
}

/** Speech Tests and Write Tests taken, newest first. */
function testsSection(assessments: Assessment[]): string {
  if (assessments.length === 0) return '<p class="muted">No Speech Test or Write Test taken yet.</p>';
  const rows = [...assessments]
    .reverse()
    .map((a) => {
      const day = formatDay(dayKey(new Date(a.takenAt)));
      if (a.kind === 'speech') {
        const s = summarizeResults(a.items);
        const tricky = s.trickySounds.slice(0, 4).map(({ phoneme }) => escapeHtml(soundOf(phoneme).sound)).join(', ');
        return `<tr><td>${day}</td><td>Speech Test</td><td>${s.wordsRight} of ${s.wordsTotal} words${s.soundAccuracy !== null ? `, ${pct(s.soundAccuracy)} of sounds` : ''}</td><td>${tricky ? `Tricky sounds: ${tricky}` : '–'}</td></tr>`;
      }
      const s = summarizeSpelling(a.items);
      return `<tr><td>${day}</td><td>Write Test</td><td>${s.wordsRight} of ${s.wordsTotal} words, ${pct(s.accuracy)} accurate</td><td>${SPELL_FLAG_LABEL[s.flag]}</td></tr>`;
    })
    .join('');
  return `<table><tr><th>Day</th><th>Test</th><th>Result</th><th>Notes</th></tr>${rows}</table><p class="muted">Each test has its own detailed PDF in the parent zone.</p>`;
}

/**
 * The Letter Mastery clinical report (the original's "Generate Clinical Report"): summary, screening
 * indicators and every letter written with its key measures.
 */
export function buildMasteryReportHtml(profile: Profile, reports: SessionFeatureSummary[]): string {
  const rows = [...reports]
    .reverse()
    .slice(0, 60)
    .map((r) => {
      const sc = masteryScores(r);
      const c = r.clinical;
      return `<tr><td>${escapeHtml(new Date(r.timestamp).toLocaleDateString())}</td><td><b>${escapeHtml(r.letter)}</b></td><td>${escapeHtml(r.ml.predictedChar)}</td><td>${sc.accuracy}%</td><td>${sc.coverage}%</td><td>${sc.fluency}%</td>
        <td>${c.sequencing.strokeCountActual}/${c.sequencing.strokeCountExpected}</td><td>${pct(c.sequencing.directionCorrectRate)}</td><td>${(r.overview.completionTime / 1000).toFixed(1)} s</td>
        <td class="${r.ml.reversalDetected ? 'risk' : ''}">${r.ml.reversalDetected ? 'Yes' : 'No'}</td><td>${RISK_LABEL[riskLevel(sc)]}</td></tr>`;
    })
    .join('');
  const body = `${masterySection(reports)}
    <h2>Letters written</h2>
    ${rows ? `<table><tr><th>Day</th><th>Letter</th><th>Read as</th><th>Accuracy</th><th>Coverage</th><th>Fluency</th><th>Strokes</th><th>Direction</th><th>Time</th><th>Reversed</th><th>Indicator</th></tr>${rows}</table>` : ''}
    <h2>About these measures</h2>
    <p class="muted">Accuracy: how sure the on-device handwriting model is that the letter is the one asked for. Coverage: share of the letter's ideal path the writing passed over. Fluency: time moving versus paused. Strokes: strokes drawn / expected. Direction: strokes drawn in the expected direction. Reversed: the letter matched a mirrored or turned copy better than itself. Indicators combine these measures for screening only.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8">${ASSESSMENT_STYLE}</head><body>
    <h1>${escapeHtml(profile.name)}'s handwriting report</h1>
    <div class="muted">Letter Mastery · Age ${profile.age} · Generated ${formatDay(dayKey())} · LexiLeap</div>
    ${body}
    <p class="muted" style="margin-top:24px">This is an automated educational screening aid, not a medical diagnosis. Please share it with a teacher, occupational therapist or educational psychologist for a professional assessment.</p>
  </body></html>`;
}

export function shareMasteryReport(profile: Profile, reports: SessionFeatureSummary[]): Promise<void> {
  return sharePdf(buildMasteryReportHtml(profile, reports), `${profile.name}'s handwriting report`);
}

/** Renders the report to a PDF and opens the share sheet. */
export function shareReport(profile: Profile, progress: ProgressState): Promise<void> {
  return sharePdf(buildReportHtml(profile, progress), `${profile.name}'s learning report`);
}

const sound = (phoneme: string) => `<b>${escapeHtml(soundOf(phoneme).sound)}</b> <span class="muted">(as in ${escapeHtml(soundOf(phoneme).example)})</span>`;

const ASSESSMENT_STYLE = `<style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #2E2618; margin: 32px; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0; } h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #E4D7C2; padding-bottom: 4px; }
    .muted { color: #6B5D48; font-size: 11px; }
    .stats { display: flex; gap: 12px; margin-top: 16px; }
    .stat { flex: 1; background: #F3EADB; border-radius: 8px; padding: 10px; }
    .stat b { display: block; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; } td, th { text-align: left; padding: 6px 4px; border-bottom: 1px solid #EFE6D6; vertical-align: top; }
    .good { color: #15803D; font-weight: bold; } .weak { color: #B45309; font-weight: bold; } .risk { color: #B91C1C; font-weight: bold; }
    ul { margin: 0; padding-left: 18px; }
  </style>`;

function assessmentPage(title: string, profile: Profile, assessment: Assessment, body: string): string {
  const taken = new Date(assessment.takenAt);
  const when = `${taken.toLocaleDateString()} ${taken.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `<!doctype html><html><head><meta charset="utf-8">${ASSESSMENT_STYLE}</head><body>
    <h1>${title}</h1>
    <div class="muted">${escapeHtml(profile.name)} · Age ${profile.age} · ${escapeHtml(when)} · LexiLeap</div>
    ${body}
    <p class="muted" style="margin-top:24px">This screening is a practice aid and not a diagnosis. Automatic scoring depends on the device, the microphone or handwriting, and background noise. Please share it with a teacher, speech and language therapist or educational psychologist for a professional assessment.</p>
  </body></html>`;
}

/** A one-page record of a speech test, in the style of the original clinical report. */
export function buildSpeechReportHtml(profile: Profile, assessment: SpeechAssessment): string {
  const summary = summarizeResults(assessment.items);
  const method = assessment.method === 'auto' ? 'Scored sound by sound by the app (on-device speech recognition)' : 'Marked word by word by an adult';
  const rows = assessment.items
    .map((item) => {
      const result = item.correct ? '<span class="good">Correct</span>' : '<span class="weak">Needs practice</span>';
      const notes = [
        ...item.changed.map(([target, heard]) => `${escapeHtml(soundOf(target).sound)} → ${escapeHtml(soundOf(heard).sound)}`),
        ...item.missed.map((p) => `missed ${escapeHtml(soundOf(p).sound)}`),
      ].join(', ');
      return `<tr><td><b>${escapeHtml(item.word)}</b></td><td>${result}</td><td>${item.score === null ? '–' : pct(item.score)}</td><td>${item.heard ? escapeHtml(item.heard) : '–'}</td><td>${notes || '–'}</td></tr>`;
    })
    .join('');
  const tricky = summary.trickySounds.map(({ phoneme, count }) => `<li>${sound(phoneme)} · ${count}×</li>`).join('');
  const swaps = summary.substitutions.map(({ target, heard, count }) => `<li>${sound(target)} said as ${sound(heard)} · ${count}×</li>`).join('');

  return assessmentPage(
    'Speech &amp; reading assessment',
    profile,
    assessment,
    `<div class="stats">
      <div class="stat"><b>${summary.wordsRight} / ${summary.wordsTotal}</b>words read correctly</div>
      <div class="stat"><b>${summary.soundAccuracy === null ? '–' : pct(summary.soundAccuracy)}</b>sound accuracy</div>
      <div class="stat"><b>${summary.trickySounds.length}</b>sounds to practise</div>
    </div>
    <p class="muted">Method: ${method}.</p>
    <h2>Sounds to practise</h2>
    ${tricky ? `<ul>${tricky}</ul>` : '<p class="muted">No tricky sounds found.</p>'}
    <h2>Sound swaps</h2>
    ${swaps ? `<ul>${swaps}</ul>` : '<p class="muted">No consistent swaps found.</p>'}
    <p class="muted">Swapping sounds (for example "th" said as "f") is common in young children. A pattern that persists is worth mentioning to a speech and language therapist.</p>
    <h2>Word by word</h2>
    <table><tr><th>Word</th><th>Result</th><th>Sounds right</th><th>Heard</th><th>Notes</th></tr>${rows}</table>`,
  );
}

const ERROR_LABEL: Record<SpellingError, string> = {
  reversal: 'Reversal (b/d, p/q)',
  transposition: 'Letters swapped',
  omission: 'Letter left out',
  insertion: 'Extra letter',
  substitution: 'Wrong letter',
  blank: 'Not written',
};
const FLAG_LABEL: Record<SpellingFlag, string> = {
  'on-track': '<span class="good">On track</span>',
  monitor: '<span class="weak">Worth monitoring</span>',
  'high-risk': '<span class="risk">Needs support</span>',
};

/** A one-page record of a Write Test (listen and write), like the original spelling report. */
export function buildSpellingReportHtml(profile: Profile, assessment: SpellingAssessment): string {
  const summary = summarizeSpelling(assessment.items);
  const rows = assessment.items
    .map((item) => {
      const result = item.errors.length === 0 ? '<span class="good">Correct</span>' : item.errors.map((e) => ERROR_LABEL[e]).join(', ');
      return `<tr><td><b>${escapeHtml(item.word)}</b>${TRICKY_WORDS.has(item.word) ? ' <span class="muted">(tricky)</span>' : ''}</td><td>${item.written ? escapeHtml(item.written) : '–'}</td><td>${pct(item.accuracy)}</td><td>${result}</td><td>${item.seconds.toFixed(0)} s</td></tr>`;
    })
    .join('');
  const errors = (Object.keys(ERROR_LABEL) as SpellingError[])
    .filter((e) => summary.errorCounts[e] > 0)
    .map((e) => `<li>${ERROR_LABEL[e]} · ${summary.errorCounts[e]}×</li>`)
    .join('');
  const tips = spellingRecommendations(summary).map((tip) => `<li>${escapeHtml(tip)}</li>`).join('');

  return assessmentPage(
    'Spelling assessment (listen &amp; write)',
    profile,
    assessment,
    `<div class="stats">
      <div class="stat"><b>${summary.wordsRight} / ${summary.wordsTotal}</b>words spelled correctly</div>
      <div class="stat"><b>${pct(summary.accuracy)}</b>average accuracy</div>
      <div class="stat"><b>${summary.trickyAccuracy === null ? '–' : pct(summary.trickyAccuracy)}</b>tricky words</div>
      <div class="stat"><b>${summary.errorCounts.reversal}</b>reversals</div>
    </div>
    <p>Overall: ${FLAG_LABEL[summary.flag]}</p>
    <p class="muted">Method: each word was spoken by the app and written letter by letter; the app read the handwriting on the device${assessment.method === 'adult' ? ' and a grown-up checked the readings' : ''}.</p>
    <h2>Error patterns</h2>
    ${errors ? `<ul>${errors}</ul>` : '<p class="muted">No errors.</p>'}
    <h2>Practice ideas</h2><ul>${tips}</ul>
    <h2>Word by word</h2>
    <table><tr><th>Word</th><th>Written</th><th>Accuracy</th><th>Result</th><th>Time</th></tr>${rows}</table>`,
  );
}

export function buildAssessmentHtml(profile: Profile, assessment: Assessment): string {
  return assessment.kind === 'speech' ? buildSpeechReportHtml(profile, assessment) : buildSpellingReportHtml(profile, assessment);
}

export function shareAssessmentReport(profile: Profile, assessment: Assessment): Promise<void> {
  const title = assessment.kind === 'speech' ? 'speech assessment' : 'spelling assessment';
  return sharePdf(buildAssessmentHtml(profile, assessment), `${profile.name}'s ${title}`);
}

/** Renders HTML to a PDF and opens the share sheet. */
async function sharePdf(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}
