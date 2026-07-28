import { test } from 'node:test';
import assert from 'node:assert/strict';
import engine from '../src/engine.js';

const { createState, runCommand } = engine;

// ---------- state, cluster lifecycle, jps ----------

test('createState seeds local files per OS', () => {
  const lin = createState('linux');
  assert.equal(lin.os, 'linux');
  assert.equal(lin.clusterUp, false);
  assert.ok(runCommand(lin, 'ls').output.includes('kit'));
  assert.ok(runCommand(lin, 'ls').output.includes('weather'));
  assert.ok(runCommand(lin, 'ls').output.includes('piglab'));
  runCommand(lin, 'cd ~/weather');
  assert.ok(runCommand(lin, 'ls').output.includes('Weather.csv'));

  const win = createState('windows');
  assert.ok(runCommand(win, 'ls').output.includes('command3.txt')); // cwd C:/BDA
  assert.ok(runCommand(win, 'ls').output.includes('Weather.csv'));
  runCommand(win, 'cd C:/piglab');
  assert.ok(runCommand(win, 'dir').output.includes('script.pig'));
});

test('HDFS seeded with /tmp and /user only', () => {
  const s = createState('linux');
  runCommand(s, 'hadoop-start');
  const out = runCommand(s, 'hadoop fs -ls /').output;
  assert.ok(out.includes('/tmp'));
  assert.ok(out.includes('/user'));
  assert.ok(out.includes('Found 2 items'));
});

test('cluster start/stop transitions per OS', () => {
  const lin = createState('linux');
  assert.equal(runCommand(lin, 'hadoop-start').ok, true);
  assert.equal(lin.clusterUp, true);
  assert.equal(runCommand(lin, 'hadoop-stop').ok, true);
  assert.equal(lin.clusterUp, false);

  const win = createState('windows');
  assert.equal(runCommand(win, 'start-all.cmd').ok, true);
  assert.equal(win.clusterUp, true);
  assert.equal(runCommand(win, 'stop-all.cmd').ok, true);
  assert.equal(win.clusterUp, false);
});

test('wrong-OS start command hints at the right one', () => {
  const lin = createState('linux');
  const r = runCommand(lin, 'start-all.cmd');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('hadoop-start'));

  const win = createState('windows');
  const r2 = runCommand(win, 'hadoop-start');
  assert.equal(r2.ok, false);
  assert.ok(r2.output.includes('start-all.cmd'));
});

test('jps daemon counts: 5 unix, 4 native windows', () => {
  const lin = createState('linux');
  runCommand(lin, 'hadoop-start');
  const lines = runCommand(lin, 'jps').output.trim().split('\n');
  assert.equal(lines.length, 6); // 5 daemons + Jps
  assert.ok(lines.some(l => l.includes('SecondaryNameNode')));

  const win = createState('windows');
  runCommand(win, 'start-all.cmd');
  const wlines = runCommand(win, 'jps').output.trim().split('\n');
  assert.equal(wlines.length, 5); // 4 daemons + Jps
  assert.ok(!wlines.some(l => l.includes('SecondaryNameNode')));
});

test('fs commands while cluster down => Connection refused', () => {
  const s = createState('linux');
  const r = runCommand(s, 'hadoop fs -ls /');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('Connection refused'));
});

// ---------- preflight commands ----------

test('java -version answers per OS, no cluster needed', () => {
  const lin = createState('linux');
  const r = runCommand(lin, 'java -version');
  assert.equal(r.ok, true);
  assert.ok(r.output.includes('11.0'));

  const win = createState('windows');
  const rw = runCommand(win, 'java -version');
  assert.equal(rw.ok, true);
  assert.ok(rw.output.includes('1.8.0'));
});

test('hadoop version reflects OS install', () => {
  const lin = createState('mac');
  assert.ok(runCommand(lin, 'hadoop version').output.includes('3.4.1'));
  const win = createState('windows');
  assert.ok(runCommand(win, 'hadoop version').output.includes('3.3.6'));
});

test('echo expands HADOOP_HOME per OS', () => {
  const lin = createState('linux');
  const r = runCommand(lin, 'echo $HADOOP_HOME');
  assert.equal(r.ok, true);
  assert.ok(r.output.includes('hadoop-3.4.1'));

  const win = createState('windows');
  const rw = runCommand(win, 'echo %HADOOP_HOME%');
  assert.ok(rw.output.includes('C:\\hadoop'));
});

test('pig -version answers without a cluster', () => {
  const s = createState('linux');
  const r = runCommand(s, 'pig -version');
  assert.equal(r.ok, true);
  assert.ok(r.output.includes('0.17.0'));
  assert.ok(r.output.includes('r1797386'));
});

