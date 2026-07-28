import { test } from 'node:test';
import assert from 'node:assert/strict';
import engine from '../src/engine.js';
import lessons from '../src/lessons.js';

const { MODULES, buildRecap, buildExam, examSetup } = lessons;
const OSES = ['linux', 'mac', 'windows'];

function runSequence(steps, state, os, label) {
  for (const [i, step] of steps.entries()) {
    assert.ok(typeof step.question === 'string' && step.question.length, `${label} step ${i} has question`);
    assert.ok(Array.isArray(step.hints) && step.hints.length === 2, `${label} step ${i} has 2 hints`);
    const input = step.answer(os);
    assert.ok(typeof input === 'string' && input.length, `${label} step ${i} answer(${os})`);
    const result = engine.runCommand(state, input);
    assert.ok(step.check(state, result, input),
      `${label} step ${i} [${os}]: canonical answer "${input}" must pass its own check (output: ${result.output})`);
  }
}

for (const os of OSES) {
  test(`every module's canonical answers pass their checks (${os})`, () => {
    for (const m of MODULES) {
      const state = m.setup(engine, os);
      runSequence(m.steps, state, os, `module ${m.id}`);
    }
  });

  test(`every recap's canonical answers pass their checks (${os})`, () => {
    for (const m of MODULES) {
      const state = m.setup(engine, os);
      const steps = buildRecap(m);
      assert.ok(steps.every(s => !s.theory), `recap ${m.id} has no theory`);
      runSequence(steps, state, os, `recap ${m.id}`);
    }
  });

  test(`exam canonical answers pass their checks (${os})`, () => {
    const state = examSetup(engine, os);
    const steps = buildExam();
    assert.ok(steps.every(s => s.examMode), 'exam steps flagged');
    runSequence(steps, state, os, 'exam');
  });
}

test('repetition audit: every core command family appears >= 3 times overall', () => {
  const answers = [];
  for (const m of MODULES) {
    for (const s of m.steps) answers.push(s.answer('linux'));
    for (const s of buildRecap(m)) answers.push(s.answer('linux'));
  }
  for (const s of buildExam()) answers.push(s.answer('linux'));
  const families = {
    start: a => a === 'hadoop-start',
    jps: a => a === 'jps',
    ls: a => /-ls\b/.test(a),
    mkdir: a => /fs -mkdir|dfs -mkdir/.test(a),
    put: a => /-copyFromLocal|-put\b/.test(a),
    get: a => /-copyToLocal|-get\b/.test(a),
    cat: a => /-cat\b/.test(a),
    rm: a => /-rm\b|-rm -r|-rmdir/.test(a),
    javac: a => /^javac /.test(a),
    jar: a => /^jar /.test(a),
    runjob: a => /^hadoop jar /.test(a),
    pigversion: a => a === 'pig -version',
    pigrun: a => /^pig -x local script\.pig$/.test(a)
  };
  for (const [name, match] of Object.entries(families)) {
    const n = answers.filter(match).length;
    assert.ok(n >= 3, `family "${name}" appears ${n}x, need >= 3`);
  }
  // preflight families: guided + recap only
  const preflight = {
    javaversion: a => a === 'java -version',
    hadoopversion: a => a === 'hadoop version',
    echohome: a => /^echo .HADOOP_HOME.?$/.test(a),
    localcat: a => /^cat /.test(a)
  };
  for (const [name, match] of Object.entries(preflight)) {
    const n = answers.filter(match).length;
    assert.ok(n >= 2, `preflight family "${name}" appears ${n}x, need >= 2`);
  }
});

test('every module carries intro, outcome and troubleshooting', () => {
  for (const m of MODULES) {
    assert.ok(typeof m.intro === 'string' && m.intro.length > 40, `${m.id} intro`);
    assert.ok(typeof m.outcome === 'string' && m.outcome.length > 40, `${m.id} outcome`);
    assert.ok(Array.isArray(m.troubleshooting) && m.troubleshooting.length >= 3, `${m.id} troubleshooting >= 3 entries`);
    for (const t of m.troubleshooting) {
      assert.ok(t.length === 2 && t[0].length && t[1].length, `${m.id} troubleshooting rows are [error, fix]`);
    }
  }
});

test('guideMarkdown renders per OS with commands, outputs and troubleshooting', () => {
  for (const os of OSES) {
    const md = lessons.guideMarkdown(engine, os);
    assert.ok(md.length > 10000, `${os} guide has substance`);
    for (const m of MODULES) assert.ok(md.includes('## Module'), `${os} has module headers`);
    assert.ok(md.includes('Troubleshooting'), `${os} has troubleshooting`);
    assert.ok(md.includes('Expected output:'), `${os} shows outputs`);
    assert.ok(md.includes(os === 'windows' ? 'start-all.cmd' : 'hadoop-start'), `${os} start cmd`);
    assert.ok(md.includes('pig -x local script.pig'), `${os} pig run`);
    assert.ok(md.includes('(Alice,B)'), `${os} pig output present`);
    assert.ok(md.includes('2025-03-31\tStormy Weather - Stay Safe!'), `${os} weather output present`);
  }
});
