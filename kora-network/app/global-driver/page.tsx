'use client';

import { useMemo, useState } from 'react';

const JURISDICTIONS = [
  ['South Africa', 'ZA', 'National', ['Code 1', 'Code 2', 'Code 3']],
  ['United Kingdom', 'GB', 'National', ['Car', 'Motorcycle', 'LGV', 'PCV']],
  ['Ireland', 'IE', 'National', ['Car / Work Vehicle', 'Motorcycle', 'Bus', 'HGV']],
  ['United States', 'US', 'State / territory', ['Learner Permit']],
  ['Canada', 'CA', 'Province / territory', ['G1 / Class 7 / Learner']],
  ['Australia', 'AU', 'State / territory', ['Learner Licence']],
  ['New Zealand', 'NZ', 'National', ['Class 1', 'Motorcycle']],
  ['India', 'IN', 'State / union territory', ['LMV', 'Motorcycle']],
  ['Nigeria', 'NG', 'National', ['Learner / Class B']],
  ['Kenya', 'KE', 'National', ['Class B', 'Motorcycle']],
  ['Ghana', 'GH', 'National', ['Private Car', 'Motorcycle']],
  ['Tanzania', 'TZ', 'National', ['Class B']],
  ['Uganda', 'UG', 'National', ['Motor Vehicle', 'Motorcycle']],
  ['Rwanda', 'RW', 'National', ['Category B']],
  ['Botswana', 'BW', 'National', ['Light Motor Vehicle']],
  ['Namibia', 'NA', 'National', ['Light Vehicle']],
  ['Zimbabwe', 'ZW', 'National', ['Class 4']],
  ['Zambia', 'ZM', 'National', ['Class B']],
  ['Mozambique', 'MZ', 'National', ['Light Vehicle']],
  ['Mauritius', 'MU', 'National', ['Private Motor Car']],
  ['Germany', 'DE', 'National', ['Class B']],
  ['France', 'FR', 'National', ['Category B']],
  ['Spain', 'ES', 'National', ['B']],
  ['Italy', 'IT', 'National', ['B']],
  ['Netherlands', 'NL', 'National', ['B']],
  ['Portugal', 'PT', 'National', ['B']],
  ['Switzerland', 'CH', 'Cantonal / national framework', ['B']],
  ['United Arab Emirates', 'AE', 'Emirate / national', ['Light Vehicle']],
  ['Saudi Arabia', 'SA', 'National', ['Private Driving']],
  ['Japan', 'JP', 'National', ['Ordinary Vehicle']],
  ['Singapore', 'SG', 'National', ['Class 3 / 3A']],
  ['Malaysia', 'MY', 'National', ['Class D']],
  ['Indonesia', 'ID', 'National', ['SIM A']],
  ['Philippines', 'PH', 'National', ['Student Permit / Non-Professional']],
  ['South Korea', 'KR', 'National', ['Class 2 Ordinary']],
  ['Brazil', 'BR', 'State / national framework', ['Category B']],
  ['Mexico', 'MX', 'State / jurisdiction', ['Private Driver']],
  ['Argentina', 'AR', 'Jurisdiction', ['Class B']],
  ['Chile', 'CL', 'National / municipal', ['Class B']],
  ['Colombia', 'CO', 'National', ['Category B']],
  ['Egypt', 'EG', 'National', ['Private Vehicle']],
  ['Morocco', 'MA', 'National', ['B']],
];

const SAMPLE_QUESTIONS = [
  { country: 'South Africa', category: 'Code 2', topic: 'Road safety', question: 'Before moving off from the side of the road, what should a driver do?', options: ['Check mirrors and blind spots and signal as required', 'Sound the horn continuously', 'Accelerate immediately', 'Switch off the headlights'], answer: 0, explanation: 'A safe move-off requires observation, including mirrors and blind spots, plus the appropriate signal before entering traffic.' },
  { country: 'United Kingdom', category: 'Car', topic: 'Hazard awareness', question: 'When approaching a developing hazard, what is the safest general response?', options: ['Reduce speed and prepare to stop', 'Speed up to pass it sooner', 'Ignore it until it becomes immediate', 'Use the horn instead of changing speed'], answer: 0, explanation: 'Early recognition gives the driver more time and space to respond safely.' },
  { country: 'Australia', category: 'Learner Licence', topic: 'Following distance', question: 'Why should a learner driver maintain a safe following distance?', options: ['To create time to react to traffic changes', 'To make overtaking compulsory', 'To prevent other vehicles changing lanes', 'To avoid using mirrors'], answer: 0, explanation: 'A larger safety margin provides additional reaction and braking time when conditions change.' },
  { country: 'United States', category: 'Learner Permit', topic: 'Signs', question: 'What is the primary purpose of a regulatory road sign?', options: ['To communicate a traffic law or restriction', 'To advertise a business', 'To show the weather forecast', 'To identify a vehicle model'], answer: 0, explanation: 'Regulatory signs communicate rules, restrictions or requirements that road users must follow.' },
  { country: 'Canada', category: 'Learner', topic: 'Intersections', question: 'At an intersection, what should a driver do when visibility is limited?', options: ['Approach cautiously and be prepared to stop', 'Maintain maximum speed', 'Close both eyes briefly', 'Follow the vehicle ahead without observing'], answer: 0, explanation: 'Limited visibility increases risk, so speed and approach should allow enough time to identify and respond to hazards.' },
];