// ---------- local cat / dir ----------

test('local cat and windows type read seeded files', () => {
  const lin = createState('linux');
  runCommand(lin, 'cd ~/weather');
  const r = runCommand(lin, 'cat Weather.csv');
  assert.equal(r.ok, true);
  assert.ok(r.output.includes('2025-03-01, 32, 55, Clear'));
  assert.ok(r.output.includes('2025-03-31, 12, 75, Thunderstorm'));

  const win = createState('windows');
  const rw = runCommand(win, 'type Weather.csv');
  assert.equal(rw.ok, true);
  assert.ok(rw.output.includes('Thunderstorm'));
});

test('cat missing file errors cleanly', () => {
  const s = createState('linux');
  const r = runCommand(s, 'cat nope.txt');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('No such file'));
});

// ---------- HDFS fs behaviour (spot checks, unchanged from playground) ----------

test('mkdir + put + cat + rm round trip', () => {
  const s = createState('linux');
  runCommand(s, 'hadoop-start');
  assert.equal(runCommand(s, 'hadoop fs -mkdir /dir1').ok, true);
  runCommand(s, 'cd ~/kit/Lab-2-HDFS-Basic-Commands');
  assert.equal(runCommand(s, 'hadoop fs -copyFromLocal command3.txt /dir1').ok, true);
  const r = runCommand(s, 'hadoop fs -cat /dir1/command3.txt');
  assert.ok(r.output.includes('this file moves into hdfs'));
  assert.equal(runCommand(s, 'hadoop fs -rm /dir1/command3.txt').ok, true);
  assert.equal(runCommand(s, 'hadoop fs -rmdir /dir1').ok, true);
});

test('put without -f refuses to overwrite; -f overwrites', () => {
  const s = createState('linux');
  runCommand(s, 'hadoop-start');
  runCommand(s, 'hadoop fs -mkdir /d');
  runCommand(s, 'cd ~/weather');
  assert.equal(runCommand(s, 'hadoop fs -put Weather.csv /d').ok, true);
  assert.equal(runCommand(s, 'hadoop fs -put Weather.csv /d').ok, false);
  assert.equal(runCommand(s, 'hadoop fs -put -f Weather.csv /d').ok, true);
});

test('rmdir refuses non-empty directory', () => {
  const s = createState('linux');
  runCommand(s, 'hadoop-start');
  runCommand(s, 'hadoop fs -mkdir /d');
  runCommand(s, 'cd ~/weather');
  runCommand(s, 'hadoop fs -put Weather.csv /d');
  const r = runCommand(s, 'hadoop fs -rmdir /d');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('not empty'));
  assert.equal(runCommand(s, 'hadoop fs -rm -r /d').ok, true);
});

// ---------- weather toolchain ----------

function weatherReady(os) {
  const s = createState(os);
  runCommand(s, os === 'windows' ? 'start-all.cmd' : 'hadoop-start');
  runCommand(s, 'hadoop fs -mkdir /bda3');
  runCommand(s, os === 'windows' ? 'cd C:/BDA' : 'cd ~/weather');
  runCommand(s, os === 'windows'
    ? 'hadoop fs -copyFromLocal C:/BDA/Weather.csv /bda3'
    : 'hadoop fs -copyFromLocal Weather.csv /bda3');
  return s;
}

test('javac requires classpath; compiles WeatherDataProcessor classes', () => {
  const s = weatherReady('linux');
  const bad = runCommand(s, 'javac -d . WeatherDataProcessor.java');
  assert.equal(bad.ok, false);
  assert.ok(bad.output.includes('hadoop classpath'));
  const good = runCommand(s, 'javac -classpath "$(hadoop classpath)" -d . WeatherDataProcessor.java');
  assert.equal(good.ok, true);
  assert.ok(runCommand(s, 'ls').output.includes('WeatherDataProcessor$WeatherMapper.class'));
});

test('jar refuses before compile; builds after', () => {
  const s = weatherReady('linux');
  assert.equal(runCommand(s, 'jar -cf WeatherDataProcessor.jar *.class').ok, false);
  runCommand(s, 'javac -classpath "$(hadoop classpath)" -d . WeatherDataProcessor.java');
  assert.equal(runCommand(s, 'jar -cf WeatherDataProcessor.jar *.class').ok, true);
  assert.ok(runCommand(s, 'ls').output.includes('WeatherDataProcessor.jar'));
});