const FEATURES = [
  ['🌍', 'Global jurisdiction engine', 'Country → region → licence category → rules → practice.'],
  ['🧠', 'Adaptive practice', 'KORA identifies weak topics and serves targeted questions.'],
  ['🚦', 'Signs & scenarios', 'Build visual road-sign, road-rule and hazard modules per jurisdiction.'],
  ['🏁', 'Mock examinations', 'Timed practice exams with scoring, review and readiness tracking.'],
  ['📚', 'Official-source layer', 'Jurisdiction content can be mapped to authoritative government/licensing sources.'],
  ['🔗', 'KORA NAV connection', 'Learning flows naturally into safer driving and KORA navigation.'],
];

export default function GlobalDriverPage() {
  const [country, setCountry] = useState('South Africa');
  const [category, setCategory] = useState('Code 2');
  const [mode, setMode] = useState<'learn' | 'quiz' | 'mock'>('learn');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const jurisdiction = useMemo(() => JURISDICTIONS.find((j) => j[0] === country) ?? JURISDICTIONS[0], [country]);
  const categories = jurisdiction[3] as string[];
  const questions = useMemo(() => {
    const matching = SAMPLE_QUESTIONS.filter((q) => q.country === country && (q.category === category || country === 'South Africa'));
    return matching.length ? matching : SAMPLE_QUESTIONS.filter((q) => q.country === country).concat(SAMPLE_QUESTIONS.slice(0, 2));
  }, [country, category]);
  const current = questions[index % questions.length];

  function changeCountry(value: string) {
    setCountry(value);
    const next = JURISDICTIONS.find((j) => j[0] === value);
    setCategory((next?.[3] as string[])?.[0] ?? 'Learner');
    setIndex(0);
    setSelected(null);
    setScore(0);
  }

  function choose(answer: number) {
    if (selected !== null) return;
    setSelected(answer);
    if (answer === current.answer) setScore((s) => s + 1);
  }

  function nextQuestion() {
    setIndex((i) => i + 1);
    setSelected(null);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-emerald-950 via-slate-950 to-cyan-950 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">KORA GLOBAL DRIVER ACADEMY</div>
          <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">Learn to drive anywhere in the world.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">One KORA learning engine for local learner-licence preparation, road rules, signs, hazard awareness, practice tests and mock examinations — organised by the jurisdiction that actually applies to you.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setMode('quiz')} className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950">Start practice</button>
            <button onClick={() => setMode('mock')} className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-bold">Take a mock exam</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:grid-cols-3">
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-300">Country / jurisdiction</span><select value={country} onChange={(e) => changeCountry(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white">{JURISDICTIONS.map((j) => <option key={j[0]}>{j[0]}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-300">Licence category</span><select value={category} onChange={(e) => { setCategory(e.target.value); setIndex(0); }} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white">{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
          <div><span className="mb-2 block text-sm font-semibold text-slate-300">Jurisdiction model</span><div className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-200">{jurisdiction[2]}</div></div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {FEATURES.map(([icon, title, text]) => <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="text-2xl">{icon}</div><h2 className="mt-3 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></article>)}
        </div>

        {(mode === 'quiz' || mode === 'mock') && (
          <section className="mt-10 rounded-3xl border border-emerald-300/20 bg-emerald-400/[0.06] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">{mode === 'mock' ? 'Mock examination' : 'Practice mode'}</p><h2 className="mt-2 text-2xl font-black">{current.topic}</h2></div><div className="rounded-full bg-white/10 px-4 py-2 text-sm">Score: {score}/{index + (selected !== null ? 1 : 0)}</div></div>
            <p className="mt-6 text-lg font-semibold leading-8">{current.question}</p>
            <div className="mt-5 grid gap-3">{current.options.map((option, i) => <button key={option} onClick={() => choose(i)} className={`rounded-xl border p-4 text-left transition ${selected === null ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]' : i === current.answer ? 'border-emerald-400/60 bg-emerald-400/10' : i === selected ? 'border-red-400/60 bg-red-400/10' : 'border-white/10 bg-white/[0.02]'}`}>{option}</button>)}</div>
            {selected !== null && <div className="mt-5 rounded-2xl bg-black/20 p-5"><p className="font-bold">{selected === current.answer ? 'Correct' : 'Review this one'}</p><p className="mt-2 text-sm leading-6 text-slate-300">{current.explanation}</p><button onClick={nextQuestion} className="mt-4 rounded-xl bg-white px-4 py-2 font-bold text-slate-950">Next question</button></div>}
          </section>
        )}

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">KORA architecture</p>
          <h2 className="mt-2 text-3xl font-black">Country → Region → Licence → Rules → Practice → Mock Exam</h2>
          <p className="mt-4 max-w-4xl leading-7 text-slate-400">This first release establishes the global experience and jurisdiction model. Production question banks should be populated and periodically reviewed from the authoritative licensing authority for each jurisdiction. KORA practice content is preparation material and does not replace an official government examination.</p>
          <div className="mt-6 grid gap-3 text-sm md:grid-cols-6">{['Jurisdiction', 'Road rules', 'Road signs', 'Hazards', 'Practice', 'Mock exam'].map((item) => <div key={item} className="rounded-xl border border-white/10 bg-slate-900 p-4 text-center font-semibold">{item}</div>)}</div>
        </section>
      </section>
    </main>
  );
}