test('weather job full run produces 31-line output with known classifications', () => {
  for (const os of ['linux', 'mac', 'windows']) {
    const s = weatherReady(os);
    runCommand(s, os === 'windows'
      ? 'javac -classpath "%HADOOP_HOME%\\share\\hadoop\\common\\*;%HADOOP_HOME%\\share\\hadoop\\mapreduce\\*" -d . WeatherDataProcessor.java'
      : 'javac -classpath "$(hadoop classpath)" -d . WeatherDataProcessor.java');
    runCommand(s, os === 'windows' ? 'jar -cvf WeatherDataProcessor.jar -C . .' : 'jar -cf WeatherDataProcessor.jar *.class');
    const run = runCommand(s, 'hadoop jar WeatherDataProcessor.jar WeatherDataProcessor /bda3/Weather.csv /Weather_output');
    assert.equal(run.ok, true, os + ': ' + run.output);
    assert.ok(run.output.includes('completed successfully'));
    assert.ok(run.output.includes('Map input records=31'));
    const cat = runCommand(s, 'hadoop fs -cat /Weather_output/part-r-00000');
    const lines = cat.output.split('\n').filter(l => /^2025-/.test(l));
    assert.equal(lines.length, 31);
    assert.ok(cat.output.includes('2025-03-11\tModerate Weather')); // Drizzle trap
    assert.ok(cat.output.includes('2025-03-31\tStormy Weather - Stay Safe!')); // Thunderstorm trap
    assert.ok(!cat.output.includes('Cold Day')); // no cold day in this dataset
  }
});

test('weather job refuses existing output dir and wrong main class', () => {
  const s = weatherReady('linux');
  runCommand(s, 'javac -classpath "$(hadoop classpath)" -d . WeatherDataProcessor.java');
  runCommand(s, 'jar -cf WeatherDataProcessor.jar *.class');
  const wrong = runCommand(s, 'hadoop jar WeatherDataProcessor.jar WrongClass /bda3/Weather.csv /o');
  assert.equal(wrong.ok, false);
  assert.ok(wrong.output.includes('ClassNotFoundException'));
  assert.equal(runCommand(s, 'hadoop jar WeatherDataProcessor.jar WeatherDataProcessor /bda3/Weather.csv /Weather_output').ok, true);
  const again = runCommand(s, 'hadoop jar WeatherDataProcessor.jar WeatherDataProcessor /bda3/Weather.csv /Weather_output');
  assert.equal(again.ok, false);
  assert.ok(again.output.includes('FileAlreadyExistsException'));
});

test('weather job with cluster down => connection refused', () => {
  const s = createState('linux');
  runCommand(s, 'cd ~/weather');
  const r = runCommand(s, 'hadoop jar WeatherDataProcessor.jar WeatherDataProcessor /x /y');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('Connection refused'));
});

// ---------- pig ----------

test('pig -x local script.pig runs from piglab and prints all three DUMPs', () => {
  for (const os of ['linux', 'mac', 'windows']) {
    const s = createState(os);
    runCommand(s, os === 'windows' ? 'cd C:/piglab' : 'cd ~/piglab');
    const r = runCommand(s, 'pig -x local script.pig');
    assert.equal(r.ok, true, os + ': ' + r.output);
    assert.ok(r.output.includes('(Alice,B)'));
    assert.ok(r.output.includes('(David,B)'));
    assert.ok(r.output.includes('(Math,{(4,Math,88),(2,Math,78),(1,Math,85)})'));
    assert.ok(r.output.includes('(Science,{(3,Science,90)})'));
    assert.ok(r.output.includes('(4,David,20,B,4,Math,88)'));
    assert.ok(r.output.includes('Success!'));
  }
});

test('pig script from wrong folder errors with a hint', () => {
  const s = createState('linux');
  const r = runCommand(s, 'pig -x local script.pig');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('does not exist'));
});

test('pig without a script points to the right shape', () => {
  const s = createState('linux');
  const r = runCommand(s, 'pig -x local');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('script.pig'));
});

test('pig lab needs no cluster', () => {
  const s = createState('mac');
  assert.equal(s.clusterUp, false);
  runCommand(s, 'cd ~/piglab');
  assert.equal(runCommand(s, 'pig -x local script.pig').ok, true);
});

// ---------- misc ----------

test('unknown command per OS message', () => {
  const lin = createState('linux');
  assert.ok(runCommand(lin, 'frobnicate').output.includes('command not found'));
  const win = createState('windows');
  assert.ok(runCommand(win, 'frobnicate').output.includes('not recognized'));
});

test('hadoop classpath prints a classpath', () => {
  const s = createState('linux');
  assert.ok(runCommand(s, 'hadoop classpath').output.includes('share/hadoop'));
});
